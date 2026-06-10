'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, RefreshCw, Loader2,
  FileText, ImageIcon, ShieldCheck, Calendar,
  ArrowRight, X,
} from 'lucide-react'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { Alert, AlertLevel, AlertType } from '@/types/database'

const TYPE_ICON: Record<AlertType, React.ReactNode> = {
  missing_copy:           <FileText size={14} aria-hidden="true" />,
  missing_image:          <ImageIcon size={14} aria-hidden="true" />,
  missing_approval:       <ShieldCheck size={14} aria-hidden="true" />,
  missing_cta:            <ArrowRight size={14} aria-hidden="true" />,
  missing_landing:        <FileText size={14} aria-hidden="true" />,
  package_incomplete:     <AlertTriangle size={14} aria-hidden="true" />,
  scheduled_no_material:  <Calendar size={14} aria-hidden="true" />,
  dependency_not_met:     <AlertTriangle size={14} aria-hidden="true" />,
  market_inconsistency:   <AlertTriangle size={14} aria-hidden="true" />,
}

const TYPE_LABEL: Record<AlertType, string> = {
  missing_copy:           'Sin contenido',
  missing_image:          'Sin imagen',
  missing_approval:       'Sin aprobar',
  missing_cta:            'Sin CTA',
  missing_landing:        'Sin landing',
  package_incomplete:     'Paquete incompleto',
  scheduled_no_material:  'Sin material',
  dependency_not_met:     'Dependencia',
  market_inconsistency:   'Inconsistencia mercado',
}

const LEVEL_STYLE: Record<AlertLevel, { bg: string; fg: string; border: string; label: string }> = {
  critical: {
    bg: 'var(--red-soft)', fg: 'var(--red-2)',
    border: 'rgba(239,68,68,0.30)', label: 'Crítica',
  },
  warning: {
    bg: 'var(--amber-soft)', fg: '#b25000',
    border: 'rgba(255,159,10,0.30)', label: 'Aviso',
  },
  info: {
    bg: 'var(--accent-soft)', fg: 'var(--accent-2)',
    border: 'var(--accent-border)', label: 'Info',
  },
}

type FilterTab = 'active' | 'resolved'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('active')
  const [levelFilter, setLevelFilter] = useState<AlertLevel | 'all'>('all')
  const [scanning, setScanning] = useState(false)
  const { items: toasts, show: toast, remove: removeToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/alerts?resolved=${tab === 'resolved'}`)
      if (!res.ok) {
        toast(`Error cargando alertas`, 'error')
        return
      }
      setAlerts(await res.json() as Alert[])
    } finally {
      setLoading(false)
    }
  }, [tab, toast])

  useEffect(() => { load() }, [load])

  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/alerts/scan', { method: 'POST' })
      if (!res.ok) {
        toast('Error ejecutando scan', 'error')
        return
      }
      const data = await res.json() as {
        scanned_items: number
        inserted: number
        updated: number
        auto_resolved: number
      }
      toast(
        `Scan completado · ${data.inserted} nuevas, ${data.updated} actualizadas, ${data.auto_resolved} auto-resueltas`,
        'success',
      )
      await load()
    } finally {
      setScanning(false)
    }
  }

  const handleResolve = async (id: string, resolved: boolean) => {
    const res = await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    })
    if (res.ok) {
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast(resolved ? 'Alerta resuelta' : 'Alerta reabierta', 'success')
    } else {
      toast('Error actualizando', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast('Alerta eliminada', 'info')
    } else {
      toast('Error eliminando', 'error')
    }
  }

  const filteredAlerts = levelFilter === 'all'
    ? alerts
    : alerts.filter(a => a.level === levelFilter)

  const counts = {
    critical: alerts.filter(a => a.level === 'critical').length,
    warning:  alerts.filter(a => a.level === 'warning').length,
    info:     alerts.filter(a => a.level === 'info').length,
  }

  return (
    <div
      className="p-4 sm:p-6"
      style={{
        background: 'var(--bg)',
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em',
            color: 'var(--ink)', lineHeight: 1, margin: 0,
          }}>
            Alertas
          </h1>
          <p style={{
            fontSize: 12, fontWeight: 500, color: 'var(--ink-3)',
            margin: '3px 0 0', letterSpacing: '0.01em',
          }}>
            Avisos sobre piezas próximas a publicar
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="btn-cta"
        >
          {scanning
            ? <><Loader2 size={13} className="animate-spin" /> Escaneando…</>
            : <><RefreshCw size={13} /> Ejecutar scan</>}
        </button>
      </div>

      {/* Tabs + stat pills */}
      <div
        className="flex items-center gap-3 mb-4 flex-wrap"
        style={{
          padding: '14px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {/* Tabs activas / resueltas */}
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--radius-pill)' }}>
          <button
            onClick={() => setTab('active')}
            style={{
              height: 28, padding: '0 14px', fontSize: 12, fontWeight: 600,
              background: tab === 'active' ? 'var(--surface)' : 'transparent',
              color: tab === 'active' ? 'var(--ink)' : 'var(--ink-3)',
              border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
              boxShadow: tab === 'active' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Activas
          </button>
          <button
            onClick={() => setTab('resolved')}
            style={{
              height: 28, padding: '0 14px', fontSize: 12, fontWeight: 600,
              background: tab === 'resolved' ? 'var(--surface)' : 'transparent',
              color: tab === 'resolved' ? 'var(--ink)' : 'var(--ink-3)',
              border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
              boxShadow: tab === 'resolved' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Resueltas
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Filtros por nivel */}
        {tab === 'active' && (
          <>
            {(['all', 'critical', 'warning', 'info'] as const).map(lvl => {
              const isActive = levelFilter === lvl
              const count = lvl === 'all' ? alerts.length : counts[lvl as AlertLevel]
              const style = lvl !== 'all' ? LEVEL_STYLE[lvl as AlertLevel] : null
              return (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  style={{
                    height: 28, padding: '0 12px', fontSize: 12, fontWeight: 600,
                    background: isActive ? (style?.bg ?? 'var(--accent-soft)') : 'transparent',
                    color: isActive ? (style?.fg ?? 'var(--accent-2)') : 'var(--ink-2)',
                    border: '1px solid',
                    borderColor: isActive ? (style?.border ?? 'var(--accent-border)') : 'transparent',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {lvl === 'all' ? 'Todas' : style?.label}
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 6px',
                    background: isActive ? 'rgba(255,255,255,0.5)' : 'var(--surface-2)',
                    borderRadius: 999, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          <Loader2 size={20} className="animate-spin inline-block mr-2" aria-hidden="true" />
          Cargando alertas…
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div
          style={{
            padding: 60, textAlign: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <CheckCircle2 size={32} style={{ color: 'var(--green-2)', opacity: 0.6, marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            {tab === 'active' ? '¡Todo en orden!' : 'Sin alertas resueltas'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {tab === 'active'
              ? 'No hay alertas activas. Pulsa "Ejecutar scan" para volver a revisar.'
              : 'Las alertas que resuelvas aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredAlerts.map(alert => {
            const style = LEVEL_STYLE[alert.level]
            const dueDate = alert.due_at ? new Date(alert.due_at) : null
            const daysToDue = dueDate ? Math.floor((dueDate.getTime() - Date.now()) / 86400000) : null

            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${style.fg}`,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div
                  style={{
                    width: 32, height: 32,
                    background: style.bg, color: style.fg,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {TYPE_ICON[alert.type]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      background: style.bg, color: style.fg,
                      borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {style.label}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--ink-3)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {TYPE_LABEL[alert.type]}
                    </span>
                    {dueDate && daysToDue !== null && (
                      <span style={{
                        fontSize: 11, color: daysToDue < 3 ? 'var(--red-2)' : 'var(--ink-3)',
                        fontWeight: daysToDue < 3 ? 700 : 500,
                        marginLeft: 'auto',
                      }}>
                        {daysToDue < 0
                          ? `Vencida hace ${Math.abs(daysToDue)}d`
                          : daysToDue === 0
                          ? 'Hoy'
                          : `En ${daysToDue} día${daysToDue === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: 14, fontWeight: 600, color: 'var(--ink)',
                    margin: 0, lineHeight: 1.3,
                  }}>
                    {alert.title}
                  </p>
                  {alert.description && (
                    <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.45 }}>
                      {alert.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {alert.related_content_item_id && (
                      <Link
                        href="/pipeline"
                        style={{
                          fontSize: 11, fontWeight: 600, color: 'var(--accent-2)',
                          textDecoration: 'none',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        Ver en pipeline <ArrowRight size={10} aria-hidden="true" />
                      </Link>
                    )}
                    {alert.resolved && alert.resolved_at && (
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        Resuelta {new Date(alert.resolved_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!alert.resolved ? (
                    <button
                      onClick={() => handleResolve(alert.id, true)}
                      aria-label="Marcar como resuelta"
                      title="Marcar como resuelta"
                      style={{
                        width: 30, height: 30,
                        background: 'var(--green-soft)', color: 'var(--green-2)',
                        border: 'none', borderRadius: 'var(--radius-pill)',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResolve(alert.id, false)}
                      aria-label="Reabrir"
                      title="Reabrir"
                      style={{
                        width: 30, height: 30,
                        background: 'var(--surface-2)', color: 'var(--ink-2)',
                        border: 'none', borderRadius: 'var(--radius-pill)',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <RefreshCw size={13} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(alert.id)}
                    aria-label="Eliminar"
                    title="Eliminar"
                    style={{
                      width: 30, height: 30,
                      background: 'var(--surface-2)', color: 'var(--ink-3)',
                      border: 'none', borderRadius: 'var(--radius-pill)',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
