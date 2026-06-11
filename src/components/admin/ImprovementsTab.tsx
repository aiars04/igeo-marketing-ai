'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bug, Wrench, Sparkles, AlertTriangle, Zap,
  Check, RotateCcw, Trash2, Loader2, X, ExternalLink,
  Copy as CopyIcon, ClipboardCheck, MessageSquarePlus, Filter,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type {
  Improvement, ImprovementType, ImprovementPriority, ImprovementStatus,
} from '@/types/database'

const TYPE_META: Record<ImprovementType, { label: string; color: string; icon: React.ElementType }> = {
  bug:    { label: 'Bug',        color: '#dc2626', icon: Bug },
  mejora: { label: 'Mejora',     color: '#2563eb', icon: Wrench },
  idea:   { label: 'Idea nueva', color: '#7c3aed', icon: Sparkles },
}
const PRIORITY_META: Record<ImprovementPriority, { label: string; color: string; icon: React.ElementType | null }> = {
  baja:  { label: 'Puede esperar', color: '#64748b', icon: null },
  media: { label: 'Cuanto antes',  color: '#f59e0b', icon: Zap },
  alta:  { label: 'Es urgente',    color: '#dc2626', icon: AlertTriangle },
}
const STATUS_META: Record<ImprovementStatus, { label: string; bg: string; fg: string }> = {
  pendiente:  { label: 'Pendiente',  bg: 'var(--amber-soft)', fg: '#b25000' },
  revisada:   { label: 'Revisada',   bg: 'var(--accent-soft)', fg: 'var(--accent-2)' },
  completada: { label: 'Completada', bg: 'var(--green-soft)', fg: 'var(--green-2)' },
  descartada: { label: 'Descartada', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
}

type StatusFilter = 'all' | ImprovementStatus

export function ImprovementsTab({
  toast,
}: {
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const [items, setItems] = useState<Improvement[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendiente')
  const [detail, setDetail] = useState<Improvement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/improvements')
      if (res.ok) {
        const data = await res.json() as Improvement[]
        setItems(data)
      } else if (res.status === 403) {
        toast('Solo admin/manager puede ver las sugerencias', 'error')
      } else {
        toast('Error cargando sugerencias', 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleChangeStatus = async (id: string, status: ImprovementStatus) => {
    const res = await fetch(`/api/improvements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json() as Improvement
      setItems(prev => prev.map(x => x.id === id ? updated : x))
      if (detail?.id === id) setDetail(updated)
      toast(`Estado: ${STATUS_META[status].label}`, 'success')
    } else {
      toast('Error actualizando', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta sugerencia? No se podrá recuperar.')) return
    const res = await fetch(`/api/improvements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(prev => prev.filter(x => x.id !== id))
      if (detail?.id === id) setDetail(null)
      toast('Sugerencia eliminada', 'info')
    } else {
      const j = await res.json().catch(() => ({}))
      toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
    }
  }

  const counts = {
    pendiente:  items.filter(x => x.status === 'pendiente').length,
    revisada:   items.filter(x => x.status === 'revisada').length,
    completada: items.filter(x => x.status === 'completada').length,
    descartada: items.filter(x => x.status === 'descartada').length,
  }

  const filtered = statusFilter === 'all'
    ? items
    : items.filter(x => x.status === statusFilter)

  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Sugerencias del equipo
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
            Bugs, mejoras e ideas reportadas por los usuarios. Convierte en prompt para Claude con un click.
          </p>
        </div>
        <button className="btn-pill-secondary" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
          Refrescar
        </button>
      </div>

      {/* Filtros + stats */}
      <div
        className="flex items-center gap-2 mb-4 flex-wrap"
        style={{
          padding: '12px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <Filter size={13} aria-hidden="true" style={{ color: 'var(--ink-3)', marginRight: 4 }} />
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={items.length}>
          Todas
        </FilterChip>
        <FilterChip active={statusFilter === 'pendiente'} onClick={() => setStatusFilter('pendiente')} count={counts.pendiente} tone="amber">
          Pendientes
        </FilterChip>
        <FilterChip active={statusFilter === 'revisada'} onClick={() => setStatusFilter('revisada')} count={counts.revisada} tone="accent">
          Revisadas
        </FilterChip>
        <FilterChip active={statusFilter === 'completada'} onClick={() => setStatusFilter('completada')} count={counts.completada} tone="success">
          Completadas
        </FilterChip>
        <FilterChip active={statusFilter === 'descartada'} onClick={() => setStatusFilter('descartada')} count={counts.descartada}>
          Descartadas
        </FilterChip>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Loader2 size={20} className="animate-spin inline-block mr-2" />
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 60, textAlign: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <MessageSquarePlus size={32} aria-hidden="true" style={{ color: 'var(--ink-3)', opacity: 0.4, marginBottom: 10 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            Sin sugerencias {statusFilter !== 'all' && `${STATUS_META[statusFilter as ImprovementStatus].label.toLowerCase()}s`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Las sugerencias enviadas con el botón &quot;Sugerir mejoras&quot; del sidebar aparecerán aquí.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <Row key={item.id} item={item} onClick={() => setDetail(item)} />
          ))}
        </div>
      )}

      {detail && (
        <DetailModal
          item={detail}
          onClose={() => setDetail(null)}
          onChangeStatus={handleChangeStatus}
          onDelete={handleDelete}
          toast={toast}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function Row({ item, onClick }: { item: Improvement; onClick: () => void }) {
  const tMeta = TYPE_META[item.type]
  const pMeta = PRIORITY_META[item.priority]
  const sMeta = STATUS_META[item.status]
  const TIcon = tMeta.icon
  const PIcon = pMeta.icon
  const sender = item.created_by_name || item.created_by_email?.split('@')[0] || 'Anónimo'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${tMeta.color}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{
        width: 38, height: 38, flexShrink: 0,
        background: `${tMeta.color}15`,
        color: tMeta.color,
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <TIcon size={16} aria-hidden="true" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: sMeta.bg, color: sMeta.fg,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {sMeta.label}
          </span>
          <span style={{
            fontSize: 10.5, color: pMeta.color, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {PIcon && <PIcon size={10} aria-hidden="true" />}
            {pMeta.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            · {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <p style={{
          fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
          por {sender}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function DetailModal({
  item, onClose, onChangeStatus, onDelete, toast,
}: {
  item: Improvement
  onClose: () => void
  onChangeStatus: (id: string, status: ImprovementStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const tMeta = TYPE_META[item.type]
  const pMeta = PRIORITY_META[item.priority]
  const sMeta = STATUS_META[item.status]
  const TIcon = tMeta.icon
  const sender = item.created_by_name || item.created_by_email?.split('@')[0] || 'Anónimo'
  const isImage = item.attachment_url.match(/\.(png|jpe?g|webp|gif)$/i)
  const isVideo = item.attachment_url.match(/\.(mp4|webm)$/i)

  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyPrompt = async () => {
    setCopying(true)
    try {
      const res = await fetch(`/api/improvements/${item.id}/claude-prompt`)
      if (!res.ok) {
        toast('Error generando prompt', 'error')
        return
      }
      const { prompt } = await res.json() as { prompt: string }
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast('Prompt copiado — pégalo en Claude Code', 'success')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      toast(`Error: ${err instanceof Error ? err.message : 'no_se_pudo'}`, 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={item.title} size="lg">
      <div className="flex flex-col gap-4">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 999,
            background: `${tMeta.color}15`, color: tMeta.color,
            fontSize: 11, fontWeight: 700,
          }}>
            <TIcon size={11} aria-hidden="true" /> {tMeta.label}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 999,
            background: `${pMeta.color}15`, color: pMeta.color,
            fontSize: 11, fontWeight: 700,
          }}>
            Prioridad {pMeta.label}
          </span>
          <span style={{
            padding: '3px 9px', borderRadius: 999,
            background: sMeta.bg, color: sMeta.fg,
            fontSize: 11, fontWeight: 700,
          }}>
            {sMeta.label}
          </span>
        </div>

        {/* Meta */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
          padding: 14, background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Reportado por
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginTop: 3 }}>
              {sender}
            </p>
            {item.created_by_email && (
              <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>{item.created_by_email}</p>
            )}
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Fecha
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginTop: 3 }}>
              {new Date(item.created_at).toLocaleString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Descripción */}
        {item.description && (
          <div>
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
            }}>
              Descripción
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {item.description}
            </p>
          </div>
        )}

        {/* Captura */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Captura adjunta
            </p>
            <a
              href={item.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11, color: 'var(--accent-2)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                textDecoration: 'none',
              }}
            >
              Abrir en pestaña nueva <ExternalLink size={10} aria-hidden="true" />
            </a>
          </div>
          <div style={{
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: '#0f172a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            maxHeight: 380,
          }}>
            {isImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.attachment_url} alt="Captura" style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain' }} />
            )}
            {isVideo && (
              <video src={item.attachment_url} controls style={{ maxWidth: '100%', maxHeight: 380 }} />
            )}
            {!isImage && !isVideo && (
              <a
                href={item.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: 30, color: '#94a3b8' }}
              >
                Descargar adjunto
              </a>
            )}
          </div>
        </div>

        {/* Footer acciones */}
        <div className="flex items-center gap-2 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Botón estrella: copiar prompt Claude */}
          <button
            onClick={handleCopyPrompt}
            disabled={copying}
            style={{
              padding: '0 16px', height: 36,
              background: copied
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
              color: '#fff', fontWeight: 700, fontSize: 12.5,
              border: 'none', borderRadius: 'var(--radius-pill)',
              cursor: copying ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
            }}
          >
            {copying
              ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Generando…</>
              : copied
                ? <><ClipboardCheck size={13} aria-hidden="true" /> Copiado · pégalo en Claude</>
                : <><CopyIcon size={13} aria-hidden="true" /> Copiar prompt para Claude</>}
          </button>

          <div style={{ flex: 1 }} />

          {/* Cambios de estado */}
          {item.status !== 'revisada' && (
            <button
              onClick={() => onChangeStatus(item.id, 'revisada')}
              className="btn-pill-secondary"
              style={{ fontSize: 11 }}
            >
              Revisada
            </button>
          )}
          {item.status !== 'completada' && (
            <button
              onClick={() => onChangeStatus(item.id, 'completada')}
              className="btn-pill-secondary"
              style={{ fontSize: 11, color: 'var(--green-2)' }}
            >
              <Check size={11} aria-hidden="true" /> Completada
            </button>
          )}
          {item.status !== 'descartada' && (
            <button
              onClick={() => onChangeStatus(item.id, 'descartada')}
              className="btn-pill-secondary"
              style={{ fontSize: 11, color: 'var(--ink-3)' }}
            >
              <X size={11} aria-hidden="true" /> Descartar
            </button>
          )}
          {item.status !== 'pendiente' && (
            <button
              onClick={() => onChangeStatus(item.id, 'pendiente')}
              className="btn-pill-secondary"
              style={{ fontSize: 11 }}
              title="Reabrir como pendiente"
            >
              <RotateCcw size={11} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            style={{
              width: 32, height: 32, borderRadius: 'var(--radius-pill)',
              background: 'var(--red-soft)', color: 'var(--red-2)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Eliminar"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function FilterChip({
  active, onClick, count, children, tone,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
  tone?: 'amber' | 'success' | 'accent'
}) {
  const colors = {
    amber:   { bg: 'var(--amber-soft)', fg: '#b25000' },
    success: { bg: 'var(--green-soft)', fg: 'var(--green-2)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent-2)' },
  }
  const style = tone ? colors[tone] : { bg: 'var(--surface-2)', fg: 'var(--ink-2)' }
  return (
    <button
      onClick={onClick}
      style={{
        height: 28, padding: '0 12px',
        background: active ? style.bg : 'transparent',
        color: active ? style.fg : 'var(--ink-2)',
        border: '1px solid',
        borderColor: active ? 'transparent' : 'var(--border)',
        borderRadius: 'var(--radius-pill)',
        fontSize: 12, fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {children}
      <span style={{
        fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
        background: active ? 'rgba(255,255,255,0.5)' : 'var(--surface-2)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {count}
      </span>
    </button>
  )
}
