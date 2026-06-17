'use client'

import { useState } from 'react'
import { Download, BarChart3, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { usePostizChannels, type PostizChannel } from '@/hooks/use-postiz'

interface AnalyticsSeries {
  label: string
  data: Array<{ total: string; date: string }>
  percentageChange?: number
}

/**
 * Bloque administrativo para Postiz en /settings:
 *   - Importar histórico (one-shot)
 *   - Métricas por canal (analytics)
 */
export function PostizAdminPanel() {
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
      <ImportSection />
      <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />
      <AnalyticsSection />
    </div>
  )
}

// ─── Importar histórico ──────────────────────────────────────────────────────

function ImportSection() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; unsupported: number; error?: string } | null>(null)

  const run = async () => {
    if (busy) return
    if (!confirm('Esto importará todos los posts de Postiz que aún no estén en iGEO como content_items. ¿Continuar?')) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/postiz/import', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; imported?: number; skipped?: number; unsupported?: number; error?: string }
      setResult({
        imported:    data.imported ?? 0,
        skipped:     data.skipped ?? 0,
        unsupported: data.unsupported ?? 0,
        error:       res.ok ? undefined : (data.error ?? `HTTP ${res.status}`),
      })
    } catch (e) {
      setResult({ imported: 0, skipped: 0, unsupported: 0, error: e instanceof Error ? e.message : 'Error de red' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 12 }}>
        <Download size={16} style={{ color: 'var(--ink-2)' }} aria-hidden="true" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Importar histórico de Postiz
        </h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Crea content_items en iGEO para todos los posts ya existentes en Postiz que aún no estén
        vinculados. Útil al conectar una cuenta con histórico previo. Idempotente — los que ya están
        no se duplican.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center transition-colors"
        style={{
          gap: 6,
          height: 32,
          padding: '0 14px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy
          ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Importando…</>
          : <><Download size={12} aria-hidden="true" /> Ejecutar importación</>}
      </button>
      {result && (
        <div
          style={{
            marginTop: 10, padding: '8px 12px', fontSize: 12, borderRadius: 'var(--radius-md)',
            background: result.error ? 'rgba(239,68,68,0.08)' : 'var(--green-soft)',
            border: `1px solid ${result.error ? 'rgba(239,68,68,0.30)' : 'var(--green-border)'}`,
            color: result.error ? '#b91c1c' : 'var(--green-2)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}
        >
          {result.error
            ? <><AlertCircle size={13} aria-hidden="true" /> Error: {result.error}</>
            : <><CheckCircle2 size={13} aria-hidden="true" /> {result.imported} importados, {result.skipped} ya existían{result.unsupported > 0 ? `, ${result.unsupported} de redes no soportadas (omitidos)` : ''}.</>}
        </div>
      )}
    </div>
  )
}

// ─── Analytics por canal ─────────────────────────────────────────────────────

function AnalyticsSection() {
  const { channels, loading: chLoading, error: chError } = usePostizChannels()
  const [selectedId, setSelectedId] = useState<string>('')
  const [days, setDays] = useState(30)
  const [series, setSeries] = useState<AnalyticsSeries[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = async (id: string, range: number) => {
    if (!id) return
    setBusy(true)
    setError(null)
    setSeries(null)
    try {
      const res = await fetch(`/api/postiz/analytics/${encodeURIComponent(id)}?days=${range}`)
      const data = await res.json() as { series?: AnalyticsSeries[]; error?: string }
      if (!res.ok || data.error) {
        setError(data.error === 'channel_not_found'
          ? 'Esa red ya no está conectada en Postiz.'
          : data.error ?? `HTTP ${res.status}`)
      } else {
        setSeries(data.series ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setBusy(false)
    }
  }

  const onChange = (id: string) => {
    setSelectedId(id)
    if (id) void fetchAnalytics(id, days)
  }
  const onDaysChange = (d: number) => {
    setDays(d)
    if (selectedId) void fetchAnalytics(selectedId, d)
  }

  const enabledChannels = (channels as PostizChannel[]).filter(c => !c.disabled)

  return (
    <div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 12 }}>
        <BarChart3 size={16} style={{ color: 'var(--ink-2)' }} aria-hidden="true" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Métricas por canal
        </h3>
      </div>

      {chLoading ? (
        <Inline><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Cargando canales…</Inline>
      ) : chError ? (
        <ErrorBox>No se pudieron cargar los canales: {chError}</ErrorBox>
      ) : enabledChannels.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>
          Conecta una red en Postiz para ver métricas.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 12 }}>
            <select
              value={selectedId}
              onChange={e => onChange(e.target.value)}
              aria-label="Canal"
              style={{
                height: 32, padding: '0 10px', fontSize: 12,
                color: 'var(--ink)', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="">— elige canal —</option>
              {enabledChannels.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.identifier})</option>
              ))}
            </select>
            <select
              value={days}
              onChange={e => onDaysChange(Number(e.target.value))}
              aria-label="Rango de días"
              style={{
                height: 32, padding: '0 10px', fontSize: 12,
                color: 'var(--ink)', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              }}
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>

          {busy && <Inline><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Cargando métricas…</Inline>}
          {error && <ErrorBox>{error}</ErrorBox>}
          {series && series.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Postiz no devolvió métricas para este canal en el rango seleccionado.
            </p>
          )}
          {series && series.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {series.map(s => {
                const last = s.data[s.data.length - 1]
                const first = s.data[0]
                const pct = typeof s.percentageChange === 'number' ? s.percentageChange : null
                const pctColor = pct == null ? 'var(--ink-3)' : pct > 0 ? 'var(--green-2)' : pct < 0 ? '#b91c1c' : 'var(--ink-3)'
                return (
                  <div
                    key={s.label}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</span>
                      {pct != null && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: pctColor }}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {last && (
                      <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '4px 0 0' }}>
                        Último: {last.total} · {last.date}
                        {first && first !== last ? ` · primero ${first.total} (${first.date})` : ''}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Inline({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontSize: 13 }}>{children}</div>
}
function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '8px 12px', fontSize: 12,
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.30)',
        color: '#b91c1c',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <AlertCircle size={13} aria-hidden="true" style={{ marginTop: 1, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  )
}
