'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Sparkles, MoreHorizontal, Calendar,
  Lightbulb, PenLine, Layers, Zap, BarChart2,
  CheckCircle2, CheckCheck, ChevronRight, ArrowRight, Trash2,
  ImageIcon, RefreshCw, Loader2,
} from 'lucide-react'
import { cn, STAGE_CONFIG, STAGES } from '@/lib/utils'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import { Modal } from '@/components/ui/Modal'
import { ImageDrivePanel } from '@/components/pipeline/ImageDrivePanel'
import type { ContentItem, Stage, Channel } from '@/types/database'
import type { LucideIcon } from 'lucide-react'

/** Convierte un hex (#RRGGBB) a rgba con alpha [0,1]. */
const withAlpha = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STAGE_ICONS: Record<Stage, LucideIcon> = {
  ideas:     Lightbulb,
  copy:      PenLine,
  design:    Layers,
  scheduled: Zap,
  analyzed:  BarChart2,
}

const APPROVAL_STAGES: Stage[] = ['ideas', 'copy', 'design']

const MARKET_LABEL: Record<string, string> = {
  spain: 'ES', latam: 'LATAM', uk: 'UK', france: 'FR',
  italy: 'IT', portugal: 'PT', brasil: 'BR',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', in_progress: 'En progreso',
  approved: 'Aprobado',  rejected: 'Rechazado',
}

interface BoardProps {
  items:               ContentItem[]
  filterChannels:      Channel[]
  onAdd:               (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:              (id: string, newStage: Stage) => void
  onDelete:            (id: string) => void
  onApprove:           (id: string, currentStage: Stage) => void
  onItemUpdated?:      (item: ContentItem) => void
  itemImageMap?:       Record<string, { id: string; url: string }>
  onImageAssigned?:    (contentItemId: string, assetId: string, url: string) => void
  onImageUnassigned?:  (contentItemId: string) => void
}

// ─── StatusDot ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending:     '#6b7280',
  in_progress: '#f59e0b',
  approved:    '#10b981',
  rejected:    '#ef4444',
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#6b7280'
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', status === 'in_progress' && 'animate-pulse-dot')}
      style={{ background: color }}
    />
  )
}

// ─── CardMenu (lógica intacta) ───────────────────────────────────────────────

function CardMenu({ item, onMove }: { item: ContentItem; onMove: (id: string, s: Stage) => void }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const idx = STAGES.indexOf(item.stage as Stage)
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null
  const nextCfg = next ? STAGE_CONFIG[next] : null
  if (!next || !nextCfg) return null

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pos) { setPos(null); return }
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }

  return (
    <>
      <button
        ref={ref}
        onClick={toggle}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-opacity"
        aria-label="Más opciones"
      >
        <MoreHorizontal size={14} aria-hidden="true" className="text-[var(--ink-2)]" />
      </button>

      {mounted && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={e => { e.stopPropagation(); setPos(null) }} />
          <div
            className="fixed z-[9999] rounded-[var(--radius-md)] py-2 animate-scale-in min-w-[220px]"
            style={{
              top: pos.top, right: pos.right,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            }}
          >
            <button
              onClick={e => { e.stopPropagation(); onMove(item.id, next); setPos(null) }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[var(--accent-soft)] transition-colors"
              style={{ color: 'var(--ink)' }}
            >
              <ChevronRight size={13} style={{ color: nextCfg.accentHex, flexShrink: 0 }} aria-hidden="true" />
              <div>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.3 }}>Mover a</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{nextCfg.label}</p>
              </div>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ─── AddForm (lógica intacta) ────────────────────────────────────────────────

function AddForm({
  onAdd, onCancel,
}: {
  onAdd: (title: string, channel: Channel) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<Channel>('linkedin')
  const isValid = title.trim().length >= 3
  const submit = () => { if (isValid) onAdd(title.trim(), channel) }

  return (
    <div
      className="animate-fade-in rounded-[var(--radius-md)] p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Título del contenido..."
        className="input"
        style={{ height: 32, borderRadius: 'var(--radius-md)' }}
      />
      <select
        value={channel}
        onChange={e => setChannel(e.target.value as Channel)}
        className="input"
        style={{ height: 32, borderRadius: 'var(--radius-md)' }}
      >
        {(['linkedin','instagram','facebook','x','blog','email','newsletter'] as Channel[]).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost flex-1">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!isValid}
          className="btn-cta flex-1"
          style={{ height: 32 }}
        >
          Añadir
        </button>
      </div>
    </div>
  )
}

// ─── Detail Modal — rediseño completo según specs ────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="uppercase"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
        {children}
      </div>
    </div>
  )
}

// Chip uniforme para badges de estado (h 26, gap 6, mismo estilo base)
function StatusChip({
  variant, icon: Icon, children,
}: {
  variant: 'stage' | 'ai' | 'user' | 'warning'
  icon?: LucideIcon
  children: React.ReactNode
}) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    stage:   { bg: 'var(--accent-soft)',         color: 'var(--accent)',  border: '1px solid var(--accent-border)' },
    ai:      { bg: 'var(--surface-2)',           color: 'var(--ink-2)',   border: '1px solid var(--border)' },
    user:    { bg: 'var(--green-soft)',          color: 'var(--green-2)', border: '1px solid var(--green-border)' },
    warning: { bg: 'var(--amber-soft)',          color: 'var(--amber-2)', border: '1px solid var(--amber-border)' },
  }
  const s = styles[variant]
  return (
    <span
      className="inline-flex items-center"
      style={{
        height: 26,
        padding: '0 12px',
        gap: 6,
        background: s.bg,
        color: s.color,
        border: s.border,
        borderRadius: 'var(--radius-sm)',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  )
}

// Limpia markdown crudo al inicio de líneas: #, ##, ###, -, *
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function stripMarkdown(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/^\s*(?:#{1,6}|[-*])\s*/, ''))
    .join('\n')
    .trim()
}

function ContentDetailModal({
  item, imageUrl, imageId, onClose, onApprove, onMove, onDelete, onItemUpdated,
  onImageAssigned, onImageUnassigned,
}: {
  item:              ContentItem
  imageUrl:          string | null
  imageId:           string | null
  onClose:           () => void
  onApprove:         (id: string, s: Stage) => void
  onMove:            (id: string, s: Stage) => void
  onDelete:          (id: string) => void
  onItemUpdated?:    (item: ContentItem) => void
  onImageAssigned?:  (contentItemId: string, assetId: string, url: string) => void
  onImageUnassigned?: (contentItemId: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const stageCfg = STAGE_CONFIG[item.stage as Stage]
  const idx = STAGES.indexOf(item.stage as Stage)
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null
  const nextCfg = next ? STAGE_CONFIG[next] : null
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved

  // ── Generación / edición de contenido ──────────────────────────────────────
  const [editContent, setEditContent] = useState<string>(item.content ?? '')
  const [generating, setGenerating] = useState(false)
  const [savingContent, setSavingContent] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // Sync editContent cuando el item cambia (regenerar trae content nuevo) — mirror de prop
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditContent(item.content ?? '')
    setConfirmRegenerate(false)
  }, [item.id, item.content])

  const canGenerate = item.stage === 'ideas' || item.stage === 'copy'
  const isDirty = (editContent ?? '') !== (item.content ?? '')

  const handleGenerate = useCallback(async (regenerate = false) => {
    setGenError(null)
    setGenerating(true)
    try {
      const res = await fetch(`/api/content-items/${item.id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGenError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const data = await res.json() as { item: ContentItem }
      onItemUpdated?.(data.item)
      setConfirmRegenerate(false)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setGenerating(false)
    }
  }, [item.id, onItemUpdated])

  const handleSaveContent = useCallback(async () => {
    setSavingContent(true)
    try {
      const res = await fetch(`/api/content-items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGenError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const updated = await res.json() as ContentItem
      onItemUpdated?.(updated)
    } finally {
      setSavingContent(false)
    }
  }, [item.id, editContent, onItemUpdated])

  return (
    <Modal open onClose={onClose} title={item.title} size="lg">

      {/* ── Stepper — fases uniformes con icono + label ── */}
      <div className="flex items-start" style={{ marginBottom: 24 }}>
        {STAGES.map((s, i) => {
          const sCfg = STAGE_CONFIG[s]
          const SIcon = STAGE_ICONS[s]
          const isCurrent = s === item.stage
          const isDone = i < idx
          const isLast = i === STAGES.length - 1

          return (
            <div key={s} className="flex items-start flex-1 min-w-0">
              {/* Step itself */}
              <div
                className="flex flex-col items-center"
                style={{
                  flex: '0 0 auto',
                  width: 64,
                  opacity: isCurrent ? 1 : isDone ? 1 : 0.35,   // ← inactivos opacity 0.35
                }}
              >
                <div
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: 36, height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: isCurrent
                      ? sCfg.accentHex
                      : isDone
                      ? withAlpha(sCfg.accentHex, 0.12)
                      : 'var(--surface-2)',
                    border: `1px solid ${isCurrent ? sCfg.accentHex : isDone ? withAlpha(sCfg.accentHex, 0.33) : 'var(--border)'}`,
                    boxShadow: isCurrent ? `0 0 0 3px ${withAlpha(sCfg.accentHex, 0.13)}` : 'none',
                  }}
                >
                  <SIcon
                    aria-hidden="true"
                    size={16}
                    style={{
                      color: isCurrent ? '#ffffff' : isDone ? sCfg.accentHex : 'var(--ink-2)',
                    }}
                  />
                </div>
                <span
                  className="text-center"
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? 'var(--ink)' : isDone ? sCfg.accentHex : 'var(--ink-2)',
                    lineHeight: 1.3,
                    opacity: isCurrent ? 1 : isDone ? 1 : 0.5,
                  }}
                >
                  {sCfg.label.split(' ')[0]}
                </span>
              </div>

              {/* Connector line — height 1px */}
              {!isLast && (
                <div
                  className="flex-1"
                  style={{
                    height: 1,
                    background: isDone ? withAlpha(sCfg.accentHex, 0.33) : 'var(--border)',
                    marginTop: 17.5,
                    minWidth: 8,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Thumbnail imagen asignada (solo en stages sin ImageDrivePanel) ── */}
      {imageUrl && (item.stage === 'ideas' || item.stage === 'copy') && (
        <div
          style={{
            marginBottom: 20,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: 240,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Imagen asignada a ${item.title}`}
            style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {/* ── Chips de estado debajo del stepper — h26, gap8, mismo estilo base ── */}
      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 24 }}>
        <StatusChip variant="stage">{stageCfg.label}</StatusChip>
        {item.ai_generated && (
          <StatusChip variant="ai" icon={Sparkles}>Generado por IA</StatusChip>
        )}
        {item.human_approved && item.approved_by && (
          <StatusChip variant="user" icon={CheckCheck}>{item.approved_by}</StatusChip>
        )}
      </div>

      {/* ── Grid metadatos — 2 cols, gap 16x32 ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          rowGap: 16,
          columnGap: 32,
          padding: 20,
          marginBottom: 20,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <MetaRow label="Canal"><ChannelBadge channel={item.channel as Channel} /></MetaRow>
        <MetaRow label="Mercado">{MARKET_LABEL[item.market] ?? item.market}</MetaRow>
        <MetaRow label="Estado">
          <div className="flex items-center gap-2">
            <StatusDot status={item.status} />
            <span>{STATUS_LABELS[item.status] ?? item.status}</span>
          </div>
        </MetaRow>
        {item.campaign && <MetaRow label="Campaña">{item.campaign}</MetaRow>}
        <MetaRow label="Creado">
          {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
        </MetaRow>
        <MetaRow label="Actualizado">
          {new Date(item.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
        </MetaRow>
      </div>

      {/* ── Sección Contenido (con generación IA) ── */}
      <div
        style={{
          background: 'var(--surface-2)',
          padding: 16,
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <p
            className="uppercase"
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--ink-3)',
            }}
          >
            {item.content ? 'Contenido' : 'Propuesta'}
          </p>
          {item.ai_generated && item.content && (
            <span
              className="inline-flex items-center"
              style={{
                fontSize: 10, fontWeight: 600,
                gap: 4, padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-soft)',
                color: 'var(--accent-2)',
              }}
            >
              <Sparkles size={10} aria-hidden="true" /> IA
            </span>
          )}
        </div>

        {generating ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Generando con Gemini…
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-2)' }}>
              Aplicando proceso e instrucciones del content_type ({item.channel}).
            </p>
          </div>
        ) : item.content ? (
          /* Textarea editable + botones */
          <div className="flex flex-col gap-2">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={12}
              className="input"
              style={{
                height: 'auto',
                padding: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
                minHeight: 200,
                whiteSpace: 'pre-wrap',
              }}
              disabled={savingContent}
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                {confirmRegenerate ? (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, color: 'var(--red-2)' }}>
                      ¿Sobrescribir el contenido actual?
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => setConfirmRegenerate(false)}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn-destructive"
                      onClick={() => handleGenerate(true)}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      <RefreshCw size={11} aria-hidden="true" /> Sí, regenerar
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-pill-secondary"
                    onClick={() => setConfirmRegenerate(true)}
                    disabled={savingContent || generating}
                  >
                    <RefreshCw size={12} aria-hidden="true" /> Regenerar
                  </button>
                )}
              </div>
              <button
                className="btn-cta"
                onClick={handleSaveContent}
                disabled={!isDirty || savingContent || generating}
                style={{ height: 32, fontSize: 12 }}
              >
                {savingContent
                  ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Guardando…</>
                  : 'Guardar cambios'}
              </button>
            </div>
            {genError && (
              <p style={{ fontSize: 11, color: 'var(--red-2)', marginTop: 4 }}>
                Error: {genError}
              </p>
            )}
          </div>
        ) : (
          /* Empty state — botón Generar IA si la fase aplica */
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: 'var(--ink)', marginBottom: 12 }}>
              {item.title}
            </p>
            {canGenerate ? (
              <div className="flex flex-col items-start gap-2">
                <button className="btn-cta" onClick={() => handleGenerate(false)}>
                  <Sparkles size={13} aria-hidden="true" />
                  Generar contenido con IA
                </button>
                <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  Usará el content_type activo del canal <strong>{item.channel}</strong> con Gemini (8-30s).
                </p>
                {genError && (
                  <p style={{ fontSize: 11, color: 'var(--red-2)' }}>
                    Error: {genError}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Sección Visual — siempre visible en design / scheduled / analyzed ── */}
      {(item.stage === 'design' || item.stage === 'scheduled' || item.stage === 'analyzed') && (
        <div
          style={{
            background: 'var(--surface-2)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}
        >
          <p
            className="uppercase"
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--ink-3)', marginBottom: 12,
            }}
          >
            Visual
          </p>
          <ImageDrivePanel
            itemId={item.id}
            itemTitle={item.title}
            channel={item.channel as Channel}
            assignedImageId={imageId}
            assignedImageUrl={imageUrl}
            onAssigned={(assetId, url) => { onImageAssigned?.(item.id, assetId, url) }}
            onUnassigned={() => { onImageUnassigned?.(item.id) }}
          />
        </div>
      )}

      {/* ── Clarity — chip verde según specs ── */}
      {item.clarity_pass !== null && (
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '12px 14px',
            marginBottom: 16,
            background: item.clarity_pass ? 'var(--green-soft)' : 'var(--amber-soft)',
            border: `1px solid ${item.clarity_pass ? 'var(--green-border)' : 'var(--amber-border)'}`,
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 22, height: 22,
              borderRadius: '50%',
              background: item.clarity_pass ? 'rgba(52,199,89,0.20)' : 'rgba(255,159,10,0.20)',
            }}
          >
            <CheckCircle2 size={13} aria-hidden="true" style={{ color: item.clarity_pass ? 'var(--green-2)' : 'var(--amber-2)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: item.clarity_pass ? 'var(--green-2)' : 'var(--amber-2)',
                lineHeight: 1.3,
              }}
            >
              Clarity {item.clarity_pass ? 'OK' : 'requiere revisión'}
            </p>
            {item.clarity_summary && (
              <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>
                {item.clarity_summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Scheduled ── */}
      {item.scheduled_at && (
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '12px 14px',
            marginBottom: 16,
            background: 'var(--amber-soft)',
            border: '1px solid var(--amber-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Calendar size={16} aria-hidden="true" className="shrink-0" style={{ color: 'var(--amber-2)' }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber-2)', lineHeight: 1.3 }}>
              Programado vía PostiZ
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* ── Footer — border-top, Eliminar outline izq + Mover CTA der ── */}
      <div
        className="flex items-center"
        style={{
          gap: 10,
          paddingTop: 16,
          marginTop: 8,
          borderTop: '1px solid var(--border)',
        }}
      >
        {confirmDelete ? (
          <>
            <p style={{ fontSize: 13, flex: 1, color: 'var(--ink-2)' }}>
              ¿Eliminar definitivamente?
            </p>
            <button
              onClick={() => { onDelete(item.id); onClose() }}
              className="transition-colors"
              style={{
                height: 36,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                background: 'var(--red)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
              }}
            >
              Sí, eliminar
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="transition-colors"
              style={{
                height: 36,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--ink)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            {/* Eliminar — rojo outline izquierda */}
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center transition-colors"
              style={{
                gap: 6,
                height: 36,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--red)',
                background: 'transparent',
                border: '1px solid rgba(255,59,48,0.30)',
                borderRadius: 'var(--radius-pill)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-soft)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Trash2 size={13} aria-hidden="true" /> Eliminar
            </button>

            <div style={{ flex: 1 }} />

            {/* Mover a X — CTA primario derecha */}
            {needsApproval ? (
              <button
                onClick={() => { onApprove(item.id, item.stage as Stage); onClose() }}
                className="btn-cta"
              >
                <CheckCircle2 size={14} aria-hidden="true" /> Aprobar y avanzar
              </button>
            ) : next && nextCfg ? (
              <button
                onClick={() => { onMove(item.id, next); onClose() }}
                className="btn-cta"
              >
                Mover a {nextCfg.label} <ArrowRight size={13} aria-hidden="true" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD — specs exactas del producto
// ═══════════════════════════════════════════════════════════════════════════

function Card({
  item, hasImage, onMove, onApprove, onSelect, onGenerateImage,
}: {
  item: ContentItem
  hasImage?: boolean
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onSelect: (item: ContentItem) => void
  onGenerateImage?: (itemId: string, title: string, channel: Channel) => Promise<void>
}) {
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved
  const [generatingImage, setGeneratingImage] = useState(false)

  // Iniciales del responsable
  const initials = item.human_approved && item.approved_by
    ? item.approved_by.slice(0, 2).toUpperCase()
    : null

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalle de ${item.title}`}
      className="pcard group animate-fade-up cursor-pointer flex flex-col"
      data-channel={item.channel}
      style={{ gap: 10 }}
      onClick={() => onSelect(item)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(item)
        }
      }}
    >
      {/* ── Fila superior: badge canal + (icono imagen) + ES + status dot + menu ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChannelBadge channel={item.channel as Channel} />
          {hasImage && (
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{
                width: 18, height: 18,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                color: 'var(--accent-2)',
              }}
              title="Tiene imagen asignada"
              aria-label="Tiene imagen asignada"
            >
              <ImageIcon size={11} aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              fontWeight: 500,
            }}
          >
            {MARKET_LABEL[item.market] ?? item.market.toUpperCase()}
          </span>
          <StatusDot status={item.status} />
          <div onClick={e => e.stopPropagation()}>
            <CardMenu item={item} onMove={onMove} />
          </div>
        </div>
      </div>

      {/* ── Título ── */}
      <h3
        className="line-clamp-2"
        style={{
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.45,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}
      >
        {item.title}
        {item.ai_generated && !initials && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--ink-3)',
              letterSpacing: 0,
              marginLeft: 4,
              whiteSpace: 'nowrap',
            }}
          >
            · Generado por IA
          </span>
        )}
      </h3>

      {/* ── Fila inferior — solo si hay autor aprobado o fecha programada ── */}
      {(initials || item.scheduled_at) && (
        <div
          className="flex items-center justify-between gap-3"
          style={{ marginTop: 8 }}
        >
          {/* Avatar+nombre del responsable */}
          {initials ? (
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="shrink-0 flex items-center justify-center rounded-full"
                style={{
                  width: 22, height: 22,
                  fontSize: 10, fontWeight: 700,
                  color: 'var(--green-2)',
                  background: 'var(--green-soft)',
                  border: '1px solid var(--green-border)',
                }}
              >
                {initials}
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {item.approved_by}
              </span>
            </div>
          ) : (
            <div />
          )}

          {/* Chip "Aprobado" — pill verde Apple */}
          {item.human_approved && (
            <span
              className="inline-flex items-center shrink-0"
              style={{
                gap: 4,
                height: 20,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 'var(--radius-pill)',
                color: 'var(--green-2)',
                background: 'var(--green-soft)',
                border: '1px solid var(--green-border)',
                lineHeight: 1,
              }}
            >
              <CheckCheck size={11} aria-hidden="true" /> Aprobado
            </span>
          )}

          {/* Fecha programada — pill ámbar Apple */}
          {item.scheduled_at && !item.human_approved && (
            <span
              className="inline-flex items-center shrink-0"
              style={{
                gap: 5,
                height: 20,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 'var(--radius-pill)',
                color: 'var(--amber-2)',
                background: 'var(--amber-soft)',
                border: '1px solid var(--amber-border)',
                lineHeight: 1,
              }}
            >
              <Calendar size={10} aria-hidden="true" />
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short',
              })}
            </span>
          )}
        </div>
      )}

      {/* ── Botón Aprobar y avanzar ── */}
      {needsApproval && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id, item.stage as Stage) }}
          className="btn-pill-ghost"
          style={{ marginTop: 8 }}
        >
          Aprobar y avanzar
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      )}

      {/* ── Botón Generar imagen — siempre visible en design ── */}
      {item.stage === 'design' && onGenerateImage && (
        <button
          onClick={e => {
            e.stopPropagation()
            setGeneratingImage(true)
            onGenerateImage(item.id, item.title, item.channel as Channel)
              .finally(() => setGeneratingImage(false))
          }}
          disabled={generatingImage}
          className="btn-pill-ghost"
          style={{ marginTop: needsApproval ? 4 : 8 }}
        >
          {generatingImage ? (
            <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Generando imagen…</>
          ) : hasImage ? (
            <><RefreshCw size={12} aria-hidden="true" /> Regenerar imagen</>
          ) : (
            <><ImageIcon size={12} aria-hidden="true" /> Generar imagen con IA</>
          )}
        </button>
      )}
    </article>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN — cabecera grande, fondo diferenciado, gap 16px
// ═══════════════════════════════════════════════════════════════════════════

function Column({
  stage, items, filterChannels, onAdd, onMove, onApprove, onSelectItem, index, itemImageMap, onGenerateImage,
}: {
  stage: Stage
  items: ContentItem[]
  filterChannels: Channel[]
  onAdd: (s: Stage, data: { title: string; channel: Channel }) => void
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onSelectItem: (item: ContentItem) => void
  index: number
  itemImageMap?: Record<string, { id: string; url: string }>
  onGenerateImage?: (itemId: string, title: string, channel: Channel) => Promise<void>
}) {
  const cfg = STAGE_CONFIG[stage]
  const Icon = STAGE_ICONS[stage]
  const [showAddForm, setShowAddForm] = useState(false)

  const filtered = filterChannels.length === 0
    ? items
    : items.filter(i => filterChannels.includes(i.channel as Channel))

  return (
    <section
      className="pipeline-column animate-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* ── Cabecera con separación visual del stack de cards ── */}
      <header
        className="shrink-0"
        style={{
          marginBottom: 8,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 20,
              height: 20,
              background: filtered.length > 0 ? withAlpha(cfg.accentHex, 0.10) : 'transparent',
              border: filtered.length > 0 ? `1px solid ${withAlpha(cfg.accentHex, 0.25)}` : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Icon
              aria-hidden="true"
              size={11}
              style={{ color: filtered.length > 0 ? cfg.accentHex : 'var(--ink-3)' }}
            />
          </div>
          <h2
            className="flex-1 truncate"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: 0,
            }}
          >
            {cfg.label}
          </h2>
          {/* Contador neutro */}
          <span
            className="inline-flex items-center justify-center tabular-nums shrink-0"
            style={{
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--ink-2)',
              background: 'rgba(0,0,0,0.05)',
              lineHeight: 1.4,
            }}
          >
            {filtered.length}
          </span>
          {/* Chip AUTO */}
          {cfg.automatic && (
            <span
              className="inline-flex items-center gap-1 shrink-0"
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '0 6px',
                height: 18,
                lineHeight: 1,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--green-2)',
                background: 'var(--green-soft)',
                border: '1px solid var(--green-border)',
              }}
            >
              <Zap size={8} aria-hidden="true" /> AUTO
            </span>
          )}
        </div>
      </header>

      {/* ── Stack de cards — gap 6px ── */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(item => (
          <Card
            key={item.id}
            item={item}
            hasImage={Boolean(itemImageMap?.[item.id])}
            onMove={onMove}
            onApprove={onApprove}
            onSelect={onSelectItem}
            onGenerateImage={onGenerateImage}
          />
        ))}

        {cfg.automatic ? (
          <div
            className="w-full flex items-center justify-center gap-1.5 px-3 py-3 rounded-[var(--radius-md)] text-[11.5px] font-medium"
            style={{ border: '1px dashed var(--border-soft)', color: 'var(--ink-3)', opacity: 0.7 }}
          >
            <Zap size={12} aria-hidden="true" /> PostiZ automático
          </div>
        ) : showAddForm ? (
          <AddForm
            onAdd={(title, channel) => { onAdd(stage, { title, channel }); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[var(--radius-md)] text-[12px] font-medium transition-all"
            style={{ border: '1px dashed var(--border-soft)', color: 'var(--ink-2)' }}
            onMouseEnter={e => {
              e.currentTarget.style.color       = cfg.accentHex
              e.currentTarget.style.borderColor = withAlpha(cfg.accentHex, 0.33)
              e.currentTarget.style.background  = withAlpha(cfg.accentHex, 0.024)
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color       = 'var(--ink-2)'
              e.currentTarget.style.borderColor = 'var(--border-soft)'
              e.currentTarget.style.background  = 'transparent'
            }}
          >
            <Plus size={13} /> Añadir tarjeta
          </button>
        )}
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD — scroll horizontal funcional, gap 16px entre columnas
// ═══════════════════════════════════════════════════════════════════════════

export function PipelineBoard({ items, filterChannels, onAdd, onMove, onDelete, onApprove, onItemUpdated, itemImageMap, onImageAssigned, onImageUnassigned }: BoardProps) {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  // Sincroniza selectedItem con la última versión cuando items se actualiza
  useEffect(() => {
    if (!selectedItem) return
    const updated = items.find(i => i.id === selectedItem.id) ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (updated !== selectedItem) setSelectedItem(updated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Genera imagen desde la tarjeta directamente (sin abrir modal)
  const handleGenerateImageForCard = useCallback(async (itemId: string, title: string, channel: Channel) => {
    try {
      const genRes = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: title, aspectRatio: '1:1', channel }),
      })
      if (!genRes.ok) return
      const { id, url } = await genRes.json() as { id: string; url: string }
      await fetch(`/api/images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: itemId }),
      })
      onImageAssigned?.(itemId, id, url)
    } catch {
      // silencia errores — el usuario puede intentarlo desde el modal
    }
  }, [onImageAssigned])

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = items.filter(i => i.stage === s)
    return acc
  }, {} as Record<Stage, ContentItem[]>)

  return (
    <>
      <div className="pipeline-board">
        {STAGES.map((stage, idx) => (
          <Column
            key={stage}
            stage={stage}
            items={byStage[stage]}
            filterChannels={filterChannels}
            onAdd={onAdd}
            onMove={onMove}
            onApprove={onApprove}
            onSelectItem={setSelectedItem}
            index={idx}
            itemImageMap={itemImageMap}
            onGenerateImage={handleGenerateImageForCard}
          />
        ))}
      </div>

      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          imageUrl={itemImageMap?.[selectedItem.id]?.url ?? null}
          imageId={itemImageMap?.[selectedItem.id]?.id ?? null}
          onClose={() => setSelectedItem(null)}
          onApprove={(id, s) => { onApprove(id, s) }}
          onMove={(id, s)    => { onMove(id, s) }}
          onDelete={(id)     => { onDelete(id); setSelectedItem(null) }}
          onItemUpdated={(updated) => {
            setSelectedItem(updated)
            onItemUpdated?.(updated)
          }}
          onImageAssigned={onImageAssigned}
          onImageUnassigned={onImageUnassigned}
        />
      )}
    </>
  )
}
