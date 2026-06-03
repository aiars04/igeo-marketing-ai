'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Image as ImageIcon, Sparkles, Upload, Check, MoreHorizontal, Loader2, Trash2,
  Download, Copy, RefreshCw, Calendar as CalendarIcon, Maximize2, AlertCircle, Search,
} from 'lucide-react'
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
  created_by: string | null
}

const RATIOS = [
  { value: '1:1',  label: '1:1',  sub: 'Instagram · LinkedIn' },
  { value: '16:9', label: '16:9', sub: 'Blog · Banner'        },
  { value: '9:16', label: '9:16', sub: 'Stories · Reels'      },
  { value: '4:5',  label: '4:5',  sub: 'Feed Instagram'       },
] as const
type AspectRatio = typeof RATIOS[number]['value']

type FilterMode = 'all' | 'approved' | 'pending'

// ─── ImageMenu ───────────────────────────────────────────────────────────────

function ImageMenu({
  img,
  onToggleApprove,
  onDelete,
  onCopyPrompt,
  onDownload,
  onRegenerate,
  busy,
}: {
  img: ImageAsset
  onToggleApprove: (id: string) => void
  onDelete: (id: string) => void
  onCopyPrompt: (prompt: string | null) => void
  onDownload: (img: ImageAsset) => void
  onRegenerate: (img: ImageAsset) => void
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
          onClick={e => e.stopPropagation()}
        >
          {/* Regenerar */}
          {img.prompt && (
            <button
              onClick={() => { onRegenerate(img); setOpen(false) }}
              className="image-menu-item"
            >
              <RefreshCw size={13} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
              Regenerar
            </button>
          )}
          {/* Descargar */}
          <button
            onClick={() => { onDownload(img); setOpen(false) }}
            className="image-menu-item"
          >
            <Download size={13} aria-hidden="true" />
            Descargar
          </button>
          {/* Copiar prompt */}
          {img.prompt && (
            <button
              onClick={() => { onCopyPrompt(img.prompt); setOpen(false) }}
              className="image-menu-item"
            >
              <Copy size={13} aria-hidden="true" />
              Copiar prompt
            </button>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          {/* Aprobar */}
          <button
            onClick={() => { onToggleApprove(img.id); setOpen(false) }}
            className="image-menu-item"
          >
            <Check size={13} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
            {img.approved ? 'Desaprobar' : 'Aprobar'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          {/* Eliminar */}
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

  // Generate modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')

  // Detail modal
  const [detailImage, setDetailImage] = useState<ImageAsset | null>(null)
  const [detailPrompt, setDetailPrompt] = useState('')
  const [detailRegenerating, setDetailRegenerating] = useState(false)
  const [detailConfirmDelete, setDetailConfirmDelete] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Upload
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filters
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')

  // Busy IDs
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

  // ── Filtered list (combinable filter + search) ─────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return images.filter(i => {
      if (filter === 'approved' && !i.approved) return false
      if (filter === 'pending' && i.approved) return false
      if (q && !i.prompt?.toLowerCase().includes(q)) return false
      return true
    })
  }, [images, filter, search])

  // ── Stats sobre el total real (no filtrado) ────────────────────────────────
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
    setDetailImage(prev => prev && prev.id === id ? { ...prev, approved: data.approved } : prev)
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

  // Detail modal
  const openDetail = (img: ImageAsset) => {
    setDetailImage(img)
    setDetailPrompt(img.prompt ?? '')
    setDetailConfirmDelete(false)
    setCopiedPrompt(false)
  }
  const closeDetail = () => {
    if (detailRegenerating) return
    setDetailImage(null)
    setDetailPrompt('')
    setDetailConfirmDelete(false)
  }

  const handleRegenerate = async () => {
    if (!detailImage) return
    const prompt = detailPrompt.trim()
    if (!prompt) {
      showToast('Escribe un prompt para regenerar', 'error')
      return
    }
    const ratio = (detailImage.aspect_ratio ?? '1:1') as AspectRatio
    setDetailRegenerating(true)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: ratio }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error regenerando: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const newAsset = await res.json() as ImageAsset
      setImages(prev => [newAsset, ...prev])
      showToast('Nueva variante generada', 'success')
      setDetailImage(newAsset)
      setDetailPrompt(newAsset.prompt ?? '')
    } finally {
      setDetailRegenerating(false)
    }
  }

  const handleCopyPrompt = async (prompt: string | null) => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(true)
      showToast('Prompt copiado', 'success')
      setTimeout(() => setCopiedPrompt(false), 1500)
    } catch {
      showToast('No se pudo copiar', 'error')
    }
  }

  const handleDownload = async (img: ImageAsset) => {
    try {
      const res = await fetch(img.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `igeo-${img.id}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast(`Error descargando: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    }
  }

  // Upload
  const triggerUpload = () => {
    if (uploading) return
    fileInputRef.current?.click()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset input para permitir re-subida del mismo archivo
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      showToast('Archivo demasiado grande (máx 10 MB)', 'error')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/images/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error subiendo: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const newAsset = await res.json() as ImageAsset
      setImages(prev => [newAsset, ...prev])
      showToast(`Imagen "${file.name}" subida`, 'success')
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'desconocido'}`, 'error')
    } finally {
      setUploading(false)
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
              <span style={{ color: 'var(--ink-2)' }}>total</span>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={triggerUpload}
            className="btn-pill-secondary"
            disabled={uploading}
          >
            {uploading
              ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              : <Upload size={13} aria-hidden="true" />}
            {uploading ? 'Subiendo…' : 'Subir imagen'}
          </button>
          <button
            onClick={() => { setGeneratePrompt(''); setAspectRatio('1:1'); setGenerateModalOpen(true) }}
            className="btn-cta"
          >
            <Sparkles size={13} aria-hidden="true" /> Generar imagen
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-3 px-6 flex-wrap"
        style={{
          paddingTop: 14, paddingBottom: 14,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {([
            { value: 'all',      label: 'Todas' },
            { value: 'approved', label: 'Aprobadas' },
            { value: 'pending',  label: 'Pendientes' },
          ] as const).map(p => {
            const active = filter === p.value
            return (
              <button
                key={p.value}
                onClick={() => setFilter(p.value)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <Search
            size={13}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por prompt…"
            className="input"
            style={{ height: 30, paddingLeft: 30, fontSize: 12 }}
          />
        </div>

        {/* Counter */}
        {(filter !== 'all' || search) && (
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
            {filtered.length} de {totalImages}
          </span>
        )}
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
            <p className="text-[12px]">Pulsa “Generar imagen” para crear la primera con IA, o “Subir imagen”.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center" style={{ color: 'var(--ink-3)' }}>
            <Search size={28} aria-hidden="true" style={{ opacity: 0.5 }} />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              Sin resultados
            </p>
            <p className="text-[12px]">Prueba a ampliar el filtro o cambiar la búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(img => (
              <div
                key={img.id}
                className="image-card group"
                onClick={() => openDetail(img)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(img) }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Abrir detalle: ${img.prompt ?? 'imagen subida'}`}
                style={{ cursor: 'pointer' }}
              >
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
                    {img.prompt ?? 'Imagen subida sin prompt'}
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
                  onClick={e => e.stopPropagation()}
                >
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
                    {img.created_at.slice(0, 10)}
                  </span>
                  <ImageMenu
                    img={img}
                    onToggleApprove={handleToggleApprove}
                    onDelete={handleDelete}
                    onCopyPrompt={handleCopyPrompt}
                    onDownload={handleDownload}
                    onRegenerate={openDetail}
                    busy={busyId === img.id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Generate Modal ── */}
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

      {/* ── Detail Modal ── */}
      <Modal
        open={!!detailImage}
        onClose={closeDetail}
        title="Detalle de imagen"
        size="lg"
      >
        {detailImage && (
          <div className="flex flex-col gap-4">
            {/* Preview grande */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: 360,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detailImage.url}
                alt={detailImage.prompt ?? 'Imagen'}
                style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }}
              />
            </div>

            {/* Prompt original */}
            <div>
              <span className="section-label block mb-1.5">Prompt original</span>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                {detailImage.prompt ?? <em style={{ color: 'var(--ink-3)' }}>(Imagen subida sin prompt)</em>}
              </p>
            </div>

            {/* Grid metadatos 3 columnas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                rowGap: 16, columnGap: 32,
                padding: 16,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <span className="section-label block mb-1">Formato</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Maximize2 size={11} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {detailImage.aspect_ratio ?? '—'}
                  </span>
                  {detailImage.width && detailImage.height && (
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      · {detailImage.width}×{detailImage.height}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="section-label block mb-1">Fecha</span>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={11} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {new Date(detailImage.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <div>
                <span className="section-label block mb-1">Estado</span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: detailImage.approved ? 'var(--green-soft)' : 'var(--amber-soft)',
                    border: `1px solid ${detailImage.approved ? 'var(--green-border)' : 'rgba(255,159,10,0.25)'}`,
                    color: detailImage.approved ? 'var(--green-2)' : '#b25000',
                  }}
                >
                  {detailImage.approved
                    ? <><Check size={11} aria-hidden="true" /> Aprobada</>
                    : <><AlertCircle size={11} aria-hidden="true" /> Pendiente</>}
                </span>
              </div>
            </div>

            {/* Editar prompt + regenerar — solo si tenía prompt original (imágenes IA) */}
            {detailImage.prompt !== null && (
              <div>
                <span className="section-label block mb-1.5">Editar prompt y regenerar</span>
                <textarea
                  rows={3}
                  value={detailPrompt}
                  onChange={e => setDetailPrompt(e.target.value)}
                  placeholder="Edita el prompt antes de regenerar…"
                  className="input"
                  disabled={detailRegenerating}
                />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                  Mantiene el ratio <strong>{detailImage.aspect_ratio ?? '1:1'}</strong>. La nueva imagen se añadirá al grid.
                </p>
              </div>
            )}

            {/* Footer */}
            <div
              className="flex items-center justify-between pt-2 flex-wrap gap-2"
              style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}
            >
              {/* Izquierda — eliminar */}
              <div>
                {detailConfirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{ color: 'var(--red-2)' }}>¿Seguro?</span>
                    <button
                      className="btn-secondary"
                      onClick={() => setDetailConfirmDelete(false)}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn-destructive"
                      onClick={async () => {
                        const id = detailImage.id
                        await handleDelete(id)
                        if (detailImage?.id === id) closeDetail()
                      }}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      <Trash2 size={11} aria-hidden="true" /> Sí, eliminar
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-pill-secondary"
                    onClick={() => setDetailConfirmDelete(true)}
                    style={{ color: 'var(--red-2)' }}
                  >
                    <Trash2 size={13} aria-hidden="true" /> Eliminar
                  </button>
                )}
              </div>

              {/* Derecha — acciones */}
              <div className="flex items-center gap-2 flex-wrap">
                {detailImage.prompt && (
                  <button
                    className="btn-pill-secondary"
                    onClick={() => handleCopyPrompt(detailImage.prompt)}
                    title="Copiar prompt"
                  >
                    {copiedPrompt
                      ? <Check size={13} aria-hidden="true" />
                      : <Copy size={13} aria-hidden="true" />}
                    {copiedPrompt ? 'Copiado' : 'Copiar'}
                  </button>
                )}
                <button
                  className="btn-pill-secondary"
                  onClick={() => handleDownload(detailImage)}
                  title="Descargar"
                >
                  <Download size={13} aria-hidden="true" /> Descargar
                </button>
                {detailImage.prompt !== null && (
                  <button
                    className="btn-pill-secondary"
                    onClick={handleRegenerate}
                    disabled={detailRegenerating || !detailPrompt.trim()}
                    title="Generar nueva variante con el prompt editado"
                  >
                    {detailRegenerating
                      ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      : <RefreshCw size={13} aria-hidden="true" />}
                    {detailRegenerating ? 'Regenerando…' : 'Regenerar'}
                  </button>
                )}
                <button
                  className={detailImage.approved ? 'btn-secondary' : 'btn-cta'}
                  onClick={() => handleToggleApprove(detailImage.id)}
                  disabled={busyId === detailImage.id}
                >
                  <Check size={13} aria-hidden="true" />
                  {detailImage.approved ? 'Desaprobar' : 'Aprobar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
