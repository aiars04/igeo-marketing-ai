'use client'

/**
 * Modal "Generar batch por mercado" — pipeline.
 *
 * Permite con un único prompt crear N esqueletos en stage 'ideas' adaptados
 * a una matriz de mercados × canales. Cada mercado puede tener su propia
 * lista de canales (p.ej. México → instagram+facebook, Francia → +linkedin).
 *
 * El componente es presentacional: la persistencia/POST la hace el padre
 * vía la prop `onSubmit`. El padre cierra el modal en éxito.
 */

import { useState, useMemo, useCallback } from 'react'
import { Sparkles, Loader2, Plus, X, Layers } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { Channel, Market } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  loading: boolean
  onSubmit: (payload: {
    prompt: string
    campaign?: string
    matrix: Array<{ market: Market; channels: Channel[] }>
  }) => Promise<{ ok: boolean; created: number; error?: string }>
  channels: Channel[]
  channelLabels: Record<Channel, string>
  markets: Market[]
  marketLabels: Record<Market, string>
}

const MAX_BATCH = 50

export function BatchGenerateModal({
  open, onClose, loading, onSubmit,
  channels, channelLabels, markets, marketLabels,
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [campaign, setCampaign] = useState('')
  // Estado de la matriz: market → set de channels seleccionados.
  // Mantenerlo como Record para acceso O(1) por market.
  const [matrix, setMatrix] = useState<Record<Market, Channel[]>>({} as Record<Market, Channel[]>)

  const selectedMarkets = useMemo(
    () => markets.filter(m => matrix[m] && matrix[m].length > 0),
    [markets, matrix],
  )

  // Para mostrar mercados "preparados pero sin canales": los que aparecen
  // como key en matrix aunque el array esté vacío. Sirve para el UI de
  // "añadir mercado" cuando aún no se ha tickado ningún canal.
  const stagedMarkets = useMemo(
    () => markets.filter(m => matrix[m] !== undefined),
    [markets, matrix],
  )

  const totalCombos = useMemo(
    () => selectedMarkets.reduce((acc, m) => acc + (matrix[m]?.length ?? 0), 0),
    [selectedMarkets, matrix],
  )

  const canSubmit = prompt.trim().length >= 3 && totalCombos > 0 && totalCombos <= MAX_BATCH

  const addMarket = useCallback((m: Market) => {
    setMatrix(prev => prev[m] !== undefined ? prev : { ...prev, [m]: [] })
  }, [])

  const removeMarket = useCallback((m: Market) => {
    setMatrix(prev => {
      const next = { ...prev }
      delete next[m]
      return next
    })
  }, [])

  const toggleChannel = useCallback((m: Market, ch: Channel) => {
    setMatrix(prev => {
      const current = prev[m] ?? []
      const next = current.includes(ch)
        ? current.filter(c => c !== ch)
        : [...current, ch]
      return { ...prev, [m]: next }
    })
  }, [])

  const reset = useCallback(() => {
    setPrompt('')
    setCampaign('')
    setMatrix({} as Record<Market, Channel[]>)
  }, [])

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload = {
      prompt: prompt.trim(),
      campaign: campaign.trim() || undefined,
      matrix: selectedMarkets.map(m => ({ market: m, channels: matrix[m] })),
    }
    const res = await onSubmit(payload)
    if (res.ok) reset()
  }

  const handleClose = () => {
    if (loading) return
    onClose()
    // No reseteamos al cerrar — el usuario puede querer volver a abrir y
    // recuperar lo que escribió. Solo reseteamos tras un submit exitoso.
  }

  // Mercados no añadidos aún (candidatos en el menú "Añadir mercado")
  const availableMarkets = markets.filter(m => matrix[m] === undefined)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Generar ideas — batch por mercado y canal"
      size="lg"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-2)' }} aria-hidden="true" />
          <div className="text-center">
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              Creando ideas en el pipeline…
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
              {totalCombos} esqueleto{totalCombos === 1 ? '' : 's'} en preparación
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 18 }}>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
            Describe la idea una sola vez. Crearemos un esqueleto por cada combinación de mercado × canal seleccionada; podrás generar el contenido con IA por item desde la columna <strong>Ideas</strong>.
          </p>

          {/* Prompt */}
          <div>
            <label
              className="uppercase"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--ink-3)', display: 'block', marginBottom: 6,
              }}
            >
              Prompt / idea base
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ej. Caso real: digitalizar la sanidad ambiental con iGEO — destacar reducción de papel y trazabilidad para auditorías."
              className="input"
              style={{
                height: 'auto', padding: 12, fontSize: 13, lineHeight: 1.5,
                resize: 'vertical', minHeight: 80, whiteSpace: 'pre-wrap',
              }}
            />
            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, textAlign: 'right' }}>
              {prompt.length} / 2000
            </div>
          </div>

          {/* Campaña (opcional) */}
          <div>
            <label
              className="uppercase"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--ink-3)', display: 'block', marginBottom: 6,
              }}
            >
              Campaña (opcional)
            </label>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              maxLength={120}
              placeholder="Q3 lanzamiento PDI"
              className="input"
              style={{ height: 36, fontSize: 13 }}
            />
          </div>

          {/* Matriz mercado × canal */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <label
                className="uppercase"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}
              >
                Mercados y canales
              </label>
              <span
                className="inline-flex items-center"
                style={{
                  height: 22, padding: '0 10px', gap: 5,
                  borderRadius: 'var(--radius-pill)',
                  background: totalCombos > 0 ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: totalCombos > 0 ? 'var(--accent-2)' : 'var(--ink-3)',
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <Layers size={11} aria-hidden="true" />
                {totalCombos} ide{totalCombos === 1 ? 'a' : 'as'}
              </span>
            </div>

            <div className="flex flex-col" style={{ gap: 8 }}>
              {stagedMarkets.length === 0 && (
                <div
                  style={{
                    padding: '16px 12px',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12, color: 'var(--ink-3)', textAlign: 'center',
                  }}
                >
                  Añade un mercado para empezar.
                </div>
              )}

              {stagedMarkets.map(m => (
                <div
                  key={m}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-2)',
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {marketLabels[m]}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMarket(m)}
                      aria-label={`Quitar ${marketLabels[m]}`}
                      style={{
                        background: 'transparent', border: 'none', padding: 4,
                        color: 'var(--ink-3)', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red-2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)' }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {channels.map(ch => {
                      const active = (matrix[m] ?? []).includes(ch)
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(m, ch)}
                          style={{
                            height: 26, padding: '0 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 11, fontWeight: 600, lineHeight: 1,
                            cursor: 'pointer',
                            background: active ? 'var(--accent)' : 'var(--surface)',
                            color: active ? '#fff' : 'var(--ink-2)',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            transition: 'all .12s',
                          }}
                        >
                          {channelLabels[ch]}
                        </button>
                      )
                    })}
                  </div>

                  {(matrix[m] ?? []).length === 0 && (
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                      Selecciona al menos un canal para este mercado.
                    </p>
                  )}
                </div>
              ))}

              {availableMarkets.length > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, fontWeight: 600 }}>
                    Añadir mercado
                  </p>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {availableMarkets.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => addMarket(m)}
                        style={{
                          height: 26, padding: '0 10px',
                          gap: 5,
                          display: 'inline-flex', alignItems: 'center',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 11, fontWeight: 600, lineHeight: 1,
                          cursor: 'pointer',
                          background: 'var(--surface)',
                          color: 'var(--ink-2)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <Plus size={11} aria-hidden="true" />
                        {marketLabels[m]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {totalCombos > MAX_BATCH && (
              <p style={{ fontSize: 11, color: 'var(--red-2)', marginTop: 8 }}>
                Has superado el máximo de {MAX_BATCH} ideas por batch. Reduce mercados o canales.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-cta"
              disabled={!canSubmit}
              onClick={handleSubmit}
              title={!canSubmit
                ? (prompt.trim().length < 3
                    ? 'Escribe un prompt de al menos 3 caracteres'
                    : 'Selecciona al menos un canal por mercado')
                : `Crear ${totalCombos} idea${totalCombos === 1 ? '' : 's'}`}
            >
              <Sparkles size={13} aria-hidden="true" />
              Crear {totalCombos > 0 ? totalCombos : ''} idea{totalCombos === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
