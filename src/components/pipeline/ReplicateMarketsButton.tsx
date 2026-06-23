'use client'

import { useState, useMemo } from 'react'
import { Languages, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ALL_MARKETS, MARKET_CONFIG } from '@/lib/utils'
import type { ContentItem, Market } from '@/types/database'

interface Props {
  item: ContentItem
  onReplicated?: (newItems: ContentItem[]) => void
}

interface MarketResult {
  market: Market
  ok:     boolean
  item?:  ContentItem
  error?: string
}

const ERROR_MESSAGES: Record<string, string> = {
  source_has_no_content:         'El item original todavía no tiene copy generado.',
  target_markets_required:       'Selecciona al menos un mercado destino.',
  no_valid_markets:              'Ninguno de los mercados seleccionados es válido.',
  all_targets_match_source_market:'No puedes replicar al mismo mercado del item.',
  empty_llm_response:            'El modelo devolvió respuesta vacía.',
  models_unavailable:            'Modelos saturados, reintenta en unos minutos.',
  replicate_failed:              'Error al replicar.',
  forbidden:                     'Solo admin/manager pueden replicar contenido.',
  unauthorized:                  'Tu sesión ha expirado. Refresca la página.',
  rate_limited:                  'Demasiadas replicaciones seguidas. Espera un minuto y reintenta.',
}
function humanize(code: string | undefined): string {
  if (!code) return 'Error desconocido.'
  return ERROR_MESSAGES[code] ?? `Error: ${code}`
}

/**
 * Botón "Replicar en otros mercados" + modal con checkboxes.
 * Solo se renderiza si el item tiene content (no tiene sentido replicar
 * un item vacío — el endpoint también lo valida).
 */
export function ReplicateMarketsButton({ item, onReplicated }: Props) {
  const [open, setOpen] = useState(false)
  if (!item.content?.trim()) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-pill-secondary"
        title="Replicar este contenido en otros mercados, adaptado a su idioma y reglas"
      >
        <Languages size={12} aria-hidden="true" /> Replicar en otros mercados
      </button>
      <ReplicateModal
        open={open}
        item={item}
        onClose={() => setOpen(false)}
        onReplicated={onReplicated}
      />
    </>
  )
}

interface ModalProps {
  open:         boolean
  item:         ContentItem
  onClose:      () => void
  onReplicated?: (newItems: ContentItem[]) => void
}

function ReplicateModal({ open, item, onClose, onReplicated }: ModalProps) {
  // Lista de mercados disponibles (excluye el del item actual).
  const availableMarkets = useMemo(
    () => ALL_MARKETS.filter(m => m !== item.market),
    [item.market],
  )

  const [selected, setSelected]   = useState<Set<Market>>(new Set())
  const [running, setRunning]     = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [results, setResults]     = useState<MarketResult[] | null>(null)

  const toggle = (m: Market) => {
    if (running) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m); else next.add(m)
      return next
    })
  }

  const reset = () => {
    setSelected(new Set())
    setRunning(false)
    setGlobalError(null)
    setResults(null)
  }

  const close = () => {
    if (running) return  // no cerrar mientras corre — evita perder la operación en backend
    reset()
    onClose()
  }

  const canSubmit = !running && selected.size > 0

  const submit = async () => {
    if (!canSubmit) return
    setRunning(true)
    setGlobalError(null)
    setResults(null)
    try {
      const res = await fetch(`/api/content-items/${item.id}/replicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_markets: Array.from(selected) }),
      })
      const data = await res.json() as {
        ok?: boolean
        results?: MarketResult[]
        error?: string
      }
      if (!res.ok || data.error) {
        setGlobalError(humanize(data.error))
        return
      }
      const ress = data.results ?? []
      setResults(ress)
      const newItems = ress.filter(r => r.ok && r.item).map(r => r.item as ContentItem)
      if (newItems.length > 0) onReplicated?.(newItems)
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title="Replicar en otros mercados" size="md">
      {/* Vista previa minimal del copy original */}
      <Section title={`Item original — mercado ${MARKET_CONFIG[item.market]?.label ?? item.market}`}>
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            color: 'var(--ink-2)',
            whiteSpace: 'pre-wrap',
            maxHeight: 100,
            overflowY: 'auto',
            lineHeight: 1.4,
          }}
        >
          {item.content?.trim().slice(0, 400)}
          {(item.content?.length ?? 0) > 400 && <span style={{ color: 'var(--ink-3)' }}>… (continúa)</span>}
        </div>
      </Section>

      {!results && (
        <Section title="Mercados destino">
          <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '0 0 10px', lineHeight: 1.4 }}>
            Crearemos un item nuevo por cada mercado en su columna <strong>Ideas</strong>, con el copy
            adaptado al idioma y a las reglas de marca/mercado configuradas en admin.
            No se traduce literalmente — se reescribe respetando tono y terminología local.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {availableMarkets.map(m => {
              const checked = selected.has(m)
              return (
                <label
                  key={m}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: running ? 'wait' : 'pointer',
                    background: checked ? 'var(--accent-soft)' : 'var(--surface)',
                    opacity: running ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(m)}
                    disabled={running}
                    style={{ margin: 0 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {MARKET_CONFIG[m]?.flag} {MARKET_CONFIG[m]?.label ?? m}
                  </span>
                </label>
              )
            })}
          </div>
        </Section>
      )}

      {/* Estado de progreso / resultados */}
      {running && (
        <Banner kind="info">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
          Replicando en {selected.size} mercado{selected.size === 1 ? '' : 's'}…
          Esto puede tardar hasta {Math.ceil(selected.size * 10)} segundos.
        </Banner>
      )}

      {globalError && (
        <Banner kind="error">{globalError}</Banner>
      )}

      {results && (
        <Section title="Resultados">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map(r => {
              const Icon = r.ok ? CheckCircle2 : X
              const fg = r.ok ? 'var(--green-2)' : '#b91c1c'
              const bg = r.ok ? 'var(--green-soft)' : 'rgba(239,68,68,0.08)'
              const bd = r.ok ? 'var(--green-border)' : 'rgba(239,68,68,0.30)'
              return (
                <li
                  key={r.market}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    background: bg, border: `1px solid ${bd}`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Icon size={14} style={{ color: fg, flexShrink: 0 }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {MARKET_CONFIG[r.market]?.label ?? r.market}
                    </div>
                    {!r.ok && (
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                        {humanize(r.error)}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '10px 0 0', lineHeight: 1.4 }}>
            Las copias se han añadido a la columna <strong>Ideas</strong> del pipeline. Ábrelas para
            revisar, ajustar y aprobar.
          </p>
        </Section>
      )}

      {/* Footer */}
      <div
        className="flex items-center"
        style={{ gap: 10, paddingTop: 16, marginTop: 8, borderTop: '1px solid var(--border)' }}
      >
        <div style={{ flex: 1 }} />
        {results ? (
          <button
            onClick={close}
            className="btn-cta"
          >
            Cerrar
          </button>
        ) : (
          <>
            <button
              onClick={close}
              disabled={running}
              style={{
                height: 36, padding: '0 14px', fontSize: 13, fontWeight: 500,
                color: 'var(--ink)', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)',
                cursor: running ? 'not-allowed' : 'pointer',
                opacity: running ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="btn-cta"
              style={!canSubmit ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            >
              {running
                ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Replicando…</>
                : <><Languages size={13} aria-hidden="true" /> Replicar en {selected.size || ''} mercado{selected.size === 1 ? '' : 's'}</>}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── helpers UI ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{
        fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Banner({ kind, children }: { kind: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const palette = {
    info:    { bg: 'var(--amber-soft)', fg: 'var(--amber-2)', bd: 'var(--amber-border)' },
    error:   { bg: 'rgba(239,68,68,0.10)', fg: '#b91c1c', bd: 'rgba(239,68,68,0.30)' },
    success: { bg: 'var(--green-soft)', fg: 'var(--green-2)', bd: 'var(--green-border)' },
  }[kind]
  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 12px', marginBottom: 14,
        background: palette.bg, border: `1px solid ${palette.bd}`,
        borderRadius: 'var(--radius-md)',
        fontSize: 12.5, color: palette.fg, lineHeight: 1.4,
      }}
    >
      <Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}
