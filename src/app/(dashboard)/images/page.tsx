'use client'

import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, Sparkles, Upload, Check, MoreHorizontal, Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageAsset {
  id: string
  url: string
  storage_path: string
  prompt: string | null
  approved: boolean
  created_at: string
  aspect_ratio: string | null
  width: number | null
  height: number | null
  channel: string | null
  created_by: string | null
}

const RATIOS = [
  { value: '1:1',  label: '1:1',  sub: 'Instagram · LinkedIn' },
  { value: '16:9', label: '16:9', sub: 'Blog · Banner'        },
  { value: '9:16', label: '9:16', sub: 'Stories · Reels'      },
  { value: '4:5',  label: '4:5',  sub: 'Feed Instagram'       },
] as const
type AspectRatio = typeof RATIOS[number]['value']

// ─── ImageMenu ───────────────────────────────────────────────────────────────

function ImageMenu({
  img,
  onToggleApprove,
  onDelete,
  busy,
}: {
  img: ImageAsset
  onToggleApprove: (id: string) => void
  onDelete: (id: string) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label="Opciones de imagen"
        className="image-menu-trigger"
        disabled={busy}
      >
        <MoreHorizontal size={12} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute right-0 bottom-full mb-1 z-50 overflow-hidden py-1"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}
        >
          <button
            onClick={() => { onToggleApprove(img.id); setOpen(false) }}
            className="image-menu-item"
          >
            <Check size={13} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
            {img.approved ? 'Desaprobar' : 'Aprobar'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          <button
            onClick={() => { onDelete(img.id); setOpen(false) }}
            className="image-menu-item image-menu-item-destructive"
          >
            <Trash2 size={13} aria-hidden="true" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  const [images, setImages] = useState<ImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Load images on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/images')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as ImageAsset[]
        if (!cancelled) setImages(data)
      } catch (e) {
        if (!cancelled) showToast(`Error cargando imágenes: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalImages = images.length
  const approvedImages = images.filter(i => i.approved).length
  const pendingImages = images.filter(i => !i.approved).length

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleApprove = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/images/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setBusyId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    const data = await res.json() as { approved: boolean }
    setImages(prev => prev.map(i => i.id === id ? { ...i, approved: data.approved } : i))
    showToast(data.approved ? 'Imagen aprobada' : 'Imagen desaprobada', 'success')
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/images/${id}`, { method: 'DELETE' })
    setBusyId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    setImages(prev => prev.filter(i => i.id !== id))
    showToast('Imagen eliminada', 'info')
  }

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return
    setGenerateLoading(true)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: generatePrompt.trim(), aspectRatio }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error generando: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const newAsset = await res.json() as ImageAsset
      setImages(prev => [newAsset, ...prev])
      setGenerateModalOpen(false)
      setGeneratePrompt('')
      showToast('Imagen generada correctamente', 'success')
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setGenerateLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--ink)',
              lineHeight: 1,
              margin: 0,
            }}>
              Imágenes
            </h1>
            <p style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--ink-3)',
              margin: '3px 0 0',
              letterSpacing: '0.01em',
            }}>
              Agente Marketing · iGEO
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="badge badge-muted tabular-nums">
              <span style={{ color: 'var(--ink)' }}>{totalImages}</span>
              <span style={{ color: 'var(--ink-2)' }}>activos</span>
            </span>
            <span className="badge badge-green tabular-nums">
              <span>{approvedImages}</span>
              <span style={{ opacity: 0.85 }}>aprobadas</span>
            </span>
            <span className="badge badge-amber tabular-nums">
              <span>{pendingImages}</span>
              <span style={{ opacity: 0.85 }}>pendientes</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => showToast('Próximamente: sube tus propios activos visuales', 'info')}
            className="btn-pill-secondary"
          >
            <Upload size={13} aria-hidden="true" /> Subir imagen
          </button>
          <button
            onClick={() => { setGeneratePrompt(''); setAspectRatio('1:1'); setGenerateModalOpen(true) }}
            className="btn-cta"
          >
            <Sparkles size={13} aria-hidden="true" /> Generar imagen
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ink-3)' }}>
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p className="text-[12px]">Cargando imágenes…</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center" style={{ color: 'var(--ink-3)' }}>
            <ImageIcon size={32} aria-hidden="true" style={{ opacity: 0.5 }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
              No hay imágenes todavía
            </p>
            <p className="text-[12px]">Pulsa “Generar imagen” para crear la primera con IA.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map(img => (
              <div key={img.id} className="image-card group">
                {/* Imagen real */}
                <div className="aspect-square overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.prompt ?? 'Imagen'}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                {/* Overlay con prompt */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 p-3 flex flex-col justify-end pointer-events-none"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 60%)',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <p className="text-[11px] leading-snug line-clamp-3" style={{ color: '#ffffff' }}>
                    {img.prompt}
                  </p>
                </div>
                {/* Badges */}
                <div className="absolute top-2 right-2 flex gap-1">
                  {img.aspect_ratio && (
                    <span
                      className="px-1.5 rounded-sm tabular-nums"
                      style={{
                        height: 18, fontSize: 10, fontWeight: 700,
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      {img.aspect_ratio}
                    </span>
                  )}
                  {img.approved && (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--green)' }}
                      aria-label="Aprobada"
                    >
                      <Check size={10} aria-hidden="true" style={{ color: '#ffffff' }} strokeWidth={3} />
                    </span>
                  )}
                </div>
                {/* Footer */}
                <div
                  className="flex items-center justify-between"
                  style={{
                    padding: '12px',
                    background: 'var(--surface)',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
                    {img.created_at.slice(0, 10)}
                  </span>
                  <ImageMenu img={img} onToggleApprove={handleToggleApprove} onDelete={handleDelete} busy={busyId === img.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Modal */}
      <Modal
        open={generateModalOpen}
        onClose={() => { if (!generateLoading) setGenerateModalOpen(false) }}
        title="Generar imagen con IA"
        size="sm"
      >
        {generateLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
            <div className="text-center">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Generando con Imagen 4…
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                Esto puede tardar 10–30 segundos
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Aspect ratio selector */}
            <div>
              <span className="section-label block mb-1.5">Formato</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {RATIOS.map(r => {
                  const active = aspectRatio === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setAspectRatio(r.value)}
                      aria-pressed={active}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--ink)' }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{r.sub}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <span className="section-label block mb-1.5">Descripción</span>
              <textarea
                autoFocus
                rows={4}
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                placeholder="Describe la imagen que necesitas — sé específico con escena, estilo, iluminación…"
                className="input"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setGenerateModalOpen(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={!generatePrompt.trim()}
                className="btn-cta flex-1"
              >
                <Sparkles size={13} aria-hidden="true" />
                Generar imagen
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
