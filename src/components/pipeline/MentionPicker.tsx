'use client'

/**
 * Picker para insertar @menciones en el textarea de contenido del item del pipeline.
 *
 * Carga las menciones que tienen handle para el `channel` del item y, al hacer
 * click en una, llama a `onInsert(text)` con el handle ya formateado para pegar.
 */

import { useEffect, useRef, useState } from 'react'
import { AtSign, Loader2, Search } from 'lucide-react'
import { formatHandleForInsert } from '@/lib/social-mentions'
import type { Channel, SocialMention } from '@/types/database'

interface Props {
  channel: Channel
  onInsert: (text: string) => void
}

export function MentionPicker({ channel, onInsert }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SocialMention[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Cargar al abrir (re-fetch si cambia channel)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/mentions?channel=${encodeURIComponent(channel)}&activeOnly=true`)
      .then(r => r.ok ? r.json() : [])
      .then((data: SocialMention[]) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, channel])

  const filtered = search.trim()
    ? items.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.handles[channel] ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items

  const handleInsert = (m: SocialMention) => {
    const raw = m.handles[channel]
    if (!raw) return
    onInsert(formatHandleForInsert(channel, raw))
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn-pill-secondary"
        onClick={() => setOpen(v => !v)}
        title="Insertar mención"
        aria-expanded={open}
      >
        <AtSign size={12} aria-hidden="true" /> Mencionar
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            width: 320,
            maxHeight: 360,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            overflow: 'hidden',
          }}
        >
          {/* Buscador */}
          <div
            className="relative"
            style={{ padding: 8, borderBottom: '1px solid var(--border)' }}
          >
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
                  ? `Sin menciones configuradas para ${channel}.`
                  : 'Sin resultados.'}
                <p style={{ fontSize: 11, marginTop: 4, color: 'var(--ink-3)', opacity: 0.7 }}>
                  Añade menciones desde Admin → Menciones
                </p>
              </div>
            ) : (
              filtered.map(m => {
                const handle = m.handles[channel] ?? ''
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleInsert(m)}
                    className="w-full text-left transition-colors hover:bg-[var(--accent-soft)]"
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
                        color: 'var(--ink-2)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatHandleForInsert(channel, handle)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
