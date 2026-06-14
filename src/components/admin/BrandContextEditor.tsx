'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Loader2, Save, Check, Compass, Mic, ShieldCheck, Hash, Globe2, BadgeX,
  Pencil,
} from 'lucide-react'
import { useToast, Toasts } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import type { BrandContext } from '@/types/database'

// Etiquetas humanas + iconos para cada `key` conocido
const KEY_META: Record<string, { label: string; group: string; icon: typeof Compass }> = {
  brand_identity:      { label: 'Identidad de marca',         group: 'Marca',     icon: Compass    },
  tone_of_voice:       { label: 'Tono de voz',                group: 'Marca',     icon: Mic        },
  approved_claims:     { label: 'Claims aprobados',           group: 'Marca',     icon: ShieldCheck },
  no_decir:            { label: 'Lo que nunca debemos decir', group: 'Marca',     icon: BadgeX     },
  channel_linkedin:    { label: 'Guía LinkedIn',              group: 'Canales',   icon: Hash       },
  channel_instagram:   { label: 'Guía Instagram',             group: 'Canales',   icon: Hash       },
  channel_blog:        { label: 'Guía Blog',                  group: 'Canales',   icon: Hash       },
  channel_newsletter:  { label: 'Guía Newsletter',            group: 'Canales',   icon: Hash       },
  channel_x:           { label: 'Guía X (Twitter)',           group: 'Canales',   icon: Hash       },
  market_spain_latam:  { label: 'Mercado España y LATAM',     group: 'Mercados',  icon: Globe2     },
  market_uk:           { label: 'Mercado Internacional',      group: 'Mercados',  icon: Globe2     },
  market_france:       { label: 'Mercado Francia',            group: 'Mercados',  icon: Globe2     },
  market_italy:        { label: 'Mercado Italia',             group: 'Mercados',  icon: Globe2     },
  market_portugal:     { label: 'Mercado Portugal',           group: 'Mercados',  icon: Globe2     },
  market_brasil:       { label: 'Mercado Brasil',             group: 'Mercados',  icon: Globe2     },
  market_mexico:       { label: 'Mercado México',             group: 'Mercados',  icon: Globe2     },
}

const GROUP_ORDER = ['Marca', 'Canales', 'Mercados']

// Limpia markers markdown del inicio de líneas para el preview (#, ##, -, *)
function previewText(content: string, maxChars = 200): string {
  const cleaned = content
    .split('\n')
    .map(l => l.replace(/^\s*(?:#{1,6}|[-*])\s*/, ''))
    .filter(l => l.trim().length > 0)
    .join(' ')
    .trim()
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars).trimEnd() + '…' : cleaned
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BrandContextEditor({ canEdit }: { canEdit: boolean }) {
  const [blocks, setBlocks] = useState<BrandContext[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<BrandContext | null>(null)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/brand-context')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as BrandContext[]
        if (!cancelled) setBlocks(data)
      } catch (e) {
        if (!cancelled) showToast(`Error cargando contexto: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, BrandContext[]>()
    for (const b of blocks) {
      const meta = KEY_META[b.key]
      const group = meta?.group ?? 'Otros'
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(b)
    }
    return map
  }, [blocks])

  const handleSaved = (updated: BrandContext) => {
    setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
    setSelectedBlock(updated)
    showToast(`"${KEY_META[updated.key]?.label ?? updated.key}" guardado`, 'success')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--ink-3)' }}>
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        <span className="text-[13px]">Cargando contexto de marca…</span>
      </div>
    )
  }

  if (blocks.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--ink-2)' }}>
        <p className="text-[14px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>
          No hay bloques de contexto todavía
        </p>
        <p className="text-[12px]">Ejecuta la migration 008 con seed para crear los 11 bloques iniciales.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        {GROUP_ORDER.map(groupName => {
          const groupBlocks = grouped.get(groupName) ?? []
          if (groupBlocks.length === 0) return null

          return (
            <div key={groupName}>
              <h3
                style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--ink-3)',
                  marginBottom: 12,
                }}
              >
                {groupName}
              </h3>
              <div className="flex flex-col gap-3">
                {groupBlocks.map(block => {
                  const meta = KEY_META[block.key]
                  const Icon = meta?.icon ?? Compass
                  return (
                    <BrandCard
                      key={block.id}
                      block={block}
                      icon={Icon}
                      label={meta?.label ?? block.key}
                      onClick={() => setSelectedBlock(block)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <BrandBlockModal
        block={selectedBlock}
        canEdit={canEdit}
        onClose={() => setSelectedBlock(null)}
        onSaved={handleSaved}
        onError={msg => showToast(msg, 'error')}
      />

      <Toasts items={toasts} remove={removeToast} />
    </>
  )
}

// ─── BrandCard (plegada) ─────────────────────────────────────────────────────

function BrandCard({
  block, icon: Icon, label, onClick,
}: {
  block: BrandContext
  icon: typeof Compass
  label: string
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      aria-label={`Editar ${label}`}
      className="group animate-fade-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.borderColor = 'var(--accent-border)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icono */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 32, height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
          }}
        >
          <Icon size={15} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              {label}
            </p>
            <p style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'var(--ink-3)' }}>
              {block.key} · {block.market}
            </p>
          </div>
          {/* Preview 2 líneas */}
          <p
            className="line-clamp-2"
            style={{
              fontSize: 12.5,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              marginTop: 6,
            }}
          >
            {previewText(block.content)}
          </p>
          {/* Footer meta */}
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              Actualizado {formatDate(block.updated_at)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
              {block.content.length.toLocaleString('es-ES')} chars
            </span>
          </div>
        </div>

        {/* Icono editar a la derecha (hint visual) */}
        <div
          className="shrink-0 self-start opacity-50 group-hover:opacity-100 transition-opacity"
          style={{
            width: 26, height: 26,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)',
          }}
          aria-hidden="true"
        >
          <Pencil size={12} />
        </div>
      </div>
    </div>
  )
}

// ─── BrandBlockModal (edición) ───────────────────────────────────────────────

function BrandBlockModal({
  block, canEdit, onClose, onSaved, onError,
}: {
  block: BrandContext | null
  canEdit: boolean
  onClose: () => void
  onSaved: (b: BrandContext) => void
  onError: (msg: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Sync draft al abrir / cambiar block (mirror de prop external)
  useEffect(() => {
    if (block) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(block.content)
      setSaveError(null)
      setJustSaved(false)
    }
  }, [block?.id, block?.content]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!block) return null

  const meta = KEY_META[block.key]
  const Icon = meta?.icon ?? Compass
  const isDirty = draft !== block.content

  const handleSave = async () => {
    if (!isDirty) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/brand-context/${block.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = j.error ?? res.statusText
        setSaveError(msg)
        onError(`Error: ${msg}`)
        return
      }
      const updated = await res.json() as BrandContext
      onSaved(updated)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1800)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      setSaveError(msg)
      onError(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    if (isDirty && !confirm('Hay cambios sin guardar. ¿Descartar?')) return
    onClose()
  }

  const lineCount = draft.split('\n').length

  return (
    <Modal open onClose={handleClose} title={meta?.label ?? block.key} size="lg">
      <div className="flex flex-col gap-4">
        {/* Header con icono + meta */}
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 36, height: 36,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-border)',
            }}
          >
            <Icon size={16} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--ink-3)' }}>
              {block.key} · market: {block.market}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              Actualizado {formatDate(block.updated_at)}
            </p>
          </div>
          {justSaved && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                fontSize: 11, fontWeight: 600,
                color: 'var(--green-2)', background: 'var(--green-soft)',
                padding: '3px 9px', borderRadius: 'var(--radius-sm)',
              }}
            >
              <Check size={11} aria-hidden="true" /> Guardado
            </span>
          )}
        </div>

        {/* Editor */}
        <div>
          <span className="section-label block mb-1.5">
            Contenido (markdown)
          </span>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={!canEdit || saving}
            className="input"
            style={{
              height: 'auto',
              minHeight: 320,
              maxHeight: '50vh',
              padding: 14,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
              lineHeight: 1.6,
              resize: 'vertical',
              whiteSpace: 'pre-wrap',
            }}
            rows={Math.min(24, Math.max(14, lineCount + 1))}
          />
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              Soporta Markdown: # H1, ## H2, **negrita**, - lista
            </span>
            <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {draft.length.toLocaleString('es-ES')} chars · {lineCount} líneas
            </span>
          </div>
        </div>

        {!canEdit && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--ink-2)',
            }}
          >
            🔒 Solo lectura. Solo admin y manager pueden editar el contexto de marca.
          </div>
        )}

        {saveError && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--red-soft)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--red-2)',
            }}
          >
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-3 flex-wrap gap-2"
          style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}
        >
          <button
            className="btn-secondary"
            onClick={handleClose}
            disabled={saving}
          >
            {isDirty ? 'Descartar y cerrar' : 'Cerrar'}
          </button>
          {canEdit && (
            <button
              className="btn-cta"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Guardando…</>
                : <><Save size={13} aria-hidden="true" /> Guardar cambios</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
