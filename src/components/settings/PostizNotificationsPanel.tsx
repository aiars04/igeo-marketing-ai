'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'

interface PostizNotification {
  id:        string
  content:   string
  link:      string | null
  createdAt: string
}

interface NotificationsPage {
  notifications: PostizNotification[]
  total:         number
  page:          number
  hasMore:       boolean
  error?:        string
}

/**
 * Panel de notificaciones de Postiz: muestra el histórico de publicaciones
 * exitosas y fallidas tal y como las reporta Postiz Web. Refresh manual
 * (no hay webhooks, así que no hay sync en tiempo real).
 */
export function PostizNotificationsPanel() {
  const [items, setItems] = useState<PostizNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/postiz/notifications', { cache: 'no-store' })
      const data = await res.json() as NotificationsPage
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`)
      } else {
        setItems(data.notifications ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // Heurística para clasificar (Postiz solo da texto libre):
  // "published successfully" → éxito, "Failed" → error, resto → info.
  const classify = (content: string): 'success' | 'error' | 'info' => {
    const c = content.toLowerCase()
    if (c.includes('fail') || c.includes('error')) return 'error'
    if (c.includes('publish') && c.includes('success')) return 'success'
    return 'info'
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16, gap: 12 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <Bell size={16} style={{ color: 'var(--ink-2)' }} aria-hidden="true" />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Histórico de Postiz
          </h3>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center transition-colors"
          style={{
            gap: 6,
            height: 30,
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-2)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            cursor: refreshing ? 'wait' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing
            ? <><Loader2 size={11} className="animate-spin" aria-hidden="true" /> Actualizando…</>
            : <><RefreshCw size={11} aria-hidden="true" /> Refrescar</>}
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: 16 }}>
          <Loader2 size={14} className="animate-spin" style={{ display: 'inline-block', marginRight: 6 }} aria-hidden="true" />
          Cargando…
        </div>
      ) : error ? (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12, color: '#b91c1c',
          }}
        >
          <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          <div>
            No se pudo obtener el histórico de Postiz: {error}.{' '}
            {error === 'postiz_upstream_failed' && 'Comprueba en /settings que Postiz está conectado.'}
          </div>
        </div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, padding: '12px 0' }}>
          Sin notificaciones todavía. En cuanto publiques desde la app o desde el dashboard de Postiz, aparecerán aquí.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {items.map(n => {
            const kind = classify(n.content)
            const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? AlertCircle : Bell
            const fg = kind === 'success' ? 'var(--green-2)' : kind === 'error' ? '#b91c1c' : 'var(--ink-2)'
            const bg = kind === 'success' ? 'var(--green-soft)' : kind === 'error' ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)'
            const bd = kind === 'success' ? 'var(--green-border)' : kind === 'error' ? 'rgba(239,68,68,0.20)' : 'var(--border)'
            const when = new Date(n.createdAt).toLocaleString('es-ES', {
              dateStyle: 'medium', timeStyle: 'short',
            })
            return (
              <li
                key={n.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: bg, border: `1px solid ${bd}`,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Icon size={14} style={{ color: fg, marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>
                    {n.content}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '4px 0 0' }}>{when}</p>
                </div>
                {n.link && (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir en Postiz"
                    style={{ color: 'var(--ink-3)', flexShrink: 0 }}
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
