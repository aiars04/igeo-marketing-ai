'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Sparkles, MoreHorizontal, ChevronRight, Calendar,
  Lightbulb, PenLine, Layers, Zap, BarChart2, Trash2,
  CheckCircle2, CheckCheck, ArrowRight, Globe2,
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
    pending:     '#6b6058',
    in_progress: '#f59e0b',
    approved:    '#10b981',
    rejected:    '#ef4444',
  }
  const color = map[status] ?? '#6b6058'
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', status === 'in_progress' && 'animate-pulse-dot')}
      style={{ background: color, boxShadow: status !== 'pending' ? `0 0 6px ${color}80` : 'none' }}
    />
  )
}

// ─── MetaRow ─────────────────────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="mono-label" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="text-[12.5px] text-right truncate" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  )
}

// ─── CardMenu — portal dropdown ──────────────────────────────────────────────

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
      if (rect) setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--surface3)]"
        aria-label="Menú"
      >
        <MoreHorizontal size={13} style={{ color: 'var(--muted)' }} />
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
              minWidth: 210,
              boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
            }}
          >
            <button
              onClick={e => {
                e.stopPropagation()
                onMove(item.id, nextStage)
                setDropPos(null)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12.5px] text-left transition-colors hover:bg-[var(--surface4)]"
              style={{ color: 'var(--text)' }}
            >
              <ChevronRight size={13} style={{ color: nextCfg.accentHex }} />
              <span>Mover a <span className="font-medium">{nextCfg.label}</span></span>
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
  const base   = { background: 'var(--surface2)', border: '1px solid var(--line2)', color: 'var(--text)' }

  return (
    <div
      className="animate-fade-in rounded-md p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface)', border: `1px solid ${cfg.accentHex}40` }}
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Título del contenido..."
        className="w-full px-2.5 py-2 rounded text-[12.5px] outline-none transition-colors"
        style={base}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)' }}
        onBlur={e  => { e.currentTarget.style.borderColor = 'var(--line2)' }}
      />
      <select
        value={channel}
        onChange={e => setChannel(e.target.value as Channel)}
        className="w-full px-2.5 py-2 rounded text-[12.5px] outline-none"
        style={base}
      >
        {(['linkedin','instagram','facebook','x','blog','email','newsletter'] as Channel[]).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex gap-1.5 pt-0.5">
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 rounded text-[11.5px] transition-colors hover:bg-[var(--surface3)]"
          style={{ border: '1px solid var(--line2)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex-1 px-2 py-1.5 rounded text-[11.5px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: cfg.accentHex, border: `1px solid ${cfg.accentHex}` }}
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
                  className="w-8 h-8 rounded flex items-center justify-center transition-all"
                  style={{
                    background: isCurrent ? `${sCfg.accentHex}22` : isDone ? `${sCfg.accentHex}10` : 'var(--surface2)',
                    border: `1px solid ${isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}40` : 'var(--line)'}`,
                  }}
                >
                  <SIcon size={13} style={{ color: isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}cc` : 'var(--muted)' }} />
                </div>
                <span
                  className="font-mono text-[9px] font-medium text-center leading-none uppercase tracking-wider"
                  style={{ color: isCurrent ? sCfg.accentHex : 'var(--muted)' }}
                >
                  {sCfg.label.split(' ')[0]}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className="flex-1 h-px mb-4"
                  style={{ background: isDone ? `${sCfg.accentHex}55` : 'var(--line)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        <span
          className="badge"
          style={{
            color: stageCfg.accentHex,
            background: `${stageCfg.accentHex}18`,
            border: `1px solid ${stageCfg.accentHex}35`,
          }}
        >
          {stageCfg.label}
        </span>
        {item.ai_generated && (
          <span className="badge badge-blue">
            <Sparkles size={9} /> IA
          </span>
        )}
        {item.human_approved && item.approved_by && (
          <span className="badge badge-green">
            <CheckCheck size={9} /> {item.approved_by}
          </span>
        )}
      </div>

      {/* Meta grid */}
      <div
        className="grid grid-cols-2 gap-x-7 gap-y-2.5 mb-5 p-4 rounded-md"
        style={{ background: 'var(--surface2)', border: '1px solid var(--line)' }}
      >
        <MetaRow label="Canal"><ChannelBadge channel={item.channel as Channel} /></MetaRow>
        <MetaRow label="Mercado">
          <span>{MARKET_FLAG[item.market] ?? ''} {item.market}</span>
        </MetaRow>
        <MetaRow label="Estado">
          <div className="flex items-center justify-end gap-1.5">
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

      {/* Content */}
      <div className="mb-5 p-4 rounded-md" style={{ background: 'var(--surface2)', border: '1px solid var(--line)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="mono-label" style={{ color: 'var(--orange-3)' }}>
            {item.content ? '— Contenido' : '— Propuesta'}
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--line2)' }} />
        </div>
        {item.content ? (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
            {item.content}
          </p>
        ) : (
          <div>
            <p className="text-[14.5px] font-medium leading-snug mb-3" style={{ color: 'var(--text)' }}>
              {item.title}
            </p>
            <div
              className="flex items-center gap-2 text-[11.5px] font-medium px-2.5 py-2 rounded"
              style={{ background: `${stageCfg.accentHex}10`, border: `1px solid ${stageCfg.accentHex}30`, color: stageCfg.accentHex }}
            >
              <Sparkles size={11} />
              {item.stage === 'ideas'
                ? 'Pendiente de aprobar y pasar a redacción de copy'
                : item.stage === 'copy'
                ? 'Pendiente de redactar el contenido completo'
                : item.stage === 'design'
                ? 'Pendiente de crear los visuales'
                : item.stage === 'scheduled'
                ? 'Programado para publicación automática via PostiZ'
                : 'Análisis de rendimiento en progreso'}
            </div>
          </div>
        )}
      </div>

      {/* Clarity */}
      {item.clarity_pass !== null && (
        <div
          className="flex items-start gap-3 mb-4 p-3.5 rounded-md"
          style={{
            background: item.clarity_pass ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${item.clarity_pass ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.22)'}`,
          }}
        >
          <span className="text-[14px] font-mono" style={{ color: item.clarity_pass ? 'var(--success-2)' : 'var(--warning-2)' }}>
            {item.clarity_pass ? '✓' : '⚠'}
          </span>
          <div>
            <p className="text-[12.5px] font-semibold" style={{ color: item.clarity_pass ? 'var(--success-2)' : 'var(--warning-2)' }}>
              Clarity · {item.clarity_pass ? 'OK' : 'Requiere revisión'}
            </p>
            {item.clarity_summary && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{item.clarity_summary}</p>
            )}
          </div>
        </div>
      )}

      {/* Approval info */}
      {item.human_approved && item.approved_by && (
        <div
          className="flex items-center gap-3 mb-4 p-3.5 rounded-md"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.22)' }}
        >
          <CheckCheck size={15} className="shrink-0" style={{ color: 'var(--success-2)' }} />
          <div>
            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--success-2)' }}>
              Aprobado por {item.approved_by}
            </p>
            {item.approved_at && (
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
                {new Date(item.approved_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Scheduled */}
      {item.scheduled_at && (
        <div
          className="flex items-center gap-3 mb-4 p-3.5 rounded-md"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)' }}
        >
          <Calendar size={15} className="shrink-0" style={{ color: 'var(--warning-2)' }} />
          <div>
            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--warning-2)' }}>Programado via PostiZ</p>
            <p className="text-[12px] mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-4 mt-2" style={{ borderTop: '1px solid var(--line)' }}>
        {confirmDelete ? (
          <>
            <p className="text-[12px] flex-1" style={{ color: 'var(--muted)' }}>¿Eliminar definitivamente?</p>
            <button
              onClick={() => { onDelete(item.id); onClose() }}
              className="px-3 py-1.5 rounded text-[12px] font-semibold text-white transition-all"
              style={{ background: 'rgba(239,68,68,0.75)', border: '1px solid rgba(239,68,68,0.4)' }}
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

// ─── ContentCard — la pieza maestra ──────────────────────────────────────────

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

  // Avatar initials
  const initials = item.approved_by
    ? item.approved_by.slice(0, 2).toUpperCase()
    : item.ai_generated ? 'AI' : '··'

  return (
    <div
      className="group animate-fade-up relative cursor-pointer rounded-lg overflow-hidden transition-all duration-150 flex flex-col"
      style={{
        aspectRatio: '9 / 16',
        background: 'var(--surface)',
        border: '1px solid var(--line2)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.20)',
      }}
      onClick={() => onSelect(item)}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${stageCfg.accentHex}55`
        e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.30), 0 0 0 1px ${stageCfg.accentHex}22`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--line2)'
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.20)'
      }}
    >
      {/* ── Header row: channel left, market + menu right ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2 shrink-0">
        <ChannelBadge channel={item.channel as Channel} />
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>ES</span>
          <StatusDot status={item.status} />
          <div onClick={e => e.stopPropagation()}>
            <CardMenu item={item} onMove={onMove} />
          </div>
        </div>
      </div>

      {/* ── Title — main focus, flex-grow to fill ── */}
      <div className="px-4 pb-4 flex-1 overflow-hidden">
        <p
          className="text-[15px] font-semibold leading-[1.4] break-words"
          style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
        >
          {item.title}
        </p>

        {/* Campaign subtitle */}
        {item.campaign && (
          <p
            className="text-[12.5px] font-medium mt-2.5"
            style={{ color: 'var(--blue-3)' }}
          >
            {item.campaign}
          </p>
        )}
      </div>

      {/* ── Footer: avatar + status text + tags ── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        {/* Avatar circle */}
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: item.human_approved
              ? 'rgba(16,185,129,0.18)'
              : item.ai_generated
              ? 'rgba(37,99,235,0.18)'
              : 'var(--surface3)',
            color: item.human_approved
              ? 'var(--success-2)'
              : item.ai_generated
              ? 'var(--blue-3)'
              : 'var(--muted)',
            border: `1px solid ${item.human_approved ? 'rgba(16,185,129,0.35)' : item.ai_generated ? 'rgba(37,99,235,0.35)' : 'var(--line2)'}`,
          }}
        >
          {initials}
        </div>

        {/* Status label */}
        <span
          className="text-[12px] font-medium truncate flex-1"
          style={{ color: 'var(--muted)' }}
        >
          {item.scheduled_at ? (
            <span className="flex items-center gap-1.5 font-mono tabular-nums" style={{ color: 'var(--warning-2)' }}>
              <Calendar size={11} />
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : item.human_approved && item.approved_by ? (
            <span style={{ color: 'var(--success-2)' }}>Aprobado por {item.approved_by}</span>
          ) : item.ai_generated ? (
            'Generado por IA'
          ) : (
            'Pendiente de revisar'
          )}
        </span>

        {/* Compact badge right */}
        {item.clarity_pass !== null && (
          <span
            className="shrink-0 inline-flex items-center font-mono text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={
              item.clarity_pass
                ? { color: 'var(--success-2)', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }
                : { color: 'var(--warning-2)', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }
            }
          >
            {item.clarity_pass ? '✓' : '!'}
          </span>
        )}
      </div>

      {/* ── Quick approve — full width footer bar ── */}
      {needsApproval && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id, item.stage as Stage) }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[12.5px] font-semibold transition-colors shrink-0"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderTop: '1px solid rgba(16,185,129,0.22)',
            color: 'var(--success-2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)' }}
        >
          <CheckCircle2 size={14} />
          Aprobar y avanzar
        </button>
      )}
    </div>
  )
}

// ─── Column ──────────────────────────────────────────────────────────────────

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
        minWidth: 244,
        maxWidth: 360,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* ── Column header — simple, no container ── */}
      <div
        className="shrink-0 px-1 pb-4 mb-4 relative"
        style={{ borderBottom: '1px solid var(--line2)' }}
      >
        {/* Marker dot at separator */}
        <div
          className="absolute -bottom-[5px] left-0 w-2.5 h-2.5 rounded-full"
          style={{
            background: cfg.accentHex,
            boxShadow: `0 0 0 3px var(--bg), 0 0 12px ${cfg.accentHex}88`,
          }}
        />

        {/* Title row */}
        <div className="flex items-center gap-2.5 mb-2">
          <Icon size={15} style={{ color: cfg.accentHex }} strokeWidth={2.2} />
          <h3
            className="text-[15px] font-semibold tracking-tight flex-1 truncate"
            style={{ color: 'var(--text)' }}
          >
            {cfg.label}
          </h3>
          <span
            className="font-mono text-[13px] font-bold tabular-nums"
            style={{ color: cfg.accentHex }}
          >
            {filteredItems.length}
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-[12px] leading-snug" style={{ color: 'var(--muted)' }}>
          {cfg.subtitle}
          {cfg.automatic && (
            <span
              className="ml-2 inline-flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded align-middle"
              style={{ color: 'var(--warning-2)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)' }}
            >
              <Zap size={8} /> Auto
            </span>
          )}
        </p>
      </div>

      {/* ── Cards stack ── */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 stagger">
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
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-md text-[11px] font-medium font-mono uppercase tracking-wider"
            style={{ border: '1px dashed var(--line2)', color: 'var(--muted)', opacity: 0.6 }}
          >
            <Zap size={11} /> PostiZ automático
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

// ─── PipelineBoard ───────────────────────────────────────────────────────────

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
      <div className="flex gap-3 h-full overflow-x-auto pb-5 px-4 pt-5 pipeline-scroll">
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
