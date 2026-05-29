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

const MARKET_LABEL: Record<string, string> = {
  spain: 'ES', latam: 'LATAM', uk: 'UK', france: 'FR',
  italy: 'IT', portugal: 'PT', brasil: 'BR',
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

// ─── CardMenu (lógica intacta) ───────────────────────────────────────────────

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
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
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

// ─── AddForm (lógica intacta) ────────────────────────────────────────────────

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
      className="animate-fade-in rounded-[10px] p-3 flex flex-col gap-2"
      style={{ background: 'var(--surface2)', border: `1px solid ${cfg.accentHex}55` }}
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
    stage:   { bg: 'var(--accent-soft)',         color: 'var(--accent)', border: '1px solid var(--accent-border)' },
    ai:      { bg: 'rgba(175, 82, 222, 0.08)',   color: '#7c3aed',       border: '1px solid rgba(175, 82, 222, 0.25)' },
    user:    { bg: 'var(--green-soft)',          color: '#248a3d',       border: '1px solid var(--green-border)' },
    warning: { bg: 'var(--amber-soft)',          color: '#b25000',       border: '1px solid rgba(255, 159, 10, 0.25)' },
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
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  )
}

// Limpia markdown crudo al inicio de líneas: #, ##, ###, -, *
function stripMarkdown(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/^\s*(?:#{1,6}|[-*])\s*/, ''))
    .join('\n')
    .trim()
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
                    borderRadius: 8,
                    background: isCurrent
                      ? sCfg.accentHex
                      : isDone
                      ? `${sCfg.accentHex}1f`
                      : 'var(--surface-2)',
                    border: `1px solid ${isCurrent ? sCfg.accentHex : isDone ? `${sCfg.accentHex}55` : 'var(--border)'}`,
                    boxShadow: isCurrent ? `0 0 0 3px ${sCfg.accentHex}22` : 'none',
                  }}
                >
                  <SIcon
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
                    background: isDone ? `${sCfg.accentHex}55` : 'var(--border)',
                    marginTop: 17.5,
                    minWidth: 8,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

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
          borderRadius: 10,
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

      {/* ── Sección Contenido ── */}
      <div
        style={{
          background: 'var(--surface-2)',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <p
          className="uppercase"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--ink-3)',
            marginBottom: 10,
          }}
        >
          {item.content ? 'Contenido' : 'Propuesta'}
        </p>
        {item.content ? (
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {stripMarkdown(item.content)}
          </p>
        ) : (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: 'var(--ink)', marginBottom: 12 }}>
              {item.title}
            </p>
            <div
              className="inline-flex items-center"
              style={{
                gap: 6,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: `${stageCfg.accentHex}15`,
                border: `1px solid ${stageCfg.accentHex}35`,
                color: stageCfg.accentHex,
              }}
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

      {/* ── Clarity — chip verde según specs ── */}
      {item.clarity_pass !== null && (
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '12px 14px',
            marginBottom: 16,
            background: item.clarity_pass ? 'var(--green-soft)' : 'var(--amber-soft)',
            border: `1px solid ${item.clarity_pass ? 'var(--green-border)' : 'rgba(255,159,10,0.25)'}`,
            borderRadius: 8,
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
            <CheckCircle2 size={13} style={{ color: item.clarity_pass ? '#248a3d' : '#b25000' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: item.clarity_pass ? '#248a3d' : '#b25000',
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
            border: '1px solid rgba(255,159,10,0.25)',
            borderRadius: 8,
          }}
        >
          <Calendar size={16} className="shrink-0" style={{ color: '#b25000' }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#b25000', lineHeight: 1.3 }}>
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
                borderRadius: 980,
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
                borderRadius: 980,
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
                borderRadius: 980,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-soft)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Trash2 size={13} /> Eliminar
            </button>

            <div style={{ flex: 1 }} />

            {/* Mover a X — CTA primario derecha */}
            {needsApproval ? (
              <button
                onClick={() => { onApprove(item.id, item.stage as Stage); onClose() }}
                className="inline-flex items-center transition-colors"
                style={{
                  gap: 6,
                  height: 36,
                  padding: '0 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 980,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--orange-hover)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,113,227,0.30)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <CheckCircle2 size={14} /> Aprobar y avanzar
              </button>
            ) : next && nextCfg ? (
              <button
                onClick={() => { onMove(item.id, next); onClose() }}
                className="inline-flex items-center transition-colors"
                style={{
                  gap: 6,
                  height: 36,
                  padding: '0 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 980,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--orange-hover)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,113,227,0.30)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                Mover a {nextCfg.label} <ArrowRight size={13} />
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
  item, onMove, onApprove, onSelect,
}: {
  item: ContentItem
  onMove: (id: string, s: Stage) => void
  onApprove: (id: string, s: Stage) => void
  onSelect: (item: ContentItem) => void
}) {
  const cfg = STAGE_CONFIG[item.stage as Stage]
  const needsApproval = APPROVAL_STAGES.includes(item.stage as Stage) && !item.human_approved

  // Iniciales del responsable
  const initials = item.human_approved && item.approved_by
    ? item.approved_by.slice(0, 2).toUpperCase()
    : null

  return (
    <article
      className="pcard group animate-fade-up cursor-pointer flex flex-col"
      data-channel={item.channel}
      style={{ gap: 10 }}
      onClick={() => onSelect(item)}
    >
      {/* ── Fila superior: badge canal + ES + status dot + menu ── */}
      <div className="flex items-center justify-between gap-2">
        <ChannelBadge channel={item.channel as Channel} />
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
                  color: '#248a3d',
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
                borderRadius: 980,
                color: '#248a3d',
                background: 'var(--green-soft)',
                border: '1px solid var(--green-border)',
                lineHeight: 1,
              }}
            >
              <CheckCheck size={11} /> Aprobado
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
                borderRadius: 980,
                color: '#b25000',
                background: 'var(--amber-soft)',
                border: '1px solid rgba(255,159,10,0.25)',
                lineHeight: 1,
              }}
            >
              <Calendar size={10} />
              {new Date(item.scheduled_at).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short',
              })}
            </span>
          )}
        </div>
      )}

      {/* ── Botón Aprobar y avanzar — ghost refinado ── */}
      {needsApproval && (
        <button
          onClick={e => { e.stopPropagation(); onApprove(item.id, item.stage as Stage) }}
          className="w-full inline-flex items-center justify-center"
          style={{
            gap: 5,
            height: 28,
            marginTop: 8,
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 980,
            color: 'var(--ink-2)',
            background: 'transparent',
            border: '1px solid var(--border)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--accent)'
            e.currentTarget.style.background = 'var(--accent-soft)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--ink-2)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          Aprobar y avanzar
          <ArrowRight size={13} />
        </button>
      )}
    </article>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN — cabecera grande, fondo diferenciado, gap 16px
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
              background: filtered.length > 0 ? `${cfg.accentHex}1a` : 'transparent',
              border: filtered.length > 0 ? `1px solid ${cfg.accentHex}40` : '1px solid var(--border)',
              borderRadius: 5,
            }}
          >
            <Icon
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
              borderRadius: 4,
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
                borderRadius: 4,
                color: '#248a3d',
                background: 'var(--green-soft)',
                border: '1px solid var(--green-border)',
              }}
            >
              <Zap size={8} /> AUTO
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
            onMove={onMove}
            onApprove={onApprove}
            onSelect={onSelectItem}
          />
        ))}

        {cfg.automatic ? (
          <div
            className="w-full flex items-center justify-center gap-1.5 px-3 py-3 rounded-[10px] text-[11.5px] font-medium"
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
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-[12px] font-medium transition-all"
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
// BOARD — scroll horizontal funcional, gap 16px entre columnas
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
