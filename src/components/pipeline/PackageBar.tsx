'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ChevronRight, Calendar } from 'lucide-react'
import type { CampaignPackage, PlaybookType, PackageStatus } from '@/types/database'

export interface PackageWithStats extends CampaignPackage {
  stats: {
    total: number
    approved: number
    pending: number
    scheduled: number
    published: number
  }
}

const TYPE_ICON: Record<PlaybookType, string> = {
  webinar: '🎥', event_presential: '📍', event_online: '💻',
  release: '🚀', newsletter: '📰', campaign: '🎯',
  alliance: '🤝', workshop: '🛠️', lead_magnet: '🧲',
  reactivation: '💌', podcast: '🎙️',
}

const STATUS_COLOR: Record<PackageStatus, { bg: string; fg: string; label: string }> = {
  draft:     { bg: 'var(--surface-2)',  fg: 'var(--ink-2)',  label: 'Borrador'   },
  active:    { bg: 'var(--green-soft)', fg: 'var(--green-2)', label: 'Activo'    },
  completed: { bg: 'var(--accent-soft)', fg: 'var(--accent-2)', label: 'Completado' },
  cancelled: { bg: 'var(--red-soft)',   fg: 'var(--red-2)',   label: 'Cancelado' },
}

/**
 * Barra horizontal de paquetes activos en el pipeline.
 * Click en chip = filtra el kanban por ese package.
 * Click en "Ver detalle" = abre el modal de detalle.
 */
export function PackageBar({
  selectedPackageId,
  onSelect,
  onOpenDetail,
  refreshKey,
}: {
  selectedPackageId: string | null
  onSelect: (id: string | null) => void
  onOpenDetail: (pkg: PackageWithStats) => void
  refreshKey?: number
}) {
  const [packages, setPackages] = useState<PackageWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/campaign-packages')
      if (res.ok) {
        const data = await res.json() as PackageWithStats[]
        // Mostrar solo packages activos o draft (no completed/cancelled)
        setPackages(data.filter(p => p.status === 'draft' || p.status === 'active'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load, refreshKey])

  if (loading) {
    return (
      <div style={{ padding: '10px 20px', fontSize: 11, color: 'var(--ink-3)' }}>
        Cargando paquetes…
      </div>
    )
  }

  if (packages.length === 0) {
    return null  // No paquetes activos → no se muestra barra
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <span
        style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--ink-3)',
          marginRight: 4, flexShrink: 0,
        }}
      >
        Paquetes
      </span>

      {/* Chip "Todos" — limpia filtro */}
      <button
        onClick={() => onSelect(null)}
        style={{
          height: 28, padding: '0 12px',
          fontSize: 11.5, fontWeight: 600,
          background: selectedPackageId === null ? 'var(--accent)' : 'var(--surface-2)',
          color: selectedPackageId === null ? '#fff' : 'var(--ink-2)',
          border: 'none', borderRadius: 'var(--radius-pill)',
          cursor: 'pointer', flexShrink: 0,
          transition: 'all 0.12s',
        }}
      >
        Todos
      </button>

      {packages.map(pkg => {
        const selected = pkg.id === selectedPackageId
        const statusCfg = STATUS_COLOR[pkg.status]
        const progress = pkg.stats.total > 0
          ? Math.round((pkg.stats.approved / pkg.stats.total) * 100)
          : 0

        return (
          <button
            key={pkg.id}
            onClick={() => onSelect(selected ? null : pkg.id)}
            onDoubleClick={() => onOpenDetail(pkg)}
            title={`${pkg.title} — doble-click para ver detalle`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 32, padding: '0 12px 0 10px',
              background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.12s',
            }}
          >
            <span style={{ fontSize: 14 }}>{TYPE_ICON[pkg.package_type as PlaybookType] ?? '📦'}</span>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: selected ? 'var(--accent-2)' : 'var(--ink)',
              maxWidth: 180,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {pkg.title}
            </span>
            <span
              style={{
                fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                padding: '2px 6px', borderRadius: 4,
                background: statusCfg.bg, color: statusCfg.fg,
              }}
            >
              {pkg.stats.approved}/{pkg.stats.total}
            </span>
            {progress === 100 && (
              <span style={{ fontSize: 11, color: 'var(--green-2)' }}>✓</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Modal de detalle de un paquete con la lista completa de sus items.
 */
export function PackageDetailModal({
  pkg,
  onClose,
}: {
  pkg: PackageWithStats
  onClose: () => void
}) {
  type ItemSummary = {
    id: string
    title: string
    stage: string
    channel: string
    scheduled_at: string | null
    human_approved: boolean
  }
  const [items, setItems] = useState<ItemSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/campaign-packages/${pkg.id}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ items: ItemSummary[] }>
      })
      .then(data => { if (!cancelled) setItems(data.items ?? []) })
      .catch(err => {
        if (cancelled) return
        console.warn('[PackageDetailModal] load failed:', err)
        setLoadError(err instanceof Error ? err.message : 'load_failed')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pkg.id])

  const statusCfg = STATUS_COLOR[pkg.status]
  const progress = pkg.stats.total > 0
    ? Math.round((pkg.stats.approved / pkg.stats.total) * 100)
    : 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '85vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <div
            style={{
              width: 44, height: 44,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}
          >
            {TYPE_ICON[pkg.package_type as PlaybookType] ?? '📦'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: 17, fontWeight: 700, color: 'var(--ink)',
              margin: 0, lineHeight: 1.2,
            }}>
              {pkg.title}
            </h2>
            <p style={{
              fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span
                style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: statusCfg.bg, color: statusCfg.fg, fontWeight: 700,
                }}
              >
                {statusCfg.label}
              </span>
              {pkg.anchor_date && (
                <>
                  <Calendar size={11} aria-hidden="true" />
                  Ancla: {new Date(pkg.anchor_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32, height: 32, flexShrink: 0,
              background: 'var(--surface-2)', border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-2)',
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Progress + stats */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
              Progreso de aprobación
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {pkg.stats.approved} / {pkg.stats.total} ({progress}%)
            </span>
          </div>
          <div
            style={{
              height: 6, background: 'var(--surface-2)',
              borderRadius: 999, overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`, height: '100%',
                background: progress === 100 ? 'var(--green)' : 'var(--accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div className="flex items-center gap-3 mt-3" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <span>📝 {pkg.stats.pending} pendientes</span>
            <span>📅 {pkg.stats.scheduled} programadas</span>
            <span>📡 {pkg.stats.published} publicadas</span>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px' }}>
          {loading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>
              Cargando piezas…
            </p>
          ) : loadError ? (
            <p style={{ fontSize: 12, color: 'var(--red-2)', textAlign: 'center', padding: 20 }}>
              Error cargando las piezas: {loadError}
            </p>
          ) : items.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: 20 }}>
              Este paquete no tiene piezas asignadas.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: item.human_approved ? 'var(--green-soft)' : 'var(--amber-soft)',
                      color: item.human_approved ? 'var(--green-2)' : 'var(--amber-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}
                  >
                    {item.human_approved ? '✓' : '·'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12.5, fontWeight: 600, color: 'var(--ink)',
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                      {item.channel} · {item.stage}
                      {item.scheduled_at && ` · ${new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <ChevronRight size={13} aria-hidden="true" style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
