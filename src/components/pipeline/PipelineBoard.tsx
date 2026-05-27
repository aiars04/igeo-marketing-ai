'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Sparkles, MoreHorizontal, Calendar,
  Lightbulb, PenLine, Layers, Zap, BarChart2,
  CheckCircle2, CheckCheck, ChevronRight, ArrowRight, Trash2,
} from 'lucide-react'
import { cn, STAGE_CONFIG, STAGES } from '@/lib/utils'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import { Modal } from '@/components/ui/Modal'
import type { ContentItem, Stage, Channel } from '@/types/database'
import type { LucideIcon } from 'lucide-react'

// ─── Config ──────────────────────────────────────────────────────────────────

const STAGE_ICONS: Record<Stage, LucideIcon> = {
  ideas:     Lightbulb,
  copy:      PenLine,
  design:    Layers,
  scheduled: Zap,
  analyzed:  BarChart2,
}

const APPROVAL_STAGES: Stage[] = ['ideas', 'copy', 'design']

const MARKET_FLAG: Record<string, string> = {
  spain: '🇪🇸', latam: '🌎', uk: '🇬🇧', france: '🇫🇷',
  italy: '🇮🇹', portugal: '🇵🇹', brasil: '🇧🇷',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', in_progress: 'En progreso',
  approved: 'Aprobado',  rejected: 'Rechazado',
}

interface BoardProps {
  items:          ContentItem[]
  filterChannels: Channel[]
  onAdd:          (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:         (id: string, newStage: Stage) => void
  onDelete:       (id: string) => void
  onApprove:      (id: string, currentStage: Stage) => void
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
      className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', status === 'in_progress' && 'animate-pulse-dot')}
      style={{ background: color }}
    />
  )
}

// ─── CardMenu ────────────────────────────────────────────────────────────────

function CardMenu({ item, onMove }: { item: ContentItem; onMove: (id: string, s: Stage) => void }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

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
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/5 transition-opacity"
        aria-label="Más opciones"
      >
        <MoreHorizontal size={14} className="text-[var(--muted)]" />
      </button>

      {mounted && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={e => { e.stopPropagation(); setPos(null) }} />
          <div
            className="fixed z-[9999] rounded-md py-1 animate-scale-in min-w-[200px]"
            style={{
              top: pos.top, right: pos.right,
              background: 'var(--surface3)',
              border: '1px solid var(--line3)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <button
              onClick={e => { e.stopPropagation(); onMove(item.id, next); setPos(null) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text)' }}
            >
              <ChevronRight size={13} style={{ color: nextCfg.accentHex }} />
              Mover a <span className="font-medium">{nextCfg.label}</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ─── AddForm ─────────────────────────────────────────────────────────────────

function AddForm({
  stage, onAdd, onCancel,
}: {
  stage: Stage
  onAdd: (title: string, channel: Channel) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<Channel>('linkedin')
  const cfg = STAGE_CONFIG[stage]
  const submit = () => { if (title.trim()) onAdd(title.trim(), channel) }

  return (
    <div
      className="animate-fade-in rounded-lg p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface)', border: `1px solid ${cfg.accentHex}55` }}
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Título del contenido..."
        className="input"
      />
      <select
        value={channel}
        onChange={e => setChannel(e.target.value as Channel)}
        className="input"
      >
        {(['linkedin','instagram','facebook','x','blog','email','newsletter'] as Channel[]).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost flex-1 justify-center text-[12px]">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex-1 px-2 py-2 rounded-md text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: cfg.accentHex }}
        >
          Añadir
        </button>
      </div>
    </div>
  )
}

// ─── Card Detail Modal (mantengo el modal del board anterior) ────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      <div className="text-[13px]" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  )
}

function ContentDetailModal({
  item, onClose, onApprove, onMove, onDelete,
}: {
  item: ContentItem
  onClose: () => void
  onApprove: (id: string, s: Stage) => void
  onMove: (id: string, s: Stage) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const stageCfg = STAGE_CONFIG[item.stage as Stage]
  const idx = STAGES.indexOf(item.stage as Stage)
  const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null
  const nextCfg = next ? STAGE_CONFIG[next] : null
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved

  return (
    <Modal open onClose={onClose} title={item.title} size="lg">
      {/* Stage progress */}
      <div className="flex items-center gap-1 mb-6">
        {STAGES.map((s, i) => {
          const sCfg = STAGE_CONFIG[s]
          const SIcon = STAGE_ICONS[s]
          const isCurrent = s === item.stage
          const isDone = i < idx
          return (
            <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{
                    background: isCurrent ? `${sCfg.accentHex}22` : isDone ? `${sCfg.accentHex}10` : 'var(--surface2)',
                    border: `1px solid ${isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}40` : 'var(--line)'}`,
                  }}
                >
                  <SIcon size={13} style={{ color: isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}cc` : 'var(--muted)' }} />
                </div>
                <span className="text-[10px] font-semibold text-center" style={{ color: isCurrent ? sCfg.accentHex : 'var(--muted)' }}>
                  {sCfg.label.split(' ')[0]}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-px mb-4" style={{ background: isDone ? `${sCfg.accentHex}55` : 'var(--line)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span
          className="badge"
          style={{ color: stageCfg.accentHex, background: `${stageCfg.accentHex}18`, border: `1px solid ${stageCfg.accentHex}35` }}
        >
          {stageCfg.label}
        </span>
        {item.ai_generated && <span className="badge badge-blue"><Sparkles size={10} /> Generado por IA</span>}
        {item.human_approved && item.approved_by && <span className="badge badge-green"><CheckCheck size={10} /> {item.approved_by}</span>}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5 p-4 rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--line)' }}>
        <MetaRow label="Canal"><ChannelBadge channel={item.channel as Channel} /></MetaRow>
        <MetaRow label="Mercado">{MARKET_FLAG[item.market] ?? ''} {item.market}</MetaRow>
        <MetaRow label="Estado">
          <div className="flex items-center gap-1.5">
            <StatusDot status={item.status} />
            {STATUS_LABELS[item.status] ?? item.status}
          </div>
        </MetaRow>
        {item.campaign && <MetaRow label="Campaña">{item.campaign}</MetaRow>}
        <MetaRow label="Creado">
          <span style={{ color: 'var(--text2)' }}>
            {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </MetaRow>
        <MetaRow label="Actualizado">
          <span style={{ color: 'var(--text2)' }}>
            {new Date(item.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </MetaRow>
      </div>

      {/* Content */}
      <div className="mb-5 p-4 rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--line)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
          {item.content ? 'Contenido' : 'Propuesta'}
        </p>
        {item.content ? (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{item.content}</p>
        ) : (
          <div>
            <p className="text-[14px] font-medium leading-snug mb-3" style={{ color: 'var(--text)' }}>{item.title}</p>
            <div
              className="flex items-center gap-2 text-[12px] font-medium px-3 py-2.5 rounded"
              style={{ background: `${stageCfg.accentHex}10`, border: `1px solid ${stageCfg.accentHex}28`, color: stageCfg.accentHex }}
            >
              <Sparkles size={12} />
              {item.stage === 'ideas' ? 'Pendiente de aprobar y pasar a redacción'
                : item.stage === 'copy' ? 'Pendiente de redactar el contenido completo'
                : item.stage === 'design' ? 'Pendiente de crear los visuales'
                : item.stage === 'scheduled' ? 'Programado vía PostiZ'
                : 'Análisis en progreso'}
            </div>
          </div>
        )}
      </div>

      {item.clarity_pass !== null && (
        <div
          className="flex items-start gap-3 mb-4 p-3.5 rounded-lg"
          style={{
            background: item.clarity_pass ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${item.clarity_pass ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.22)'}`,
          }}
        >
          <span style={{ color: item.clarity_pass ? 'var(--success-2)' : 'var(--warning-2)' }}>
            {item.clarity_pass ? '✓' : '⚠'}
          </span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: item.clarity_pass ? 'var(--success-2)' : 'var(--warning-2)' }}>
              Clarity {item.clarity_pass ? 'OK' : 'requiere revisión'}
            </p>
            {item.clarity_summary && <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{item.clarity_summary}</p>}
          </div>
        </div>
      )}

      {item.scheduled_at && (
        <div
          className="flex items-center gap-3 mb-4 p-3.5 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)' }}
        >
          <Calendar size={15} className="shrink-0" style={{ color: 'var(--warning-2)' }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--warning-2)' }}>Programado vía PostiZ</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-4 mt-2" style={{ borderTop: '1px solid var(--line)' }}>
        {confirmDelete ? (
          <>
            <p className="text-[12px] flex-1" style={{ color: 'var(--muted)' }}>¿Eliminar definitivamente?</p>
            <button
              onClick={() => { onDelete(item.id); onClose() }}
              className="px-3 py-1.5 rounded text-[12px] font-semibold text-white"
              style={{ background: 'rgba(239,68,68,0.75)' }}
            >
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-[12px]">Cancelar</button>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-medium hover:bg-rose-500/10"
              style={{ border: '1px solid rgba(239,68,68,0.22)', color: 'var(--danger-2)' }}
            >
              <Trash2 size={12} /> Eliminar
            </button>
            <div className="flex-1" />
            {next && nextCfg && (
              <button onClick={() => { onMove(item.id, next); onClose() }} className="btn-ghost flex items-center gap-1.5 text-[12px]">
                <ArrowRight size={12} style={{ color: nextCfg.accentHex }} /> Mover a {nextCfg.label}
              </button>
            )}
            {needsApproval && (
              <button
                onClick={() => { onApprove(item.id, item.stage as Stage); onClose() }}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold"
                style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--success-2)' }}
              >
                <CheckCircle2 size={13} /> Aprobar y avanzar
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD — diseño nuevo desde cero
// ═══════════════════════════════════════════════════════════════════════════

function Card({
  item, onMove, onApprove, onSelect,
}: {
  item: ContentItem
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onSelect: (item: ContentItem) => void
}) {
  const cfg = STAGE_CONFIG[item.stage as Stage]
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved

  // Iniciales del avatar
  const initials = item.human_approved && item.approved_by
    ? item.approved_by.slice(0, 2).toUpperCase()
    : item.ai_generated ? 'AI' : '—'

  // Color del avatar
  const avatarStyle = item.human_approved
    ? { bg: 'rgba(16,185,129,0.18)', color: 'var(--success-2)', border: 'rgba(16,185,129,0.35)' }
    : item.ai_generated
    ? { bg: 'rgba(37,99,235,0.18)',  color: 'var(--blue-3)',    border: 'rgba(37,99,235,0.35)' }
    : { bg: 'var(--surface3)',       color: 'var(--muted)',     border: 'var(--line2)' }

  // Status text
  const statusText = item.scheduled_at
    ? new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : item.human_approved && item.approved_by
    ? `Aprobado por ${item.approved_by}`
    : item.ai_generated
    ? 'Generado por IA'
    : 'Pendiente de revisar'

  const statusColor = item.scheduled_at
    ? 'var(--warning-2)'
    : item.human_approved
    ? 'var(--success-2)'
    : 'var(--muted)'

  return (
    <article
      className="group animate-fade-up cursor-pointer rounded-lg overflow-hidden transition-all duration-150"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line2)',
      }}
      onClick={() => onSelect(item)}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.borderColor = `${cfg.accentHex}66`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--surface)'
        e.currentTarget.style.borderColor = 'var(--line2)'
      }}
    >
      {/* Top — channel + market + menu */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <ChannelBadge channel={item.channel as Channel} />
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[12px]">{MARKET_FLAG[item.market] ?? ''}</span>
          <StatusDot status={item.status} />
          <div onClick={e => e.stopPropagation()}>
            <CardMenu item={item} onMove={onMove} />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-4 pt-3 pb-4">
        <h4
          className="text-[14px] font-semibold leading-[1.5] break-words"
          style={{ color: 'var(--text)' }}
        >
          {item.title}
        </h4>
      </div>

      {/* Divider + Footer */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        {/* Avatar */}
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold"
          style={{
            background: avatarStyle.bg,
            color: avatarStyle.color,
            border: `1px solid ${avatarStyle.border}`,
          }}
        >
          {initials}
        </div>

        {/* Status text */}
        <span className="flex-1 text-[12px] truncate" style={{ color: statusColor }}>
          {item.scheduled_at && <Calendar size={11} className="inline mr-1 -mt-0.5" />}
          {statusText}
        </span>

        {/* Clarity indicator */}
        {item.clarity_pass !== null && (
          <span
            className="shrink-0 text-[11px] font-bold w-5 h-5 rounded flex items-center justify-center"
            style={
              item.clarity_pass
                ? { color: 'var(--success-2)', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)' }
                : { color: 'var(--warning-2)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)' }
            }
          >
            {item.clarity_pass ? '✓' : '!'}
          </span>
        )}
      </div>

      {/* Approve button (footer bar) */}
      {needsApproval && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id, item.stage as Stage) }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold transition-colors"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderTop: '1px solid rgba(16,185,129,0.22)',
            color: 'var(--success-2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.16)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
        >
          <CheckCircle2 size={13} />
          Aprobar y avanzar
        </button>
      )}
    </article>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN — header simple horizontal
// ═══════════════════════════════════════════════════════════════════════════

function Column({
  stage, items, filterChannels, onAdd, onMove, onApprove, onSelectItem, index,
}: {
  stage: Stage
  items: ContentItem[]
  filterChannels: Channel[]
  onAdd: (s: Stage, data: { title: string; channel: Channel }) => void
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onSelectItem: (item: ContentItem) => void
  index: number
}) {
  const cfg = STAGE_CONFIG[stage]
  const Icon = STAGE_ICONS[stage]
  const [showAddForm, setShowAddForm] = useState(false)

  const filtered = filterChannels.length === 0
    ? items
    : items.filter(i => filterChannels.includes(i.channel as Channel))

  return (
    <section
      className="flex flex-col h-full animate-fade-up"
      style={{
        flex: '1 1 0',
        minWidth: 252,
        maxWidth: 360,
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Header */}
      <header className="shrink-0 mb-3">
        <div className="flex items-center gap-2 px-1 mb-1.5">
          <Icon size={14} style={{ color: cfg.accentHex }} strokeWidth={2.2} />
          <h2 className="text-[13.5px] font-semibold tracking-tight flex-1 truncate" style={{ color: 'var(--text)' }}>
            {cfg.label}
          </h2>
          <span
            className="text-[11.5px] font-semibold tabular-nums px-1.5 rounded leading-[18px]"
            style={{
              color: cfg.accentHex,
              background: `${cfg.accentHex}18`,
              border: `1px solid ${cfg.accentHex}30`,
            }}
          >
            {filtered.length}
          </span>
          {cfg.automatic && <span className="badge badge-amber"><Zap size={9} /> Auto</span>}
        </div>
        <p className="text-[11.5px] leading-snug px-1" style={{ color: 'var(--muted)' }}>
          {cfg.subtitle}
        </p>
        {/* Accent line */}
        <div className="mt-3 h-[2px] rounded" style={{ background: cfg.accentHex, opacity: 0.4 }} />
      </header>

      {/* Cards stack */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.map(item => (
          <Card
            key={item.id}
            item={item}
            onMove={onMove}
            onApprove={onApprove}
            onSelect={onSelectItem}
          />
        ))}

        {cfg.automatic ? (
          <div
            className="w-full flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg text-[11.5px] font-medium"
            style={{ border: '1px dashed var(--line2)', color: 'var(--muted)', opacity: 0.7 }}
          >
            <Zap size={12} /> PostiZ automático
          </div>
        ) : showAddForm ? (
          <AddForm
            stage={stage}
            onAdd={(title, channel) => { onAdd(stage, { title, channel }); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all"
            style={{ border: '1px dashed var(--line2)', color: 'var(--muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.color       = cfg.accentHex
              e.currentTarget.style.borderColor = `${cfg.accentHex}55`
              e.currentTarget.style.background  = `${cfg.accentHex}06`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color       = 'var(--muted)'
              e.currentTarget.style.borderColor = 'var(--line2)'
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
// BOARD — contenedor responsive
// ═══════════════════════════════════════════════════════════════════════════

export function PipelineBoard({ items, filterChannels, onAdd, onMove, onDelete, onApprove }: BoardProps) {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedItem) return
    const updated = items.find(i => i.id === selectedItem.id)
    setSelectedItem(updated ?? null)
  }, [items])

  const byStage = STAGES.reduce((acc, s) => {
    acc[s] = items.filter(i => i.stage === s)
    return acc
  }, {} as Record<Stage, ContentItem[]>)

  return (
    <>
      <div className="flex gap-4 h-full overflow-x-auto px-5 pt-5 pb-5 pipeline-scroll">
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
          />
        ))}
      </div>

      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={(id, s) => { onApprove(id, s) }}
          onMove={(id, s)    => { onMove(id, s) }}
          onDelete={(id)     => { onDelete(id); setSelectedItem(null) }}
        />
      )}
    </>
  )
}
