'use client'

import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, Sparkles, Upload, Check, MoreHorizontal, Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MockImg {
  id: string
  date: string
  prompt: string
  approved: boolean
  channel: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_IMGS: MockImg[] = [
  { id: '1', date: '2026-05-17', prompt: 'Field technician in white uniform inspecting water treatment facility', approved: true,  channel: 'linkedin'  },
  { id: '2', date: '2026-05-17', prompt: 'Operations manager reviewing digital dashboard in modern office',       approved: true,  channel: 'linkedin'  },
  { id: '3', date: '2026-05-15', prompt: 'Pest control professional using tablet in commercial kitchen',          approved: false, channel: 'instagram' },
  { id: '4', date: '2026-05-15', prompt: 'Environmental health team meeting with digital workflow visible',       approved: false, channel: 'instagram' },
  { id: '5', date: '2026-05-13', prompt: 'Legionella technician taking water sample in industrial setting',       approved: true,  channel: 'blog'      },
  { id: '6', date: '2026-05-13', prompt: 'Abstract minimalist corporate technology background teal gradient',    approved: false, channel: 'linkedin'  },
]

// ─── ImageMenu ───────────────────────────────────────────────────────────────

function ImageMenu({
  img,
  onToggleApprove,
  onDelete,
}: {
  img: MockImg
  onToggleApprove: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
  const [images, setImages] = useState<MockImg[]>(INITIAL_IMGS)
  const [generateModal, setGenerateModal] = useState<{ open: boolean }>({ open: false })
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalImages = images.length
  const approvedImages = images.filter(i => i.approved).length
  const pendingImages = images.filter(i => !i.approved).length

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleApprove = (id: string) => {
    let wasApproved = false
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        wasApproved = img.approved
        return { ...img, approved: !img.approved }
      }
      return img
    }))
    showToast(wasApproved ? 'Imagen desaprobada' : 'Imagen aprobada', 'success')
  }

  const handleDelete = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
    showToast('Imagen eliminada', 'info')
  }

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return
    setGenerateLoading(true)
    await new Promise(r => setTimeout(r, 2000))
    const today = '2026-05-19'
    const prompt = generatePrompt.trim()
    // Guess channel from prompt keywords
    let channel: string = 'linkedin'
    if (prompt.toLowerCase().includes('instagram') || prompt.toLowerCase().includes('carrusel')) channel = 'instagram'
    else if (prompt.toLowerCase().includes('blog')) channel = 'blog'
    else if (prompt.toLowerCase().includes('twitter') || prompt.toLowerCase().includes(' x ')) channel = 'x'
    else if (prompt.toLowerCase().includes('facebook')) channel = 'facebook'

    const newImg: MockImg = {
      id: String(Date.now()),
      date: today,
      prompt,
      approved: false,
      channel,
    }
    setImages(prev => [newImg, ...prev])
    setGenerateLoading(false)
    setGenerateModal({ open: false })
    setGeneratePrompt('')
    showToast('Imagen generada correctamente', 'success')
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
            onClick={() => { setGeneratePrompt(''); setGenerateModal({ open: true }) }}
            className="btn-cta"
          >
            <Sparkles size={13} aria-hidden="true" /> Generar imagen
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <div
              key={img.id}
              className="image-card group"
            >
              {/* Placeholder image */}
              <div
                className="aspect-square flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))' }}
              >
                <ImageIcon size={32} aria-hidden="true" style={{ color: 'var(--ink-3)', opacity: 0.4 }} />
              </div>
              {/* Overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 p-3 flex flex-col justify-end pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 60%)',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <p className="text-[11px] leading-snug line-clamp-2" style={{ color: '#ffffff' }}>
                  {img.prompt}
                </p>
              </div>
              {/* Badges */}
              <div className="absolute top-2 right-2 flex gap-1">
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
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>{img.date}</span>
                <ImageMenu img={img} onToggleApprove={handleToggleApprove} onDelete={handleDelete} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Modal */}
      <Modal
        open={generateModal.open}
        onClose={() => { if (!generateLoading) setGenerateModal({ open: false }) }}
        title="Generar imagen con IA"
        size="sm"
      >
        {generateLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
            <div className="text-center">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Generando con IA…
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                Esto puede tardar unos segundos
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <span className="section-label block mb-1.5">
                Descripción
              </span>
              <textarea
                autoFocus
                rows={3}
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                placeholder="Describe la imagen que necesitas…"
                className="input"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setGenerateModal({ open: false })}
                className="btn-secondary flex-1"
              >
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
