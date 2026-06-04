'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Save, Check, Compass, Mic, ShieldCheck, Hash, Globe2, BadgeX } from 'lucide-react'
import { useToast, Toasts } from '@/components/ui/Toast'
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
  market_uk:           { label: 'Mercado UK',                 group: 'Mercados',  icon: Globe2     },
}

const GROUP_ORDER = ['Marca', 'Canales', 'Mercados']

export function BrandContextEditor({ canEdit }: { canEdit: boolean }) {
  const [blocks, setBlocks] = useState<BrandContext[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({}) // id → current textarea value
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/brand-context')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as BrandContext[]
        if (cancelled) return
        setBlocks(data)
        // Initialise drafts
        const d: Record<string, string> = {}
        for (const b of data) d[b.id] = b.content
        setDrafts(d)
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

  const handleSave = async (block: BrandContext) => {
    const next = drafts[block.id]
    if (next === undefined || next === block.content) return
    setSavingId(block.id)
    try {
      const res = await fetch(`/api/brand-context/${block.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const updated = await res.json() as BrandContext
      setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
      setDrafts(prev => ({ ...prev, [updated.id]: updated.content }))
      setSavedFlash(updated.id)
      setTimeout(() => setSavedFlash(prev => prev === updated.id ? null : prev), 2000)
      showToast(`"${KEY_META[updated.key]?.label ?? updated.key}" guardado`, 'success')
    } finally {
      setSavingId(null)
    }
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
              <div className="grid grid-cols-1 gap-4">
                {groupBlocks.map(block => {
                  const meta = KEY_META[block.key]
                  const Icon = meta?.icon ?? Compass
                  const isDirty = drafts[block.id] !== block.content
                  const isSaving = savingId === block.id
                  const wasJustSaved = savedFlash === block.id

                  return (
                    <div
                      key={block.id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header del bloque */}
                      <div
                        className="flex items-center justify-between"
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            style={{
                              width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                              background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Icon size={13} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                              {meta?.label ?? block.key}
                            </p>
                            <p style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
                              {block.key} · {block.market}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            Actualizado {new Date(block.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {wasJustSaved && (
                            <span
                              className="inline-flex items-center gap-1"
                              style={{
                                fontSize: 11, fontWeight: 600,
                                color: 'var(--green-2)', background: 'var(--green-soft)',
                                padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <Check size={11} aria-hidden="true" /> Guardado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Textarea */}
                      <div style={{ padding: 16 }}>
                        <textarea
                          value={drafts[block.id] ?? ''}
                          onChange={e => setDrafts(prev => ({ ...prev, [block.id]: e.target.value }))}
                          className="input"
                          style={{
                            height: 'auto',
                            minHeight: 180,
                            padding: 12,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: 12.5,
                            lineHeight: 1.55,
                            resize: 'vertical',
                            whiteSpace: 'pre-wrap',
                          }}
                          rows={Math.max(8, (drafts[block.id] ?? '').split('\n').length + 1)}
                          disabled={!canEdit || isSaving}
                        />
                        {!canEdit && (
                          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                            Solo admin y manager pueden editar el contexto de marca.
                          </p>
                        )}
                      </div>

                      {/* Footer botones */}
                      {canEdit && (
                        <div
                          className="flex items-center justify-between"
                          style={{
                            padding: '10px 16px',
                            borderTop: '1px solid var(--border)',
                            background: 'var(--surface-2)',
                          }}
                        >
                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            {(drafts[block.id] ?? '').length} chars · {(drafts[block.id] ?? '').split('\n').length} líneas
                          </span>
                          <div className="flex items-center gap-2">
                            {isDirty && (
                              <button
                                className="btn-secondary"
                                onClick={() => setDrafts(prev => ({ ...prev, [block.id]: block.content }))}
                                disabled={isSaving}
                                style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                              >
                                Descartar
                              </button>
                            )}
                            <button
                              className="btn-cta"
                              onClick={() => handleSave(block)}
                              disabled={!isDirty || isSaving}
                              style={{ height: 28, fontSize: 11, padding: '0 12px' }}
                            >
                              {isSaving
                                ? <><Loader2 size={11} className="animate-spin" aria-hidden="true" /> Guardando…</>
                                : <><Save size={11} aria-hidden="true" /> Guardar</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <Toasts items={toasts} remove={removeToast} />
    </>
  )
}
