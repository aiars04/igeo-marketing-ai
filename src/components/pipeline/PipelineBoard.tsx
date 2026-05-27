'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Sparkles, MoreHorizontal, ChevronRight, Calendar,
  Lightbulb, PenLine, Layers, Zap, BarChart2, Trash2,
  CheckCircle2, CheckCheck, ArrowRight,
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

// ─── Board props ─────────────────────────────────────────────────────────────

interface BoardProps {
  items:          ContentItem[]
  filterChannels: Channel[]
  onAdd:          (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:         (id: string, newStage: Stage) => void
  onDelete:       (id: string) => void
  onApprove:      (id: string, currentStage: Stage) => void
}

// ─── StatusDot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     '#6b7280',
    in_progress: '#f59e0b',
    approved:    '#10b981',
    rejected:    '#ef4444',
  }
  const color = map[status] ?? '#6b7280'
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', status === 'in_progress' && 'animate-pulse-dot')}
      style={{ background: color }}
    />
  )
}

// ─── MetaRow (modal) ─────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      <div className="text-[13px]" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  )
}

// ─── CardMenu ────────────────────────────────────────────────────────────────

function CardMenu({
  item,
  onMove,
}: {
  item:   ContentItem
  onMove: (id: string, newStage: Stage) => void
}) {
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const currentIdx  = STAGES.indexOf(item.stage as Stage)
  const nextStage   = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null
  const nextCfg     = nextStage ? STAGE_CONFIG[nextStage] : null

  if (!nextStage || !nextCfg) return null

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (dropPos) {
      setDropPos(null)
    } else {
      const rect = btnRef.current?.getBoundingClientRect()
      if (rect) setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
        aria-label="Menú"
      >
        <MoreHorizontal size={14} style={{ color: 'var(--muted)' }} />
      </button>

      {mounted && dropPos && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={e => { e.stopPropagation(); setDropPos(null) }}
          />
          <div
            className="fixed z-[9999] rounded-md overflow-hidden py-1 animate-scale-in"
            style={{
              top: dropPos.top,
              right: dropPos.right,
              background: 'var(--surface3)',
              border: '1px solid var(--line3)',
              minWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <button
              onClick={e => {
                e.stopPropagation()
                onMove(item.id, nextStage)
                setDropPos(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-left transition-colors hover:bg-white/5"
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
  stage,
  onAdd,
  onCancel,
}: {
  stage:    Stage
  onAdd:    (title: string, channel: Channel) => void
  onCancel: () => void
}) {
  const [title,   setTitle]   = useState('')
  const [channel, setChannel] = useState<Channel>('linkedin')
  const cfg = STAGE_CONFIG[stage]

  const submit = () => { if (title.trim()) onAdd(title.trim(), channel) }
  const base   = { background: 'var(--surface3)', border: '1px solid var(--line2)', color: 'var(--text)' }

  return (
    <div
      className="animate-fade-in rounded-lg p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--line2)' }}
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Título del contenido..."
        className="w-full px-3 py-2 rounded text-[13px] outline-none transition-colors"
        style={base}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)' }}
        onBlur={e  => { e.currentTarget.style.borderColor = 'var(--line2)' }}
      />
      <select
        value={channel}
        onChange={e => setChannel(e.target.value as Channel)}
        className="w-full px-3 py-2 rounded text-[13px] outline-none"
        style={base}
      >
        {(['linkedin','instagram','facebook','x','blog','email','newsletter'] as Channel[]).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 rounded text-[12px] font-medium transition-colors hover:bg-white/5"
          style={{ border: '1px solid var(--line2)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex-1 px-2 py-1.5 rounded text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: cfg.accentHex }}
        >
          Añadir
        </button>
      </div>
    </div>
  )
}

// ─── ContentDetailModal ──────────────────────────────────────────────────────

function ContentDetailModal({
  item,
  onClose,
  onApprove,
  onMove,
  onDelete,
}: {
  item:      ContentItem
  onClose:   () => void
  onApprove: (id: string, stage: Stage) => void
  onMove:    (id: string, newStage: Stage) => void
  onDelete:  (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const stageCfg    = STAGE_CONFIG[item.stage as Stage]
  const stageIdx    = STAGES.indexOf(item.stage as Stage)
  const nextStage   = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null
  const nextCfg     = nextStage ? STAGE_CONFIG[nextStage] : null
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved

  return (
    <Modal open onClose={onClose} title={item.title} size="lg">

      {/* Stage progress tracker */}
      <div className="flex items-center gap-1 mb-6">
        {STAGES.map((s, idx) => {
          const sCfg    = STAGE_CONFIG[s]
          const SIcon   = STAGE_ICONS[s]
          const isCurrent = s === item.stage
          const isDone    = idx < stageIdx
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
              {idx < STAGES.length - 1 && (
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

      {/* Meta grid */}
      <div
        className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5 p-4 rounded-lg"
        style={{ background: 'var(--surface2)', border: '1px solid var(--line)' }}
      >
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
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
            {item.content}
          </p>
        ) : (
          <div>
            <p className="text-[14px] font-medium leading-snug mb-3" style={{ color: 'var(--text)' }}>
              {item.title}
            </p>
            <div
              className="flex items-center gap-2 text-[12px] font-medium px-3 py-2.5 rounded"
              style={{ background: `${stageCfg.accentHex}10`, border: `1px solid ${stageCfg.accentHex}28`, color: stageCfg.accentHex }}
            >
              <Sparkles size={12} />
              {item.stage === 'ideas'
                ? 'Pendiente de aprobar y pasar a redacción'
                : item.stage === 'copy'
                ? 'Pendiente de redactar el contenido completo'
                : item.stage === 'design'
                ? 'Pendiente de crear los visuales'
                : item.stage === 'scheduled'
                ? 'Programado vía PostiZ'
                : 'Análisis en progreso'}
            </div>
          </div>
        )}
      </div>

      {/* Clarity */}
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
            {item.clarity_summary && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{item.clarity_summary}</p>
            )}
          </div>
        </div>
      )}

      {/* Scheduled */}
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
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-[12px]">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-medium transition-all hover:bg-rose-500/10"
              style={{ border: '1px solid rgba(239,68,68,0.22)', color: 'var(--danger-2)' }}
            >
              <Trash2 size={12} />
              Eliminar
            </button>

            <div className="flex-1" />

            {nextStage && nextCfg && (
              <button
                onClick={() => { onMove(item.id, nextStage); onClose() }}
                className="btn-ghost flex items-center gap-1.5 text-[12px]"
              >
                <ArrowRight size={12} style={{ color: nextCfg.accentHex }} />
                Mover a {nextCfg.label}
              </button>
            )}

            {needsApproval && (
              <button
                onClick={() => { onApprove(item.id, item.stage as Stage); onClose() }}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-all"
                style={{
                  background: 'rgba(16,185,129,0.18)',
                  border: '1px solid rgba(16,185,129,0.4)',
                  color: 'var(--success-2)',
                }}
              >
                <CheckCircle2 size={13} />
                Aprobar y avanzar
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ContentCard — rectangular limpia, padding generoso, jerarquía clara
// ═══════════════════════════════════════════════════════════════════════════

function ContentCard({
  item,
  onMove,
  onApprove,
  onSelect,
}: {
  item:      ContentItem
  onMove:    (id: string, newStage: Stage) => void
  onApprove: (id: string, stage: Stage) => void
  onSelect:  (item: ContentItem) => void
}) {
  const stageCfg    = STAGE_CONFIG[item.stage as Stage]
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved

  return (
    <div
      className="group animate-fade-up relative cursor-pointer rounded-lg overflow-hidden transition-all duration-150"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line2)',
      }}
      onClick={() => onSelect(item)}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${stageCfg.accentHex}55`
        e.currentTarget.style.background = 'var(--surface2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--line2)'
        e.currentTarget.style.background = 'var(--surface)'
      }}
    >
      {/* Body */}
      <div className="p-4">
        {/* Top row: channel + market + status + menu */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <ChannelBadge channel={item.channel as Channel} />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {MARKET_FLAG[item.market] ?? ''}
            </span>
            <StatusDot status={item.status} />
            <div onClick={e => e.stopPropagation()}>
              <CardMenu item={item} onMove={onMove} />
            </div>
          </div>
        </div>

        {/* Title */}
        <p
          className="text-[13.5px] font-medium leading-[1.5] break-words"
          style={{ color: 'var(--text)' }}
        >
          {item.title}
        </p>

        {/* Tags row */}
        {(item.ai_generated || item.clarity_pass !== null || item.human_approved) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            {item.ai_generated && (
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: 'var(--blue-3)', background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.22)' }}
              >
                <Sparkles size={9} /> IA
              </span>
            )}
            {item.clarity_pass === true && (
              <span
                className="inline-flex items-center text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: 'var(--success-2)', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)' }}
              >
                Clarity ✓
              </span>
            )}
            {item.clarity_pass === false && (
              <span
                className="inline-flex items-center text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: 'var(--warning-2)', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)' }}
              >
                Revisar
              </span>
            )}
            {item.human_approved && item.approved_by && (
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: 'var(--success-2)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}
              >
                <CheckCheck size={9} /> {item.approved_by}
              </span>
            )}
          </div>
        )}

        {/* Scheduled date */}
        {item.scheduled_at && (
          <div
            className="mt-3 pt-3 flex items-center gap-1.5 text-[11.5px] font-medium tabular-nums"
            style={{ borderTop: '1px solid var(--line)', color: 'var(--warning-2)' }}
          >
            <Calendar size={11} className="shrink-0" />
            {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Approve footer */}
      {needsApproval && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id, item.stage as Stage) }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold transition-colors"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderTop: '1px solid rgba(16,185,129,0.20)',
            color: 'var(--success-2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.16)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
        >
          <CheckCircle2 size={13} />
          Aprobar y avanzar
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Column — header limpio, responsive
// ═══════════════════════════════════════════════════════════════════════════

function Column({
  stage,
  items,
  filterChannels,
  onAdd,
  onMove,
  onApprove,
  onSelectItem,
  index,
}: {
  stage:          Stage
  items:          ContentItem[]
  filterChannels: Channel[]
  onAdd:          (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:         (id: string, newStage: Stage) => void
  onApprove:      (id: string, stage: Stage) => void
  onSelectItem:   (item: ContentItem) => void
  index:          number
}) {
  const cfg  = STAGE_CONFIG[stage]
  const Icon = STAGE_ICONS[stage]
  const [showAddForm, setShowAddForm] = useState(false)

  const filteredItems = filterChannels.length === 0
    ? items
    : items.filter(i => filterChannels.includes(i.channel as Channel))

  return (
    <div
      className="flex flex-col h-full animate-fade-up"
      style={{
        flex: '1 1 0',
        minWidth: 250,
        maxWidth: 340,
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* ── Header ── */}
      <div className="px-1 mb-3 pb-3" style={{ borderBottom: '1px solid var(--line2)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center shrink-0"
            style={{
              background: `${cfg.accentHex}1a`,
              border: `1px solid ${cfg.accentHex}40`,
            }}
          >
            <Icon size={13} style={{ color: cfg.accentHex }} />
          </div>
          <h3 className="text-[13.5px] font-semibold tracking-tight flex-1 truncate" style={{ color: 'var(--text)' }}>
            {cfg.label}
          </h3>
          <span
            className="text-[12px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
            style={{
              color: cfg.accentHex,
              background: `${cfg.accentHex}18`,
              border: `1px solid ${cfg.accentHex}30`,
            }}
          >
            {filteredItems.length}
          </span>
          {cfg.automatic && (
            <span className="badge badge-amber">
              <Zap size={9} /> Auto
            </span>
          )}
        </div>
        <p className="text-[11.5px] leading-snug mt-1.5 ml-8.5" style={{ color: 'var(--muted)', marginLeft: 34 }}>
          {cfg.subtitle}
        </p>
      </div>

      {/* ── Cards ── */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filteredItems.map(item => (
          <ContentCard
            key={item.id}
            item={item}
            onMove={onMove}
            onApprove={onApprove}
            onSelect={onSelectItem}
          />
        ))}

        {cfg.automatic ? (
          <div
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-[11.5px] font-medium"
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
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-[12px] font-medium transition-all"
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PipelineBoard
// ═══════════════════════════════════════════════════════════════════════════

export function PipelineBoard({ items, filterChannels, onAdd, onMove, onDelete, onApprove }: BoardProps) {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedItem) return
    const updated = items.find(i => i.id === selectedItem.id)
    setSelectedItem(updated ?? null)
  }, [items])

  const byStage = STAGES.reduce((acc, stage) => {
    acc[stage] = items.filter(i => i.stage === stage)
    return acc
  }, {} as Record<Stage, ContentItem[]>)

  return (
    <>
      <div className="flex gap-4 h-full overflow-x-auto pb-5 px-5 pt-5 pipeline-scroll">
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
          onApprove={(id, stage) => { onApprove(id, stage) }}
          onMove={(id, stage)    => { onMove(id, stage) }}
          onDelete={(id)         => { onDelete(id); setSelectedItem(null) }}
        />
      )}
    </>
  )
}
