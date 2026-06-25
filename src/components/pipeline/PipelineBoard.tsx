'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Sparkles, MoreHorizontal, Calendar,
  Lightbulb, PenLine, Layers, Zap, BarChart2,
  CheckCircle2, CheckCheck, ChevronRight, ArrowRight, ArrowLeft, Trash2,
  ImageIcon, RefreshCw, Loader2, X,
} from 'lucide-react'
import { STAGE_CONFIG, STAGES } from '@/lib/utils'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import { Modal } from '@/components/ui/Modal'
import { ImageDrivePanel } from '@/components/pipeline/ImageDrivePanel'
import { ExportContentMenu } from '@/components/pipeline/ExportContentMenu'
import { MentionPicker } from '@/components/pipeline/MentionPicker'
import { PostizPublishButton } from '@/components/pipeline/PostizPublishButton'
import { PostizStateBanner } from '@/components/pipeline/PostizStateBanner'
import { ContentTypeEditor } from '@/components/pipeline/ContentTypeEditor'
import { ReplicateMarketsButton } from '@/components/pipeline/ReplicateMarketsButton'
import {
  getMarketTimezone, MARKET_TZ_LABEL, marketLocalToUtcISO, utcISOToMarketLocal, formatInTimezone,
} from '@/lib/market-timezones'
import { MARKET_CONFIG, MARKET_LABELS } from '@/lib/utils'
import type { ContentItem, Stage, Channel, Market } from '@/types/database'
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
  approval:  CheckCircle2,
  scheduled: Zap,
  analyzed:  BarChart2,
}

// Estado visible (texto + color) según status + human_approved.
// Prioridad: rejected > approved > in_progress > pending.
function displayStatus(item: ContentItem): { label: string; bg: string; color: string; border: string } {
  // Colores de texto OSCUROS y saturados: la app es light mode, así que los
  // chips usan fondo translúcido claro + texto oscuro para cumplir contraste (WCAG AA).
  if (item.status === 'rejected') {
    return { label: 'Rechazado', bg: 'rgba(239,68,68,0.12)', color: '#c0392b', border: '1px solid rgba(239,68,68,0.30)' }
  }
  if (item.human_approved) {
    return { label: 'Aprobado', bg: 'rgba(16,185,129,0.14)', color: '#1a7a36', border: '1px solid rgba(16,185,129,0.32)' }
  }
  if (item.status === 'in_progress') {
    return { label: 'En revisión', bg: 'rgba(245,158,11,0.14)', color: '#b25000', border: '1px solid rgba(245,158,11,0.32)' }
  }
  return { label: 'Pendiente', bg: 'rgba(107,114,128,0.14)', color: '#4b5563', border: '1px solid rgba(107,114,128,0.32)' }
}

// Solo en la etapa 'approval' se marca human_approved=true. En el resto (ideas/copy/design)
// el botón "Avanzar a [next]" mueve de stage sin marcar aprobación formal.
const APPROVAL_STAGES: Stage[] = ['approval']

// Etiquetas de mercado: nombre completo en MARKET_LABELS (modales, metadatos),
// abreviatura en MARKET_CONFIG[m].abbr (chips de cards estrechos). Fuente única
// en @/lib/utils — ya no se redefinen localmente para evitar drift entre vistas.

interface BoardProps {
  items:               ContentItem[]
  filterChannels:      Channel[]
  onAdd:               (stage: Stage, data: { title: string; channel: Channel; contentTypeId: string | null }) => void
  onMove:              (id: string, newStage: Stage) => void
  onDelete:            (id: string) => void
  onApprove:           (id: string, currentStage: Stage) => void
  onReject:            (id: string) => void
  onItemUpdated?:      (item: ContentItem) => void
  itemImageMap?:       Record<string, { id: string; url: string }>
  onImageAssigned?:    (contentItemId: string, assetId: string, url: string) => void
  onImageUnassigned?:  (contentItemId: string) => void
  profilesById?:       Record<string, { full_name: string | null; email: string }>
}

/**
 * Resuelve un UUID de usuario a un display name legible.
 * Prioridad: full_name > parte local del email > "Usuario".
 */
function resolveUserName(
  userId: string | null,
  profilesById?: Record<string, { full_name: string | null; email: string }>,
): string {
  if (!userId) return ''
  const p = profilesById?.[userId]
  if (!p) return ''  // se mostrará "Usuario" en el lugar de uso
  if (p.full_name && p.full_name.trim()) return p.full_name.trim()
  if (p.email) return p.email.split('@')[0]
  return ''
}

/** Iniciales (2 caracteres) a partir de un nombre legible. */
function nameInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
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
  const prev = idx > 0 ? STAGES[idx - 1] : null
  const prevCfg = prev ? STAGE_CONFIG[prev] : null
  // Misma regla que en el modal: no retroceder si hay post activo en Postiz
  // (postiz_id) — habría que cancelarlo primero para no dejar fantasmas.
  // Si publish_state='failed', el post NO está activo en la red social (la
  // publicación falló), así que se permite retroceder directamente sin
  // obligar a un "Cancelar publicación" superfluo.
  const hasActivePostizPost = !!item.postiz_id && item.publish_state !== 'failed'
  const canGoBack = !!prev && !!prevCfg && !prevCfg.automatic && !hasActivePostizPost
  // Si no hay adelante NI atrás, no mostramos menú.
  if ((!next || !nextCfg) && !canGoBack) return null

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
          <div className="fixed inset-0 z-[60]" onClick={e => { e.stopPropagation(); setPos(null) }} />
          <div
            className="fixed z-[61] rounded-[var(--radius-md)] py-2 animate-scale-in min-w-[220px]"
            style={{
              top: pos.top, right: pos.right,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            }}
          >
            {next && nextCfg && (
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
            )}
            {canGoBack && prev && prevCfg && (
              <button
                onClick={e => { e.stopPropagation(); onMove(item.id, prev); setPos(null) }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-[var(--surface-2)] transition-colors"
                style={{ color: 'var(--ink)' }}
              >
                <ArrowLeft size={13} style={{ color: prevCfg.accentHex, flexShrink: 0 }} aria-hidden="true" />
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.3 }}>Volver a</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{prevCfg.label}</p>
                </div>
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ─── AddForm ─────────────────────────────────────────────────────────────────

function AddForm({
  onAdd, onCancel,
}: {
  onAdd: (title: string, channel: Channel, contentTypeId: string | null) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<Channel>('linkedin')
  // Subtipos del canal (Post, Carrusel, Stories…) gestionados en admin.
  // Cargamos los activos del canal seleccionado cada vez que cambia.
  const [contentTypes, setContentTypes] = useState<{ id: string; name: string }[]>([])
  const [contentTypeId, setContentTypeId] = useState<string>('') // '' = sin elegir → fallback en servidor
  const [loadingTypes, setLoadingTypes] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingTypes(true)
    setContentTypeId('')
    fetch(`/api/content-types?channel=${encodeURIComponent(channel)}&active=true`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: { id: string; name: string }[]) => {
        if (cancelled) return
        setContentTypes(Array.isArray(rows) ? rows.map(r => ({ id: r.id, name: r.name })) : [])
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof Error && e.name === 'AbortError')) return
        setContentTypes([])
      })
      .finally(() => { if (!cancelled) setLoadingTypes(false) })
    return () => { cancelled = true; controller.abort() }
  }, [channel])

  const isValid = title.trim().length >= 3
  const submit = () => {
    if (!isValid) return
    onAdd(title.trim(), channel, contentTypeId || null)
  }

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
        aria-label="Canal"
        style={{ height: 32, borderRadius: 'var(--radius-md)' }}
      >
        {(['linkedin','instagram','facebook','x','blog','email','newsletter'] as Channel[]).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {/* Tipo de contenido — subtipos creados en admin → /content-types */}
      <select
        value={contentTypeId}
        onChange={e => setContentTypeId(e.target.value)}
        className="input"
        aria-label="Tipo de contenido"
        disabled={loadingTypes || contentTypes.length === 0}
        title={
          contentTypes.length === 0
            ? `No hay subtipos para ${channel}. Crea uno en Admin → Tipos de contenido.`
            : 'Elige el subtipo (Post, Carrusel, Stories…) para que las plantillas creativas coincidan exactamente.'
        }
        style={{ height: 32, borderRadius: 'var(--radius-md)' }}
      >
        <option value="">
          {loadingTypes
            ? 'Cargando tipos…'
            : contentTypes.length === 0
              ? `Sin tipos para ${channel} (gestionar en admin)`
              : 'Tipo de contenido (opcional)'}
        </option>
        {contentTypes.map(ct => (
          <option key={ct.id} value={ct.id}>{ct.name}</option>
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
        whiteSpace: 'nowrap',
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
  item, imageUrl, imageId, onClose, onApprove, onReject, onMove, onDelete, onItemUpdated,
  onImageAssigned, onImageUnassigned, profilesById,
}: {
  item:              ContentItem
  imageUrl:          string | null
  imageId:           string | null
  onClose:           () => void
  onApprove:         (id: string, s: Stage) => void
  onReject:          (id: string) => void
  onMove:            (id: string, s: Stage) => void
  onDelete:          (id: string) => void
  onItemUpdated?:    (item: ContentItem) => void
  onImageAssigned?:  (contentItemId: string, assetId: string, url: string) => void
  onImageUnassigned?: (contentItemId: string) => void
  profilesById?:     Record<string, { full_name: string | null; email: string }>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const stageCfg = STAGE_CONFIG[item.stage as Stage]
  const idx = STAGES.indexOf(item.stage as Stage)
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null
  const nextCfg = next ? STAGE_CONFIG[next] : null
  // Stage anterior (para el botón "Volver a …"). Solo válido si:
  //   - existe un stage previo no automático, Y
  //   - el item no tiene un post ACTIVO en Postiz (postiz_id + publish_state
  //     != 'failed'). Si publish_state='failed' el post no está realmente
  //     en la red social, así que retroceder es seguro sin cancelar antes.
  const prev = idx > 0 ? STAGES[idx - 1] : null
  const prevCfg = prev ? STAGE_CONFIG[prev] : null
  const hasActivePostizPost = !!item.postiz_id && item.publish_state !== 'failed'
  const canGoBack = !!prev && !!prevCfg && !prevCfg.automatic && !hasActivePostizPost
  const isApprovalStage = APPROVAL_STAGES.includes(item.stage as Stage)
  const needsApproval = isApprovalStage && !item.human_approved
  const canAdvanceWithoutApproval = !isApprovalStage && !!next && !stageCfg.automatic
  const missingDateForApproval = needsApproval && !item.scheduled_at
  const isRejected = item.status === 'rejected'

  // ── Generación / edición de contenido ──────────────────────────────────────
  const [editContent, setEditContent] = useState<string>(item.content ?? '')
  const [generating, setGenerating] = useState(false)
  const [savingContent, setSavingContent] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [regenInstructions, setRegenInstructions] = useState('')
  const [genError, setGenError] = useState<string | null>(null)
  // Ref al textarea para insertar @menciones en la posición del cursor.
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  /**
   * Inserta `text` en la posición actual del caret del textarea de contenido.
   * Si no hay caret (textarea sin foco), añade al final con un separador.
   * Reposiciona el caret justo después del texto insertado.
   */
  const insertIntoContent = useCallback((text: string) => {
    const ta = contentTextareaRef.current
    if (!ta) {
      setEditContent(prev => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + text)
      return
    }
    const start = ta.selectionStart ?? ta.value.length
    const end   = ta.selectionEnd ?? ta.value.length
    const before = ta.value.slice(0, start)
    const after  = ta.value.slice(end)
    // Asegura un espacio antes/después si no lo hay para que la mención no quede pegada.
    const needsLead  = before.length > 0 && !/\s$/.test(before)
    const needsTrail = after.length > 0 && !/^\s/.test(after)
    const insertion  = `${needsLead ? ' ' : ''}${text}${needsTrail ? ' ' : ''}`
    const next = before + insertion + after
    setEditContent(next)
    // Reposicionar caret tras el texto insertado en el siguiente tick (post-render).
    const caretPos = before.length + insertion.length
    requestAnimationFrame(() => {
      ta.focus()
      try { ta.setSelectionRange(caretPos, caretPos) } catch {}
    })
  }, [])

  // ── Edición de título inline ──────────────────────────────────────────────
  // Útil sobre todo para items ya programados/publicados, donde antes el título
  // solo se mostraba como texto en la cabecera del Modal.
  const [editTitle, setEditTitle] = useState<string>(item.title ?? '')
  const [savingTitle, setSavingTitle] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const isTitleDirty = editTitle.trim() !== (item.title ?? '').trim() && editTitle.trim().length > 0

  const handleSaveTitle = useCallback(async () => {
    if (!isTitleDirty) return
    setSavingTitle(true)
    setTitleError(null)
    try {
      const res = await fetch(`/api/content-items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setTitleError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const updated = await res.json() as ContentItem
      onItemUpdated?.(updated)
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setSavingTitle(false)
    }
  }, [item.id, editTitle, isTitleDirty, onItemUpdated])

  // ── Fecha de publicación editable (hora local del MERCADO) ────────────────
  // La hora que el usuario introduce en el datetime-local se interpreta en el
  // huso del mercado del item (Madrid para ES, Bogotá para LATAM, etc.), no
  // del navegador. Persistimos siempre como UTC ISO.
  const itemMarket = item.market as Market
  const marketTz = getMarketTimezone(itemMarket)
  const marketCity = MARKET_TZ_LABEL[itemMarket] ?? marketTz
  const [editScheduledAt, setEditScheduledAt] = useState<string>(
    () => utcISOToMarketLocal(item.scheduled_at, itemMarket),
  )
  const [scheduledError, setScheduledError] = useState<string | null>(null)

  const handleSaveScheduledAt = useCallback(async (val: string) => {
    setScheduledError(null)
    const isoVal = marketLocalToUtcISO(val, itemMarket)
    // Si el usuario escribió una fecha que no se puede interpretar, avisamos
    // en vez de guardar null silenciosamente.
    if (val && isoVal === null) {
      setScheduledError('Fecha no válida')
      return
    }
    const current = item.scheduled_at ?? null
    if (isoVal === current) return
    try {
      const res = await fetch(`/api/content-items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: isoVal }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setScheduledError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const updated = await res.json() as ContentItem
      onItemUpdated?.(updated)
      window.dispatchEvent(new CustomEvent('pipeline:changed'))
    } catch (e) {
      setScheduledError(e instanceof Error ? e.message : 'Error de red')
    }
  }, [item.id, item.scheduled_at, itemMarket, onItemUpdated])

  // Sync editContent cuando el item cambia (regenerar trae content nuevo) — mirror de prop
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditContent(item.content ?? '')
    setConfirmRegenerate(false)
  }, [item.id, item.content])

  // Sync editTitle cuando el item cambia desde fuera
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditTitle(item.title ?? '')
    setTitleError(null)
  }, [item.id, item.title])

  // Reset del panel de regenerar (brief + confirm) cuando el item cambia:
  // sin esto, al navegar de item A a item B el textarea conservaría el brief
  // escrito en A, confundiendo al usuario.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRegenInstructions('')
    setConfirmRegenerate(false)
  }, [item.id])

  // Sync editScheduledAt cuando el item cambia desde fuera. Reinterpretamos
  // el ISO en el TZ del mercado del item por si el market también cambió.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditScheduledAt(utcISOToMarketLocal(item.scheduled_at, itemMarket))
    setScheduledError(null)
  }, [item.id, item.scheduled_at, itemMarket])

  const canGenerate = item.stage === 'ideas' || item.stage === 'copy'
  const isDirty = (editContent ?? '') !== (item.content ?? '')

  const handleGenerate = useCallback(async (regenerate = false, extraInstructions = '') => {
    setGenError(null)
    setGenerating(true)
    try {
      const res = await fetch(`/api/content-items/${item.id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate, extraInstructions: extraInstructions.trim() || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGenError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const data = await res.json() as { item: ContentItem }
      onItemUpdated?.(data.item)
      setConfirmRegenerate(false)
      setRegenInstructions('')
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

      {/* ── Editor de título inline ──
         Antes el título solo aparecía como texto en la cabecera del Modal.
         Lo hacemos editable para que se pueda corregir incluso en items ya
         programados / publicados (cumple sugerencia "modificar publicación"). */}
      <div style={{ marginBottom: 16 }}>
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
          Título
        </p>
        <div className="flex items-center gap-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input"
            style={{ flex: 1, height: 36, fontSize: 14, fontWeight: 600 }}
            disabled={savingTitle}
            placeholder="Título del contenido"
          />
          {isTitleDirty && (
            <button
              className="btn-cta"
              onClick={handleSaveTitle}
              disabled={savingTitle}
              style={{ height: 36, fontSize: 12 }}
            >
              {savingTitle
                ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Guardando…</>
                : 'Guardar'}
            </button>
          )}
        </div>
        {titleError && (
          <p style={{ fontSize: 11, color: 'var(--red-2)', marginTop: 4 }}>
            Error: {titleError}
          </p>
        )}
      </div>

      {/* ── Banner informativo para publicaciones ya programadas / enviadas ── */}
      {(item.stage === 'scheduled' || item.stage === 'analyzed' || item.published_at) && (
        <PostizStateBanner
          item={item}
          onCancelled={(unlinkedItemId) => {
            if (!unlinkedItemId) return
            onItemUpdated?.({
              ...item,
              postiz_id: null,
              published_at: null,
              publish_state: null,
              publish_error: null,
            } as ContentItem)
          }}
        />
      )}

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
          <StatusChip variant="user" icon={CheckCheck}>
            {resolveUserName(item.approved_by, profilesById) || 'Usuario'}
          </StatusChip>
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
        <MetaRow label="Mercado">{MARKET_LABELS[item.market] ?? item.market}</MetaRow>
        <MetaRow label="Tipo de contenido">
          <ContentTypeEditor item={item} onUpdated={(updated) => onItemUpdated?.(updated)} />
        </MetaRow>
        <MetaRow label="Estado">
          {(() => {
            const ds = displayStatus(item)
            return (
              <span
                className="inline-flex items-center"
                style={{
                  height: 22,
                  padding: '0 10px',
                  gap: 5,
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  background: ds.bg,
                  color: ds.color,
                  border: ds.border,
                }}
              >
                {ds.label}
              </span>
            )
          })()}
        </MetaRow>
        {item.campaign && <MetaRow label="Campaña">{item.campaign}</MetaRow>}
        <MetaRow label="Creado">
          {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
        </MetaRow>
        <MetaRow label="Actualizado">
          {new Date(item.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
        </MetaRow>
        {/* Fecha de publicación — editable, span 2 cols.
            La hora se interpreta como hora local del mercado del item. */}
        <div style={{ gridColumn: 'span 2' }}>
          <MetaRow label={`Fecha de publicación (hora de ${marketCity})`}>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={editScheduledAt}
                onChange={e => setEditScheduledAt(e.target.value)}
                onBlur={() => handleSaveScheduledAt(editScheduledAt)}
                className="input"
                style={{ height: 30, fontSize: 12, flex: 1, borderRadius: 'var(--radius-sm)' }}
              />
              {editScheduledAt && (
                <button
                  type="button"
                  onClick={() => { setEditScheduledAt(''); handleSaveScheduledAt('') }}
                  aria-label="Quitar fecha"
                  style={{
                    width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'var(--surface)', color: 'var(--ink-3)', fontSize: 14, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            {(() => {
              // Mostramos hora equivalente en el navegador (TZ local del usuario)
              // solo si difiere del TZ del mercado, para no añadir ruido.
              if (!editScheduledAt) return null
              const isoUtc = marketLocalToUtcISO(editScheduledAt, itemMarket)
              if (!isoUtc) return null
              const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
              if (browserTz === marketTz) return null
              return (
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.4 }}>
                  ≈ {formatInTimezone(isoUtc, browserTz)} en tu hora local
                </p>
              )
            })()}
            {scheduledError && (
              <p style={{ fontSize: 11, color: 'var(--red-2)', marginTop: 6, lineHeight: 1.4 }}>
                No se pudo guardar la fecha: {scheduledError}
              </p>
            )}
          </MetaRow>
        </div>
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
              ref={contentTextareaRef}
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
              <div className="flex items-center gap-2 flex-wrap">
                {confirmRegenerate ? (
                  <div
                    className="flex flex-col gap-2"
                    style={{
                      flexBasis: '100%',
                      padding: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                      ¿Sobrescribir el contenido con uno nuevo?
                    </div>
                    <label style={{ fontSize: 11, color: 'var(--ink-2)', display: 'block' }}>
                      Instrucciones opcionales para el modelo (deja vacío para regenerar tal cual):
                    </label>
                    <textarea
                      value={regenInstructions}
                      onChange={e => setRegenInstructions(e.target.value.slice(0, 1000))}
                      placeholder="Ej: más conciso, tono más casual, incluye el dato de los 30 años, termina con CTA a /contacto, evita la palabra 'innovador'…"
                      rows={3}
                      style={{
                        width: '100%',
                        fontSize: 12,
                        padding: 8,
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        color: 'var(--ink)',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                      disabled={generating}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                        {regenInstructions.length}/1000
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-secondary"
                          onClick={() => { setConfirmRegenerate(false); setRegenInstructions('') }}
                          disabled={generating}
                          style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          className="btn-destructive"
                          onClick={() => handleGenerate(true, regenInstructions)}
                          disabled={generating}
                          style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                        >
                          <RefreshCw size={11} aria-hidden="true" /> {generating ? 'Generando…' : 'Sí, regenerar'}
                        </button>
                      </div>
                    </div>
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
                {/* Exportar a Clientify / WordPress / Markdown / Plain — copia al portapapeles */}
                {!confirmRegenerate && (
                  <ExportContentMenu
                    content={editContent}
                    ctx={{
                      title: item.title,
                      imageUrl: imageUrl,
                      imageAlt: item.title,
                      channel: item.channel,
                      authorName: resolveUserName(item.approved_by, profilesById) || undefined,
                    }}
                  />
                )}
                {/* Insertar @mención del repositorio de perfiles */}
                {!confirmRegenerate && (
                  <MentionPicker
                    channel={item.channel as Channel}
                    onInsert={insertIntoContent}
                  />
                )}
                {/* Replicar en otros mercados (idioma + reglas locales) */}
                {!confirmRegenerate && (
                  <ReplicateMarketsButton
                    item={item}
                    onReplicated={(newItems) => {
                      // Notificar al parent — onItemUpdated se usa para items
                      // que YA existen, pero para los nuevos disparamos el
                      // evento custom que el pipeline-store escucha para
                      // refrescar. Si no hay listener, no pasa nada.
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('pipeline:changed', { detail: { newItems } }))
                      }
                    }}
                  />
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
                  Usará el tipo de canal activo para <strong>{item.channel}</strong> con Gemini (8-30s).
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

      {/* ── Sección Visual — visible desde 'design' en adelante.
           Antes faltaba 'approval' → al pasar el item a esa columna, la imagen
           desaparecía del modal y no había forma de previsualizarla o cambiarla
           (bug reportado por Ramon 2026-06-24). */}
      {(item.stage === 'design' || item.stage === 'approval' || item.stage === 'scheduled' || item.stage === 'analyzed') && (
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
            contentTypeId={item.content_type_id}
            replicatedFrom={item.replicated_from}
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

            {/* Publicar en Postiz — solo visible si no se ha enviado ya y hay contenido */}
            <PostizPublishButton
              item={item}
              imageUrl={imageUrl}
              onPublished={(update) => {
                onItemUpdated?.({ ...item, ...update } as ContentItem)
              }}
            />

            {/* Volver al stage anterior — útil sobre todo en 'approval' para
                regresar a 'design' si hay que retocar la pieza antes de aprobar.
                Antes no había forma de retroceder desde el modal (solo rechazar
                o aprobar), bug reportado por Ramon 2026-06-24. */}
            {!isRejected && canGoBack && prev && prevCfg && (
              <button
                onClick={() => { onMove(item.id, prev); onClose() }}
                className="inline-flex items-center transition-colors"
                title={`Volver a ${prevCfg.label}`}
                style={{
                  gap: 6,
                  height: 36,
                  padding: '0 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink-2)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                <ArrowLeft size={13} aria-hidden="true" /> Volver a {prevCfg.label}
              </button>
            )}

            {/* Rechazar — gris-rojo cuando aplica */}
            {!isRejected && (needsApproval || canAdvanceWithoutApproval) && (
              <button
                onClick={() => { onReject(item.id); onClose() }}
                className="inline-flex items-center transition-colors"
                style={{
                  gap: 6,
                  height: 36,
                  padding: '0 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink-2)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                Rechazar
              </button>
            )}

            {/* CTA primario derecha — diferenciado por stage */}
            {needsApproval ? (
              <button
                onClick={() => {
                  if (missingDateForApproval) return
                  onApprove(item.id, item.stage as Stage); onClose()
                }}
                disabled={missingDateForApproval}
                className="btn-cta"
                title={missingDateForApproval ? 'Define la fecha de publicación primero' : 'Aprueba y envía a Programación'}
                style={missingDateForApproval ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {missingDateForApproval ? 'Falta fecha de publicación' : 'Aprobar y enviar a Programación'}
              </button>
            ) : canAdvanceWithoutApproval && next && nextCfg ? (
              <button
                onClick={() => { onMove(item.id, next); onClose() }}
                className="btn-cta"
                title={`Mover a ${nextCfg.label} (sin marcar aprobación)`}
              >
                Avanzar a {nextCfg.label} <ArrowRight size={13} aria-hidden="true" />
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
  item, hasImage, onMove, onApprove, onReject, onSelect, onGenerateImage, profilesById,
}: {
  item: ContentItem
  hasImage?: boolean
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onReject: (id: string) => void
  onSelect: (item: ContentItem) => void
  onGenerateImage?: (itemId: string, title: string, channel: Channel) => Promise<void>
  profilesById?: Record<string, { full_name: string | null; email: string }>
}) {
  const stageIdx = STAGES.indexOf(item.stage as Stage)
  const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null
  const nextCfg = nextStage ? STAGE_CONFIG[nextStage] : null
  const isApprovalStage = APPROVAL_STAGES.includes(item.stage as Stage)
  const needsApproval = isApprovalStage && !item.human_approved
  const canAdvanceWithoutApproval = !isApprovalStage && !!nextStage && !STAGE_CONFIG[item.stage as Stage].automatic
  const missingDateForApproval = needsApproval && !item.scheduled_at
  const isRejected = item.status === 'rejected'
  const [generatingImage, setGeneratingImage] = useState(false)
  const [generateError, setGenerateError] = useState(false)

  // Resuelve UUID → nombre legible (o fallback)
  const approverName = item.human_approved && item.approved_by
    ? (resolveUserName(item.approved_by, profilesById) || 'Usuario')
    : ''
  const initials = approverName ? nameInitials(approverName) : null

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
      {/* ── Fila superior: canal + mercado (izq) · imagen + menú (der) ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChannelBadge channel={item.channel as Channel} />
          <span
            className="shrink-0"
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {MARKET_CONFIG[item.market]?.abbr ?? item.market.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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

      {/* ── Fila meta: estado (izq) · autor aprobado o fecha (der) ── */}
      <div
        className="flex items-center justify-between gap-2"
        style={{ marginTop: 8 }}
      >
        {/* Estado — única fuente de verdad (ya no se duplica abajo) */}
        {(() => {
          const ds = displayStatus(item)
          return (
            <span
              className="inline-flex items-center shrink-0"
              style={{
                height: 20,
                padding: '0 9px',
                gap: 4,
                borderRadius: 'var(--radius-pill)',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                background: ds.bg,
                color: ds.color,
                border: ds.border,
              }}
              aria-label={`Estado: ${ds.label}`}
            >
              {ds.label}
            </span>
          )
        })()}

        {/* Derecha: autor que aprobó (si lo hay) o fecha programada */}
        {initials ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 20, height: 20,
                fontSize: 9, fontWeight: 700,
                color: 'var(--green-2)',
                background: 'var(--green-soft)',
                border: '1px solid var(--green-border)',
              }}
              title={approverName}
            >
              {initials}
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {approverName}
            </span>
          </div>
        ) : item.scheduled_at ? (
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
              whiteSpace: 'nowrap',
            }}
          >
            <Calendar size={10} aria-hidden="true" />
            {new Intl.DateTimeFormat('es-ES', {
              timeZone: getMarketTimezone(item.market as Market),
              day: '2-digit', month: 'short',
            }).format(new Date(item.scheduled_at))}
          </span>
        ) : (
          <span />
        )}
      </div>

      {/* ── Acciones por stage ──
         Botones COMPACTOS porque las columnas del pipeline son estrechas. Ambos
         con flex:1 + minWidth:0 para repartir el ancho equitativamente y no
         desbordar (antes Rechazar tenía flex:0 0 auto y se salía de la caja). */}
      {!isRejected && needsApproval && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button
            onClick={e => {
              e.stopPropagation()
              if (missingDateForApproval) { onSelect(item); return }
              onApprove(item.id, item.stage as Stage)
            }}
            className="btn-pill-ghost"
            style={{
              flex: 1, minWidth: 0,
              height: 26, padding: '0 8px', fontSize: 11, gap: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              opacity: missingDateForApproval ? 0.6 : 1,
            }}
            title={missingDateForApproval ? 'Define la fecha de publicación primero' : 'Aprobar y enviar a Programación'}
          >
            <CheckCircle2 size={12} aria-hidden="true" />
            {missingDateForApproval ? 'Falta fecha' : 'Aprobar'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onReject(item.id) }}
            className="btn-pill-ghost"
            style={{
              flex: 1, minWidth: 0,
              height: 26, padding: '0 8px', fontSize: 11, gap: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              color: 'var(--red, #ef4444)', borderColor: 'rgba(239,68,68,0.30)',
            }}
            title="Rechazar"
            aria-label="Rechazar"
          >
            <X size={12} aria-hidden="true" />
            Rechazar
          </button>
        </div>
      )}
      {!isRejected && canAdvanceWithoutApproval && nextCfg && (
        <button
          onClick={e => { e.stopPropagation(); onMove(item.id, nextStage!) }}
          className="btn-pill-ghost"
          style={{
            marginTop: 8,
            height: 26, padding: '0 8px', fontSize: 11, gap: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
          title={`Mover a ${nextCfg.label} sin marcar aprobación`}
        >
          Avanzar a {nextCfg.label}
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      )}

      {/* ── Botón Generar imagen — siempre visible en design ── */}
      {item.stage === 'design' && onGenerateImage && (
        <button
          onClick={e => {
            e.stopPropagation()
            if (generatingImage) return // doble-click guard
            setGeneratingImage(true)
            setGenerateError(false)
            onGenerateImage(item.id, item.title, item.channel as Channel)
              .catch(err => {
                console.error('[card/generate]', err instanceof Error ? err.message : err)
                setGenerateError(true)
              })
              .finally(() => setGeneratingImage(false))
          }}
          disabled={generatingImage}
          className="btn-pill-ghost"
          style={{
            marginTop: needsApproval ? 4 : 8,
            ...(generateError ? { borderColor: 'var(--red-2)', color: 'var(--red-2)' } : {}),
          }}
          title={generateError ? 'Error generando — pulsa para reintentar' : undefined}
        >
          {generatingImage ? (
            <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Generando imagen…</>
          ) : generateError ? (
            <><RefreshCw size={12} aria-hidden="true" /> Error — reintentar</>
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
  stage, items, filterChannels, onAdd, onMove, onApprove, onReject, onSelectItem, index, itemImageMap, onGenerateImage, profilesById,
}: {
  stage: Stage
  items: ContentItem[]
  filterChannels: Channel[]
  onAdd: (s: Stage, data: { title: string; channel: Channel; contentTypeId: string | null }) => void
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onReject: (id: string) => void
  onSelectItem: (item: ContentItem) => void
  index: number
  itemImageMap?: Record<string, { id: string; url: string }>
  onGenerateImage?: (itemId: string, title: string, channel: Channel) => Promise<void>
  profilesById?: Record<string, { full_name: string | null; email: string }>
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

      {/* ── Stack de cards — scroll vertical real (grid 1fr + overflow-y-auto) ── */}
      <div className="pipeline-column-stack">
        {filtered.map(item => (
          <Card
            key={item.id}
            item={item}
            hasImage={Boolean(itemImageMap?.[item.id])}
            onMove={onMove}
            onApprove={onApprove}
            onReject={onReject}
            onSelect={onSelectItem}
            onGenerateImage={onGenerateImage}
            profilesById={profilesById}
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
            onAdd={(title, channel, contentTypeId) => {
              onAdd(stage, { title, channel, contentTypeId })
              setShowAddForm(false)
            }}
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

export function PipelineBoard({ items, filterChannels, onAdd, onMove, onDelete, onApprove, onReject, onItemUpdated, itemImageMap, onImageAssigned, onImageUnassigned, profilesById }: BoardProps) {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  // Sincroniza selectedItem con la última versión cuando items se actualiza
  useEffect(() => {
    if (!selectedItem) return
    const updated = items.find(i => i.id === selectedItem.id) ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (updated !== selectedItem) setSelectedItem(updated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Genera imagen desde la tarjeta directamente (sin abrir modal).
  // Lanza error si falla — la Card lo captura y muestra estado visible.
  const handleGenerateImageForCard = useCallback(async (itemId: string, title: string, channel: Channel) => {
    const genRes = await fetch('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // content_item_id activa la inyección de plantillas maestras (Fase 2 creatives).
      body: JSON.stringify({ prompt: title, aspectRatio: '1:1', channel, content_item_id: itemId }),
    })
    if (!genRes.ok) {
      const j = await genRes.json().catch(() => ({})) as { error?: string }
      throw new Error(j.error ?? `HTTP ${genRes.status}`)
    }
    const { id, url } = await genRes.json() as { id: string; url: string }
    const patchRes = await fetch(`/api/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_item_id: itemId }),
    })
    if (!patchRes.ok) {
      const j = await patchRes.json().catch(() => ({})) as { error?: string }
      throw new Error(j.error ?? `assign HTTP ${patchRes.status}`)
    }
    onImageAssigned?.(itemId, id, url)
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
            onReject={onReject}
            onSelectItem={setSelectedItem}
            index={idx}
            itemImageMap={itemImageMap}
            onGenerateImage={handleGenerateImageForCard}
            profilesById={profilesById}
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
          onReject={(id)     => { onReject(id) }}
          onMove={(id, s)    => { onMove(id, s) }}
          onDelete={(id)     => { onDelete(id); setSelectedItem(null) }}
          onItemUpdated={(updated) => {
            setSelectedItem(updated)
            onItemUpdated?.(updated)
          }}
          onImageAssigned={onImageAssigned}
          onImageUnassigned={onImageUnassigned}
          profilesById={profilesById}
        />
      )}
    </>
  )
}
