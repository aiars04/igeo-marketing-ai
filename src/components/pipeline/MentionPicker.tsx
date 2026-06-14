'use client'

/**
 * Picker para insertar @menciones en el textarea de contenido del item del pipeline.
 *
 * Muestra TODAS las menciones activas del repositorio (no solo las que tienen
 * handle del canal actual). Al hacer click:
 *   - si la mención tiene handle para el canal del item → inserta ese handle formateado.
 *   - si no lo tiene → inserta el nombre como mención en texto plano y avisa visualmente.
 * Así se puede mencionar perfiles en CUALQUIER red social.
 *
 * El desplegable se renderiza con createPortal en document.body y posición fija,
 * para que NO lo recorte el overflow del Modal (que es overflow-hidden + body
 * overflow-y-auto). Mismo patrón que CardMenu en PipelineBoard.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AtSign, Loader2, Search } from 'lucide-react'
import { formatHandleForInsert } from '@/lib/social-mentions'
import type { Channel, SocialMention } from '@/types/database'

interface Props {
  channel: Channel
  onInsert: (text: string) => void
}

const DROPDOWN_W = 320
const DROPDOWN_MAXH = 360

const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  x: 'X', blog: 'Blog', email: 'Email', newsletter: 'Newsletter',
}

/** Texto que se insertará para una mención en el canal dado: handle del canal o el nombre. */
function mentionInsertText(m: SocialMention, channel: Channel): string {
  const raw = m.handles[channel]
  if (raw && raw.trim()) return formatHandleForInsert(channel, raw.trim())
  return m.name.trim()
}

export function MentionPicker({ channel, onInsert }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  const [items, setItems] = useState<SocialMention[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  // Cargar TODAS las menciones activas al abrir (sin filtrar por canal — se
  // pueden mencionar perfiles en cualquier red, usando el nombre como fallback).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/mentions?activeOnly=true`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then((data: SocialMention[]) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      })
      .catch((e: unknown) => {
        if (!cancelled && !(e instanceof Error && e.name === 'AbortError')) setItems([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [open])

  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      // El desplegable se ancla por su borde inferior justo encima del botón
      // (abre hacia arriba). left clamp para no salir del viewport.
      const left = Math.min(r.left, window.innerWidth - DROPDOWN_W - 8)
      setPos({ left: Math.max(8, left), bottom: window.innerHeight - r.top + 6 })
    }
    setSearch('')
    setOpen(true)
  }

  // Sin filtro por canal: se muestran todas las menciones activas. La búsqueda
  // matchea por nombre o por cualquier handle guardado.
  const filtered = search.trim()
    ? items.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        Object.values(m.handles).some(h => (h ?? '').toLowerCase().includes(search.toLowerCase()))
      )
    : items

  const handleInsert = (m: SocialMention) => {
    const text = mentionInsertText(m, channel)
    if (!text) return
    onInsert(text)
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn-pill-secondary"
        onClick={toggle}
        title="Insertar mención"
        aria-expanded={open}
      >
        <AtSign size={12} aria-hidden="true" /> Mencionar
      </button>

      {mounted && open && pos && createPortal(
        <>
          {/* Overlay para cerrar al click fuera (no recortado por el modal) */}
          <div
            className="fixed inset-0 z-[150]"
            onMouseDown={(e) => { e.stopPropagation(); setOpen(false) }}
          />
          <div
            className="animate-scale-in"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: pos.left,
              bottom: pos.bottom,
              zIndex: 151,
              width: DROPDOWN_W,
              maxHeight: DROPDOWN_MAXH,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              overflow: 'hidden',
            }}
          >
            {/* Buscador */}
            <div className="relative" style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
              <Search
                size={12}
                aria-hidden="true"
                style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}
              />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar mención…"
                className="input"
                style={{ height: 30, padding: '0 10px 0 28px', fontSize: 12 }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
                  if (e.key === 'Enter' && filtered.length === 1) {
                    e.preventDefault()
                    handleInsert(filtered[0])
                  }
                }}
              />
            </div>

            {/* Lista */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div className="flex items-center justify-center" style={{ padding: 20 }}>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
                  {items.length === 0
                    ? 'Aún no hay menciones en el repositorio.'
                    : 'Sin resultados.'}
                  <p style={{ fontSize: 11, marginTop: 4, color: 'var(--ink-3)', opacity: 0.7 }}>
                    Añade menciones desde Admin → Menciones
                  </p>
                </div>
              ) : (
                filtered.map(m => {
                  const raw = (m.handles[channel] ?? '').trim()
                  const hasChannelHandle = raw.length > 0
                  // Lo que realmente se insertará en este canal.
                  const insertText = mentionInsertText(m, channel)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleInsert(m)}
                      className="w-full text-left transition-colors hover:bg-[var(--accent-soft)]"
                      title={hasChannelHandle ? insertText : `Sin handle de ${CHANNEL_LABELS[channel]} — se insertará el nombre`}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-soft)',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                        {m.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: hasChannelHandle ? 'var(--ink-2)' : 'var(--ink-3)',
                          fontStyle: hasChannelHandle ? 'normal' : 'italic',
                          fontFamily: hasChannelHandle ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {hasChannelHandle
                          ? insertText
                          : `Sin handle de ${CHANNEL_LABELS[channel]} · se insertará "${m.name}"`}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
