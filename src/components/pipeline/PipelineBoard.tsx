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

// ─── Config ───────────────────────────────────────────────────────────────────

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

// ─── Board props ──────────────────────────────────────────────────────────────

interface BoardProps {
  items:          ContentItem[]
  filterChannels: Channel[]
  onAdd:          (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:         (id: string, newStage: Stage) => void
  onDelete:       (id: string) => void
  onApprove:      (id: string, currentStage: Stage) => void
}

// ─── StatusDot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     'bg-slate-500',
    in_progress: 'bg-amber-400 animate-pulse-dot',
    approved:    'bg-emerald-400',
    rejected:    'bg-rose-400',
  }
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', map[status] ?? 'bg-slate-500')} />
}

// ─── MetaRow (detail modal helper) ───────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
      {children}
    </div>
  )
}

// ─── CardMenu — portal dropdown (move only, no delete) ───────────────────────

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
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[var(--surface3)]"
        aria-label="Mover a siguiente etapa"
      >
        <MoreHorizontal size={13} className="text-[var(--muted)]" />
      </button>

      {mounted && dropPos && createPortal(
        <>
          {/* Backdrop — closes on click anywhere */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={e => { e.stopPropagation(); setDropPos(null) }}
          />
          {/* Dropdown panel */}
          <div
            className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden py-1"
            style={{
              top:        dropPos.top,
              right:      dropPos.right,
              background: 'var(--surface3)',
              border:     '1px solid var(--border2)',
              minWidth:   190,
            }}
          >
            <button
              onClick={e => {
                e.stopPropagation()
                onMove(item.id, nextStage)
                setDropPos(null)
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-[12px] text-left transition-colors hover:bg-[var(--surface2)]"
              style={{ color: 'var(--text)' }}
            >
              <ChevronRight size={12} style={{ color: nextCfg.accentHex }} />
              Mover a {nextCfg.label}
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ─── AddForm ──────────────────────────────────────────────────────────────────

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
  const base   = { background: 'var(--surface3)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div
      className="animate-fade-in rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Título del contenido..."
        className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none transition-colors"
        style={base}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)' }}
        onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)' }}
      />
      <select
        value={channel}
        onChange={e => setChannel(e.target.value as Channel)}
        className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none"
        style={base}
      >
        {(['linkedin','instagram','facebook','x','blog','email','newsletter'] as Channel[]).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex gap-1.5">
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] transition-colors hover:bg-[var(--surface3)]"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: cfg.accentHex }}
        >
          Añadir
        </button>
      </div>
    </div>
  )
}

// ─── ContentDetailModal ───────────────────────────────────────────────────────

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

      {/* ── Stage progress tracker ── */}
      <div className="flex items-end gap-1 mb-5 -mt-1">
        {STAGES.map((s, idx) => {
          const sCfg    = STAGE_CONFIG[s]
          const SIcon   = STAGE_ICONS[s]
          const isCurrent = s === item.stage
          const isDone    = idx < stageIdx
          return (
            <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: isCurrent ? `${sCfg.accentHex}22` : isDone ? `${sCfg.accentHex}12` : 'var(--surface3)',
                    border:     `1px solid ${isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}45` : 'var(--border)'}`,
                  }}
                >
                  <SIcon size={12} style={{ color: isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}cc` : 'var(--muted)' }} />
                </div>
                <span
                  className="text-[8px] font-semibold text-center leading-none"
                  style={{ color: isCurrent ? sCfg.accentHex : 'var(--muted)' }}
                >
                  {sCfg.label.split(' ')[0]}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className="flex-1 h-px mb-4"
                  style={{ background: isDone ? `${sCfg.accentHex}55` : 'var(--border)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Badges row ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div
          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
          style={{ color: stageCfg.accentHex, background: `${stageCfg.accentHex}18`, border: `1px solid ${stageCfg.accentHex}30` }}
        >
          {stageCfg.label}
        </div>
        {item.ai_generated && (
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: 'var(--accent2)', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.18)' }}
          >
            <Sparkles size={8} /> Generado con IA
          </span>
        )}
        {item.human_approved && item.approved_by && (
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)' }}
          >
            <CheckCheck size={9} /> {item.approved_by}
          </span>
        )}
      </div>

      {/* ── Meta grid ── */}
      <div
        className="grid grid-cols-2 gap-x-5 gap-y-3 mb-4 p-3.5 rounded-xl"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
      >
        <MetaRow label="Canal"><ChannelBadge channel={item.channel as Channel} /></MetaRow>
        <MetaRow label="Mercado">
          <span className="text-[12px]" style={{ color: 'var(--text)' }}>{MARKET_FLAG[item.market] ?? ''} {item.market}</span>
        </MetaRow>
        <MetaRow label="Estado">
          <div className="flex items-center gap-1.5">
            <StatusDot status={item.status} />
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>{STATUS_LABELS[item.status] ?? item.status}</span>
          </div>
        </MetaRow>
        {item.campaign && (
          <MetaRow label="Campaña">
            <span className="text-[12px]" style={{ color: 'var(--text)' }}>{item.campaign}</span>
          </MetaRow>
        )}
        <MetaRow label="Creado">
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </MetaRow>
        <MetaRow label="Actualizado">
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {new Date(item.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </MetaRow>
      </div>

      {/* ── Propuesta / Contenido ── */}
      <div className="mb-4 p-3.5 rounded-xl" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <p className="text-[9.5px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--muted)' }}>
          {item.content ? 'Contenido redactado' : 'Propuesta'}
        </p>
        {item.content ? (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
            {item.content}
          </p>
        ) : (
          <div>
            <p className="text-[14px] font-semibold leading-snug mb-3" style={{ color: 'var(--text)' }}>
              {item.title}
            </p>
            <div
              className="flex items-center gap-2 text-[11px] font-medium px-2.5 py-2 rounded-lg"
              style={{ background: `${stageCfg.accentHex}10`, border: `1px solid ${stageCfg.accentHex}28`, color: stageCfg.accentHex }}
            >
              <Sparkles size={10} />
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

      {/* ── Clarity ── */}
      {item.clarity_pass !== null && (
        <div
          className="flex items-start gap-2.5 mb-4 p-3 rounded-xl"
          style={{
            background: item.clarity_pass ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
            border: `1px solid ${item.clarity_pass ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
          }}
        >
          <span className="text-[13px]" style={{ color: item.clarity_pass ? '#34d399' : '#fbbf24' }}>
            {item.clarity_pass ? '✓' : '⚠'}
          </span>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: item.clarity_pass ? '#34d399' : '#fbbf24' }}>
              Clarity {item.clarity_pass ? 'OK' : 'Requiere revisión'}
            </p>
            {item.clarity_summary && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{item.clarity_summary}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Approval info ── */}
      {item.human_approved && item.approved_by && (
        <div
          className="flex items-center gap-2.5 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}
        >
          <CheckCheck size={14} className="shrink-0" style={{ color: '#34d399' }} />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: '#34d399' }}>
              Aprobado por {item.approved_by}
            </p>
            {item.approved_at && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                {new Date(item.approved_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Scheduled ── */}
      {item.scheduled_at && (
        <div
          className="flex items-center gap-2.5 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <Calendar size={14} className="shrink-0" style={{ color: '#fbbf24' }} />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: '#fbbf24' }}>Programado via PostiZ</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* ── Actions footer ── */}
      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
        {confirmDelete ? (
          <>
            <p className="text-[12px] flex-1" style={{ color: 'var(--muted)' }}>¿Eliminar definitivamente?</p>
            <button
              onClick={() => { onDelete(item.id); onClose() }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all"
              style={{ background: 'rgba(244,63,94,0.75)', border: '1px solid rgba(244,63,94,0.4)' }}
            >
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-[12px] py-1.5">
              Cancelar
            </button>
          </>
        ) : (
          <>
            {/* Delete — left side */}
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:bg-rose-500/10"
              style={{ border: '1px solid rgba(244,63,94,0.2)', color: '#f87171' }}
            >
              <Trash2 size={12} />
              Eliminar
            </button>

            <div className="flex-1" />

            {/* Move — right side */}
            {nextStage && nextCfg && (
              <button
                onClick={() => { onMove(item.id, nextStage); onClose() }}
                className="btn-ghost flex items-center gap-1.5 text-[12px] py-1.5"
              >
                <ArrowRight size={12} style={{ color: nextCfg.accentHex }} />
                Mover a {nextCfg.label}
              </button>
            )}

            {/* Approve — right side, only when needed */}
            {needsApproval && (
              <button
                onClick={() => { onApprove(item.id, item.stage as Stage); onClose() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.15)' }}
              >
                <CheckCircle2 size={12} />
                Aprobar y avanzar
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── ContentCard ──────────────────────────────────────────────────────────────

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
      className={cn(
        'group relative border border-[var(--border)] rounded-xl p-3.5',
        'cursor-pointer transition-all duration-200 animate-fade-in',
      )}
      style={{
        background:       'var(--surface2)',
        borderLeftColor:  stageCfg.accentHex,
        borderLeftWidth:  '2px',
        boxShadow:        '0 1px 3px rgba(0,0,0,0.25)',
      }}
      onClick={() => onSelect(item)}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow     = `0 4px 20px ${stageCfg.accentHex}22, 0 1px 3px rgba(0,0,0,0.3)`
        e.currentTarget.style.borderColor   = `${stageCfg.accentHex}50`
        e.currentTarget.style.borderLeftColor = stageCfg.accentHex
        e.currentTarget.style.transform     = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow     = '0 1px 3px rgba(0,0,0,0.25)'
        e.currentTarget.style.borderColor   = 'var(--border)'
        e.currentTarget.style.borderLeftColor = stageCfg.accentHex
        e.currentTarget.style.transform     = 'translateY(0)'
      }}
    >
      {/* Top row: channel + market + status + menu */}
      <div className="flex items-center justify-between mb-2.5">
        <ChannelBadge channel={item.channel as Channel} />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] leading-none">{MARKET_FLAG[item.market] ?? ''}</span>
          <StatusDot status={item.status} />
          <div onClick={e => e.stopPropagation()}>
            <CardMenu item={item} onMove={onMove} />
          </div>
        </div>
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium leading-snug mb-3" style={{ color: 'var(--text)' }}>
        {item.title}
      </p>

      {/* Footer badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.ai_generated && (
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: 'var(--accent2)', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.18)' }}
          >
            <Sparkles size={8} /> IA
          </span>
        )}
        {item.clarity_pass === true && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-emerald-400" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
            Clarity ✓
          </span>
        )}
        {item.clarity_pass === false && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-amber-400" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            Revisar
          </span>
        )}
        {item.human_approved && item.approved_by && (
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}
          >
            <CheckCheck size={9} /> {item.approved_by}
          </span>
        )}
      </div>

      {/* Scheduled date pill */}
      {item.scheduled_at && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex items-center gap-1.5 text-[10px] font-medium text-amber-400">
          <Calendar size={10} className="shrink-0" />
          {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}

      {/* Quick approve button */}
      {needsApproval && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id, item.stage as Stage) }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150"
          style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)', color: '#34d399' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.22)' }}
        >
          <CheckCircle2 size={12} />
          Aprobar y avanzar
        </button>
      )}
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  stage,
  items,
  filterChannels,
  onAdd,
  onMove,
  onApprove,
  onSelectItem,
}: {
  stage:          Stage
  items:          ContentItem[]
  filterChannels: Channel[]
  onAdd:          (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:         (id: string, newStage: Stage) => void
  onApprove:      (id: string, stage: Stage) => void
  onSelectItem:   (item: ContentItem) => void
}) {
  const cfg  = STAGE_CONFIG[stage]
  const Icon = STAGE_ICONS[stage]
  const [collapsed,    setCollapsed]    = useState(false)
  const [showAddForm,  setShowAddForm]  = useState(false)

  const filteredItems = filterChannels.length === 0
    ? items
    : items.filter(i => filterChannels.includes(i.channel as Channel))

  return (
    <div className="flex flex-col w-[272px] shrink-0 h-full">

      {/* ── Header ── */}
      <button
        className="w-full text-left mb-3 rounded-xl overflow-hidden cursor-pointer transition-all duration-150"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={() => setCollapsed(c => !c)}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${cfg.accentHex}40` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${cfg.accentHex}, ${cfg.accentHex}60)` }} />
        <div className="flex items-center gap-3 px-3.5 py-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${cfg.accentHex}15`, border: `1px solid ${cfg.accentHex}30` }}
          >
            <Icon size={15} style={{ color: cfg.accentHex }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--text)' }}>
                {cfg.label}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                style={{ color: cfg.accentHex, background: `${cfg.accentHex}18`, border: `1px solid ${cfg.accentHex}28` }}
              >
                {filteredItems.length}
              </span>
              {cfg.automatic && (
                <span
                  className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
                >
                  <Zap size={8} /> Auto
                </span>
              )}
            </div>
            <p className="text-[10px] leading-none mt-1" style={{ color: 'var(--muted)' }}>{cfg.subtitle}</p>
          </div>
          <ChevronRight
            size={12}
            className={cn('text-[var(--muted)] transition-transform shrink-0', !collapsed && 'rotate-90')}
          />
        </div>
      </button>

      {/* ── Cards ── */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
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
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium"
              style={{ border: '1px dashed var(--border)', color: 'var(--muted)', opacity: 0.5 }}
            >
              <Zap size={11} /> PostiZ programa automáticamente
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
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11.5px] font-medium transition-all duration-150"
              style={{ border: '1px dashed var(--border)', color: 'var(--muted)' }}
              onMouseEnter={e => {
                e.currentTarget.style.color        = cfg.accentHex
                e.currentTarget.style.borderColor  = `${cfg.accentHex}50`
                e.currentTarget.style.background   = `${cfg.accentHex}08`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color        = 'var(--muted)'
                e.currentTarget.style.borderColor  = 'var(--border)'
                e.currentTarget.style.background   = 'transparent'
              }}
            >
              <Plus size={12} /> Añadir
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PipelineBoard ────────────────────────────────────────────────────────────

export function PipelineBoard({ items, filterChannels, onAdd, onMove, onDelete, onApprove }: BoardProps) {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  // Keep the open modal in sync when items change externally
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
      <div className="flex gap-5 h-full overflow-x-auto pb-4 px-6 pt-5 pipeline-scroll">
        {STAGES.map(stage => (
          <Column
            key={stage}
            stage={stage}
            items={byStage[stage]}
            filterChannels={filterChannels}
            onAdd={onAdd}
            onMove={onMove}
            onApprove={onApprove}
            onSelectItem={setSelectedItem}
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
