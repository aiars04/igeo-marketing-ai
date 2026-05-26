'use client'

import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, Sparkles, Plus, Check, MoreHorizontal, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { Channel } from '@/types/database'

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
        className="p-1 rounded hover:bg-[var(--surface3)] transition-colors opacity-0 group-hover:opacity-100"
      >
        <MoreHorizontal size={12} className="text-[var(--muted)]" />
      </button>

      {open && (
        <div
          className="absolute right-0 bottom-full mb-1 z-50 rounded-xl shadow-2xl overflow-hidden py-1"
          style={{
            background: 'var(--surface3)',
            border: '1px solid var(--border2)',
            minWidth: 160,
          }}
        >
          <button
            onClick={() => { onToggleApprove(img.id); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-left transition-colors hover:bg-[var(--surface2)]"
            style={{ color: 'var(--text)' }}
          >
            <Check size={12} className="text-emerald-400" />
            {img.approved ? 'Desaprobar' : 'Aprobar'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          <button
            onClick={() => { onDelete(img.id); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-left transition-colors hover:bg-rose-500/10 text-rose-400"
          >
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

  const inputStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Banco de imágenes</h1>
          <p className="text-[12px] text-[var(--muted)]">Activos visuales generados con IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Próximamente: sube tus propios activos visuales', 'info')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <Plus size={13} /> Subir imagen
          </button>
          <button
            onClick={() => { setGeneratePrompt(''); setGenerateModal({ open: true }) }}
            className="btn-primary flex items-center gap-1.5 text-[12px] px-3 py-1.5"
          >
            <Sparkles size={13} /> Generar imagen
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6 max-w-lg">
          {[
            { label: 'Total imágenes', value: totalImages },
            { label: 'Aprobadas',      value: approvedImages },
            { label: 'Pendientes',     value: pendingImages },
          ].map(s => (
            <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
              <div className="text-[20px] font-bold text-white">{s.value}</div>
              <div className="text-[11px] text-[var(--muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <div
              key={img.id}
              className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden transition-all duration-200 hover:border-[var(--border2)] hover:shadow-lg hover:-translate-y-0.5"
            >
              {/* Placeholder image */}
              <div className="aspect-square bg-gradient-to-br from-[var(--surface3)] to-[var(--surface2)] flex items-center justify-center">
                <ImageIcon size={32} className="text-[var(--muted)] opacity-30" />
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                <p className="text-[11px] text-white leading-snug line-clamp-2">{img.prompt}</p>
              </div>
              {/* Badges */}
              <div className="absolute top-2 right-2 flex gap-1">
                {img.approved && (
                  <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </span>
                )}
              </div>
              {/* Footer */}
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-[10px] text-[var(--muted)]">{img.date}</span>
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
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent2)' }} />
            <div className="text-center">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                Generando con IA...
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
                Esto puede tardar unos segundos
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <span
                className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5"
                style={{ color: 'var(--muted)' }}
              >
                Descripción
              </span>
              <textarea
                autoFocus
                rows={3}
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                placeholder="Describe la imagen que necesitas..."
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-colors resize-none"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setGenerateModal({ open: false })}
                className="btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={!generatePrompt.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles size={13} />
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
