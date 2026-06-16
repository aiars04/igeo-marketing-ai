'use client'

/**
 * Personalización del color de cada canal. Tab del Admin.
 * Cambios en directo: la elección se persiste en localStorage y se propaga a
 * todos los ChannelBadge de la app vía useChannelColors().
 */

import { Palette, RotateCcw, Check } from 'lucide-react'
import {
  useChannelColors,
  CHANNEL_PALETTE,
  CHANNEL_LABEL,
  DEFAULT_CHANNEL_SLUG,
  getResolvedSlug,
  paletteEntry,
} from '@/lib/channel-colors'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import type { Channel } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

interface Props {
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function ChannelColorsTab({ toast }: Props) {
  const { overrides, setChannelColor, resetChannelColor, resetAll } = useChannelColors()
  const customCount = Object.keys(overrides).length

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col" style={{ gap: 20, maxWidth: 1080 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div style={{ maxWidth: 640 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <Palette size={18} aria-hidden="true" style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              Colores por canal
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: 0, lineHeight: 1.55 }}>
            Asigna el color que prefieras a cada red social para reconocerlos de un vistazo
            en el pipeline, calendario y resto de la app. Los cambios se guardan en este
            navegador y se aplican al instante.
          </p>
        </div>
        {customCount > 0 && (
          <button
            type="button"
            className="btn-pill-secondary"
            onClick={() => {
              resetAll()
              toast('Colores restaurados al valor por defecto', 'success')
            }}
            style={{ height: 32, fontSize: 12 }}
            title="Restaurar todos los canales al color por defecto"
          >
            <RotateCcw size={12} aria-hidden="true" />
            Restaurar todo ({customCount})
          </button>
        )}
      </div>

      {/* Grid de canales */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        {CHANNELS.map(ch => {
          const currentSlug = getResolvedSlug(ch, overrides)
          const isCustom = overrides[ch] !== undefined && overrides[ch] !== DEFAULT_CHANNEL_SLUG[ch]

          return (
            <div
              key={ch}
              style={{
                padding: 16,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Fila superior: badge preview + nombre + restaurar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <ChannelBadge channel={ch} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }}>
                      {CHANNEL_LABEL[ch]}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.3 }}>
                      {isCustom
                        ? `Personalizado · ${paletteEntry(currentSlug).label}`
                        : `Por defecto · ${paletteEntry(currentSlug).label}`}
                    </p>
                  </div>
                </div>
                {isCustom && (
                  <button
                    type="button"
                    className="btn-pill-secondary"
                    onClick={() => {
                      resetChannelColor(ch)
                      toast(`${CHANNEL_LABEL[ch]} restaurado`, 'success')
                    }}
                    style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    title={`Restaurar ${CHANNEL_LABEL[ch]} al color por defecto`}
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    Restaurar
                  </button>
                )}
              </div>

              {/* Swatches de la paleta */}
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {CHANNEL_PALETTE.map(p => {
                  const selected = p.slug === currentSlug
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setChannelColor(ch, p.slug)}
                      title={p.label}
                      aria-label={`Asignar ${p.label} a ${CHANNEL_LABEL[ch]}`}
                      aria-pressed={selected}
                      style={{
                        position: 'relative',
                        height: 32,
                        minWidth: 32,
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 'var(--radius-pill)',
                        background: p.bg,
                        border: `2px solid ${selected ? p.text : 'transparent'}`,
                        color: p.text,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        lineHeight: 1,
                        transition: 'transform 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: p.text,
                          flexShrink: 0,
                        }}
                      />
                      <span>{p.label}</span>
                      {selected && (
                        <Check size={12} aria-hidden="true" style={{ marginLeft: 2 }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0, fontStyle: 'italic' }}>
        Las preferencias se guardan en este navegador. Si entras desde otro dispositivo
        verás los colores por defecto hasta que vuelvas a personalizarlos allí.
      </p>
    </div>
  )
}
