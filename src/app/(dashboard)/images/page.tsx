'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Image as ImageIcon, Sparkles, Upload, Check, MoreHorizontal, Loader2, Trash2,
  Download, Copy, RefreshCw, Calendar as CalendarIcon, Maximize2, AlertCircle, Search, X,
  ChevronLeft, ChevronRight, Layers, CheckSquare,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import { ImageFoldersSidebar, type FolderWithCount } from '@/components/images/ImageFoldersSidebar'

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
  content_item_id: string | null
  carousel_id: string | null
  position: number | null
  channel: string | null
  folder_id: string | null
  asset_type?: string | null
  mime_type?: string | null
}

/** True si el asset es un vídeo (asset_type='video' o URL con extensión .mp4/.mov/.webm). */
function isVideoAsset(a: { asset_type?: string | null; url: string }): boolean {
  if (a.asset_type === 'video') return true
  const path = a.url.split('?')[0].toLowerCase()
  return path.endsWith('.mp4') || path.endsWith('.mov') || path.endsWith('.webm')
}

interface PipelineItemLite {
  id: string
  title: string
  channel: string
  stage: string
}

const RATIOS = [
  { value: '1:1',  label: '1:1',  sub: 'Instagram · LinkedIn' },
  { value: '16:9', label: '16:9', sub: 'Blog · Banner'        },
  { value: '9:16', label: '9:16', sub: 'Stories · Reels'      },
  { value: '4:5',  label: '4:5',  sub: 'Feed Instagram'       },
] as const
type AspectRatio = typeof RATIOS[number]['value']

type FilterMode = 'all' | 'approved' | 'pending'
type GenMode = 'individual' | 'variants' | 'curated'

// Unidad de render del grid: imagen individual o carrusel (grupo)
type GridUnit =
  | { kind: 'single'; asset: ImageAsset }
  | { kind: 'carousel'; carouselId: string; assets: ImageAsset[]; cover: ImageAsset }

// ─── ImageMenu (sin cambios) ──────────────────────────────────────────────────

function ImageMenu({
  img, onToggleApprove, onDelete, onCopyPrompt, onDownload, onRegenerate, busy,
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
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {img.prompt && (
            <button onClick={() => { onRegenerate(img); setOpen(false) }} className="image-menu-item">
              <RefreshCw size={13} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
              Regenerar
            </button>
          )}
          <button onClick={() => { onDownload(img); setOpen(false) }} className="image-menu-item">
            <Download size={13} aria-hidden="true" /> Descargar
          </button>
          {img.prompt && (
            <button onClick={() => { onCopyPrompt(img.prompt); setOpen(false) }} className="image-menu-item">
              <Copy size={13} aria-hidden="true" /> Copiar prompt
            </button>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          <button onClick={() => { onToggleApprove(img.id); setOpen(false) }} className="image-menu-item">
            <Check size={13} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
            {img.approved ? 'Desaprobar' : 'Aprobar'}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
          <button onClick={() => { onDelete(img.id); setOpen(false) }} className="image-menu-item image-menu-item-destructive">
            <Trash2 size={13} aria-hidden="true" /> Eliminar
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
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateProgress, setGenerateProgress] = useState('') // mensaje "Slide 2 de 4..."
  const [genMode, setGenMode] = useState<GenMode>('individual')
  const [genCount, setGenCount] = useState<2 | 3 | 4>(4)
  const [genPrompt, setGenPrompt] = useState('')                  // individual + variants
  const [genPrompts, setGenPrompts] = useState<string[]>(['', '', '', ''])  // curated
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')

  // Detail (single image) modal
  const [detailImage, setDetailImage] = useState<ImageAsset | null>(null)
  const [detailPrompt, setDetailPrompt] = useState('')
  const [detailRegenerating, setDetailRegenerating] = useState(false)
  const [detailConfirmDelete, setDetailConfirmDelete] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  // Carousel detail modal
  const [carouselDetail, setCarouselDetail] = useState<{ carouselId: string; assets: ImageAsset[]; activeIdx: number } | null>(null)
  const [carouselConfirmDelete, setCarouselConfirmDelete] = useState(false)

  // Upload
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pipeline items
  const [pipelineItems, setPipelineItems] = useState<PipelineItemLite[]>([])
  const [assignTarget, setAssignTarget] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  // Filters
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')

  // Selección múltiple para borrado en lote
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  // Folders
  const [folders, setFolders] = useState<FolderWithCount[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null) // null = todas, 'uncategorized' o uuid

  // Busy IDs
  const [busyId, setBusyId] = useState<string | null>(null)

  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Cargar carpetas (también recalcula counts) ─────────────────────────────
  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/image-folders')
      if (!res.ok) return
      const data = await res.json() as { folders: FolderWithCount[]; uncategorized_count: number; total_count: number }
      setFolders(data.folders)
      setUncategorizedCount(data.uncategorized_count)
      setTotalCount(data.total_count)
    } catch {}
  }

  // ── Cargar imágenes (con filtro folder opcional) ───────────────────────────
  const fetchImages = async (folder: string | null) => {
    setLoading(true)
    try {
      const url = folder ? `/api/images?folder_id=${encodeURIComponent(folder)}` : '/api/images'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ImageAsset[]
      setImages(data)
    } catch (e) {
      showToast(`Error cargando imágenes: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Carga inicial — folders + images ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.all([
        fetchFolders(),
        (async () => {
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
        })(),
      ])
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Refetch al cambiar selectedFolder ───────────────────────────────────────
  const [initialDone, setInitialDone] = useState(false)
  useEffect(() => {
    if (!loading && !initialDone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialDone(true)
      return
    }
    if (initialDone) {
      fetchImages(selectedFolder)
      // Limpiar la selección al cambiar de carpeta: los items seleccionados
      // ya no estarían visibles en la nueva carpeta, y si el usuario pulsa
      // "Eliminar N" se borrarían imágenes que no está viendo.
      setSelectedIds(new Set())
      setConfirmBulkDelete(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder])

  // ── Filtered + grouped (carousels as 1 unit) ───────────────────────────────
  const gridUnits: GridUnit[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Pre-filter por approved/pendiente y búsqueda (la búsqueda toca prompt de cualquier slide del carrusel)
    const filteredAssets = images.filter(i => {
      if (filter === 'approved' && !i.approved) return false
      if (filter === 'pending' && i.approved) return false
      if (q && !i.prompt?.toLowerCase().includes(q)) return false
      return true
    })

    // Map carousel_id → assets[]
    const carouselMap = new Map<string, ImageAsset[]>()
    const singles: ImageAsset[] = []
    for (const a of filteredAssets) {
      if (a.carousel_id) {
        if (!carouselMap.has(a.carousel_id)) carouselMap.set(a.carousel_id, [])
        carouselMap.get(a.carousel_id)!.push(a)
      } else {
        singles.push(a)
      }
    }

    // Ordenar slides por position
    for (const [, arr] of carouselMap) {
      arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }

    // Construir lista de unidades respetando el orden original (más reciente primero)
    const seenCarousels = new Set<string>()
    const units: GridUnit[] = []
    for (const a of filteredAssets) {
      if (a.carousel_id) {
        if (seenCarousels.has(a.carousel_id)) continue
        seenCarousels.add(a.carousel_id)
        const group = carouselMap.get(a.carousel_id)!
        units.push({ kind: 'carousel', carouselId: a.carousel_id, assets: group, cover: group[0] })
      } else {
        units.push({ kind: 'single', asset: a })
      }
    }
    return units
  }, [images, filter, search])

  // ── Stats (sobre el total real, no agrupado) ───────────────────────────────
  const totalImages = images.length
  const approvedImages = images.filter(i => i.approved).length
  const pendingImages = images.filter(i => !i.approved).length

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleApprove = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/images/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
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
    setCarouselDetail(prev => prev
      ? { ...prev, assets: prev.assets.map(a => a.id === id ? { ...a, approved: data.approved } : a) }
      : null
    )
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

  // ── Selección múltiple ─────────────────────────────────────────────────
  const toggleSelectionMode = () => {
    setSelectionMode(prev => {
      const next = !prev
      if (!next) setSelectedIds(new Set()) // al salir, limpiar
      setConfirmBulkDelete(false)
      return next
    })
  }
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAllVisible = (visibleIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const id of visibleIds) next.add(id)
      return next
    })
  }
  const clearSelection = () => {
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
  }

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const res = await fetch('/api/images/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error: ${j.detail ?? j.error ?? res.statusText}`, 'error')
        return
      }
      const data = await res.json() as {
        deleted: number
        skipped: { notFound: string[]; forbidden: string[] }
      }
      // Optimistic local: quita todas las que el backend reporta como borradas.
      // Reconstruimos sumando notFound (ya no existían) — también las quitamos
      // del state local porque el listado anterior las mostraba.
      const removedFromUI = new Set<string>([
        ...ids.filter(id => !data.skipped.forbidden.includes(id)),
      ])
      setImages(prev => prev.filter(i => !removedFromUI.has(i.id)))
      setSelectedIds(new Set())
      setConfirmBulkDelete(false)
      setSelectionMode(false)
      // Refrescar contadores de carpetas
      fetchFolders()
      const denied = data.skipped.forbidden.length
      if (denied > 0) {
        showToast(
          `Eliminadas ${data.deleted}. ${denied} no se pudieron borrar (solo puede borrarlas el creador o un admin).`,
          'info',
        )
      } else {
        showToast(`Eliminadas ${data.deleted} imágenes`, 'success')
      }
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Generación
  const openGenerate = () => {
    setGenMode('individual')
    setGenCount(4)
    setGenPrompt('')
    setGenPrompts(['', '', '', ''])
    setAspectRatio('1:1')
    setGenerateProgress('')
    setGenerateModalOpen(true)
  }

  const handleGenerate = async () => {
    setGenerateLoading(true)
    setGenerateProgress('')
    try {
      if (genMode === 'individual') {
        if (!genPrompt.trim()) { showToast('Escribe un prompt', 'error'); return }
        const res = await fetch('/api/images/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: genPrompt.trim(), aspectRatio }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          showToast(`Error generando: ${j.error ?? res.statusText}`, 'error')
          return
        }
        const newAsset = await res.json() as ImageAsset
        setImages(prev => [newAsset, ...prev])
        showToast('Imagen generada', 'success')
        setGenerateModalOpen(false)
      } else if (genMode === 'variants') {
        if (!genPrompt.trim()) { showToast('Escribe un prompt', 'error'); return }
        setGenerateProgress(`Generando ${genCount} variantes…`)
        const res = await fetch('/api/images/carousel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'variants', prompts: [genPrompt.trim()], count: genCount, aspectRatio,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          showToast(`Error carrusel: ${j.error ?? res.statusText}`, 'error')
          return
        }
        const data = await res.json() as { carousel_id: string; assets: ImageAsset[] }
        setImages(prev => [...data.assets, ...prev])
        showToast(`${data.assets.length} variantes generadas`, 'success')
        setGenerateModalOpen(false)
      } else {
        // curated
        const validPrompts = genPrompts.slice(0, genCount).map(p => p.trim()).filter(Boolean)
        if (validPrompts.length !== genCount) {
          showToast(`Rellena los ${genCount} prompts`, 'error')
          return
        }
        setGenerateProgress(`Generando ${genCount} slides (puede tardar 1-2 min)…`)
        const res = await fetch('/api/images/carousel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'curated', prompts: validPrompts, aspectRatio }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          showToast(`Error carrusel curado: ${j.error ?? res.statusText}`, 'error')
          return
        }
        const data = await res.json() as { carousel_id: string; assets: ImageAsset[] }
        setImages(prev => [...data.assets, ...prev])
        showToast(`Carrusel curado de ${data.assets.length} slides generado`, 'success')
        setGenerateModalOpen(false)
      }
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setGenerateLoading(false)
      setGenerateProgress('')
    }
  }

  // Carousel detail
  const openCarousel = (carouselId: string, assets: ImageAsset[]) => {
    setCarouselDetail({ carouselId, assets, activeIdx: 0 })
    setCarouselConfirmDelete(false)
  }
  const closeCarousel = () => setCarouselDetail(null)

  const handleApproveAllCarousel = async () => {
    if (!carouselDetail) return
    // PATCH directo (no via handleToggleApprove) para emitir UN SOLO toast en
    // vez de uno por slide. Actualizamos el estado de los que sí se aprobaron.
    const pending = carouselDetail.assets.filter(a => !a.approved)
    if (pending.length === 0) { showToast('El carrusel ya está aprobado', 'info'); return }
    const okIds: string[] = []
    let failed = 0
    for (const a of pending) {
      try {
        const res = await fetch(`/api/images/${a.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        })
        if (res.ok) okIds.push(a.id); else failed++
      } catch { failed++ }
    }
    if (okIds.length > 0) {
      setImages(prev => prev.map(i => okIds.includes(i.id) ? { ...i, approved: true } : i))
      setCarouselDetail(prev => prev
        ? { ...prev, assets: prev.assets.map(a => okIds.includes(a.id) ? { ...a, approved: true } : a) }
        : null)
    }
    showToast(
      failed === 0
        ? `Carrusel aprobado (${okIds.length} imágenes)`
        : `${okIds.length} aprobadas, ${failed} fallaron`,
      failed === 0 ? 'success' : 'error',
    )
  }

  const handleDeleteCarousel = async () => {
    if (!carouselDetail) return
    const ids = carouselDetail.assets.map(a => a.id)
    const deleted: string[] = []
    let failed = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/images/${id}`, { method: 'DELETE' })
        if (res.ok) deleted.push(id); else failed++
      } catch { failed++ }
    }
    // Solo quitamos de la UI los que SÍ se borraron (antes los quitaba todos
    // aunque el DELETE fallara → desincronización UI/BD).
    if (deleted.length > 0) {
      setImages(prev => prev.filter(i => !deleted.includes(i.id)))
    }
    showToast(
      failed === 0
        ? `Carrusel eliminado (${deleted.length} imágenes)`
        : `${deleted.length} eliminadas, ${failed} fallaron`,
      failed === 0 ? 'info' : 'error',
    )
    if (failed === 0) closeCarousel()
  }

  // Pipeline items — cargar lista al abrir el modal de detalle
  const fetchPipelineItems = async () => {
    try {
      const res = await fetch('/api/content-items')
      if (!res.ok) return
      const data = await res.json() as PipelineItemLite[]
      setPipelineItems(data)
    } catch {}
  }

  // Detail modal (single)
  const openDetail = (img: ImageAsset) => {
    setDetailImage(img)
    setDetailPrompt(img.prompt ?? '')
    setDetailConfirmDelete(false)
    setCopiedPrompt(false)
    setAssignTarget(img.content_item_id ?? '')
    fetchPipelineItems()
  }

  const handleAssign = async () => {
    if (!detailImage) return
    setAssigning(true)
    const newTarget = assignTarget || null
    const res = await fetch(`/api/images/${detailImage.id}/assign`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_item_id: newTarget }),
    })
    setAssigning(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error asignando: ${j.error ?? res.statusText}`, 'error')
      return
    }
    setImages(prev => prev.map(i => i.id === detailImage.id ? { ...i, content_item_id: newTarget } : i))
    setDetailImage(prev => prev ? { ...prev, content_item_id: newTarget } : null)
    showToast(newTarget ? 'Imagen asignada al ítem' : 'Imagen desasignada', 'success')
  }

  const closeDetail = () => {
    if (detailRegenerating || assigning) return
    setDetailImage(null)
    setDetailPrompt('')
    setDetailConfirmDelete(false)
    setAssignTarget('')
  }

  const handleRegenerate = async () => {
    if (!detailImage) return
    const prompt = detailPrompt.trim()
    if (!prompt) { showToast('Escribe un prompt para regenerar', 'error'); return }
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
    } catch { showToast('No se pudo copiar', 'error') }
  }

  const handleDownload = async (img: ImageAsset) => {
    try {
      const res = await fetch(img.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `igeo-${img.id}.png`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast(`Error descargando: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    }
  }

  // Upload
  const triggerUpload = () => { if (!uploading) fileInputRef.current?.click() }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { showToast('Archivo demasiado grande (máx 10 MB)', 'error'); return }
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
      {/* Topbar (full width arriba del split) */}
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1, margin: 0 }}>
              Imágenes
            </h1>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-3)', margin: '3px 0 0', letterSpacing: '0.01em' }}>
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
          <button onClick={triggerUpload} className="btn-pill-secondary" disabled={uploading}>
            {uploading
              ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              : <Upload size={13} aria-hidden="true" />}
            {uploading ? 'Subiendo…' : 'Subir imagen'}
          </button>
          <button onClick={openGenerate} className="btn-cta">
            <Sparkles size={13} aria-hidden="true" /> Generar imagen
          </button>
        </div>
      </div>

      {/* Split: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <ImageFoldersSidebar
          folders={folders}
          totalCount={totalCount}
          uncategorizedCount={uncategorizedCount}
          selectedFolder={selectedFolder}
          onSelect={setSelectedFolder}
          onFoldersChange={fetchFolders}
          canManage={true}
          showError={msg => showToast(msg, 'error')}
        />

        <div className="flex flex-col flex-1 overflow-hidden">

      {/* Filter bar */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ paddingTop: 14, paddingBottom: 14, paddingLeft: 40, paddingRight: 24, borderBottom: '1px solid var(--border)' }}
      >
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
                  height: 28, padding: '0 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

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

        {(filter !== 'all' || search) && (
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
            {gridUnits.length} resultado{gridUnits.length === 1 ? '' : 's'}
          </span>
        )}

        {/* Controles de selección múltiple. Apilados a la derecha. */}
        <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
          {!selectionMode ? (
            <button
              onClick={toggleSelectionMode}
              style={{
                height: 30, padding: '0 12px', fontSize: 11, fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              title="Activa el modo selección para borrar varias imágenes a la vez"
            >
              <CheckSquare size={13} aria-hidden="true" /> Seleccionar
            </button>
          ) : (
            <>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => {
                  const visibleIds = gridUnits.flatMap(u => u.kind === 'single' ? [u.asset.id] : u.assets.map(a => a.id))
                  selectAllVisible(visibleIds)
                }}
                disabled={bulkDeleting}
                style={{
                  height: 30, padding: '0 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)', color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                Seleccionar visibles
              </button>
              {selectedIds.size > 0 && !confirmBulkDelete && (
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={bulkDeleting}
                  style={{
                    height: 30, padding: '0 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid #dc2626',
                    background: '#dc2626', color: '#fff',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Trash2 size={12} aria-hidden="true" /> Eliminar {selectedIds.size}
                </button>
              )}
              {confirmBulkDelete && (
                <>
                  <span className="text-[11px]" style={{ color: '#b91c1c', fontWeight: 600 }}>
                    ¿Borrar {selectedIds.size} imagen{selectedIds.size === 1 ? '' : 'es'}?
                  </span>
                  <button
                    onClick={() => setConfirmBulkDelete(false)}
                    disabled={bulkDeleting}
                    style={{
                      height: 30, padding: '0 12px', fontSize: 11, fontWeight: 500,
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={bulkDeleting}
                    style={{
                      height: 30, padding: '0 12px', fontSize: 11, fontWeight: 700,
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid #dc2626',
                      background: '#dc2626', color: '#fff',
                      cursor: bulkDeleting ? 'wait' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {bulkDeleting
                      ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      : <Trash2 size={12} aria-hidden="true" />}
                    {bulkDeleting ? 'Borrando…' : 'Sí, borrar'}
                  </button>
                </>
              )}
              <button
                onClick={selectedIds.size > 0 && !confirmBulkDelete ? clearSelection : toggleSelectionMode}
                disabled={bulkDeleting}
                style={{
                  height: 30, padding: '0 10px', fontSize: 11, fontWeight: 500,
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--ink-3)',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
                title={selectedIds.size > 0 && !confirmBulkDelete ? 'Quitar selección' : 'Salir del modo selección'}
              >
                <X size={12} aria-hidden="true" />
                {selectedIds.size > 0 && !confirmBulkDelete ? 'Limpiar' : 'Salir'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto" style={{ paddingLeft: 40, paddingRight: 24, paddingTop: 24, paddingBottom: 24 }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ink-3)' }}>
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p className="text-[12px]">Cargando imágenes…</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center" style={{ color: 'var(--ink-3)' }}>
            <ImageIcon size={32} aria-hidden="true" style={{ opacity: 0.5 }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>No hay imágenes todavía</p>
            <p className="text-[12px]">Pulsa “Generar imagen” para crear la primera con IA, o “Subir imagen”.</p>
          </div>
        ) : gridUnits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center" style={{ color: 'var(--ink-3)' }}>
            <Search size={28} aria-hidden="true" style={{ opacity: 0.5 }} />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Sin resultados</p>
            <p className="text-[12px]">Prueba a ampliar el filtro o cambiar la búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {gridUnits.map(unit => {
              if (unit.kind === 'single') {
                const img = unit.asset
                const isSelected = selectedIds.has(img.id)
                return (
                  <div
                    key={img.id}
                    className="image-card group"
                    onClick={() => {
                      if (selectionMode) toggleSelected(img.id)
                      else openDetail(img)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (selectionMode) toggleSelected(img.id)
                        else openDetail(img)
                      }
                    }}
                    role="button" tabIndex={0}
                    aria-label={selectionMode
                      ? `${isSelected ? 'Deseleccionar' : 'Seleccionar'} imagen: ${img.prompt ?? 'imagen subida'}`
                      : `Abrir detalle: ${img.prompt ?? 'imagen subida'}`}
                    aria-pressed={selectionMode ? isSelected : undefined}
                    style={{
                      cursor: 'pointer',
                      outline: selectionMode && isSelected ? '3px solid var(--accent)' : undefined,
                      outlineOffset: selectionMode && isSelected ? '-3px' : undefined,
                    }}
                  >
                    <div className="aspect-square overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      {isVideoAsset(img) ? (
                        <video src={img.url} preload="metadata" muted
                               style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }} />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={img.url} alt={img.prompt ?? 'Imagen'} loading="lazy"
                             style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                    {selectionMode && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute', top: 8, left: 8,
                          width: 24, height: 24,
                          borderRadius: 6,
                          background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.55)',
                          border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} style={{ color: '#fff' }} />}
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {img.aspect_ratio && (
                        <span
                          className="px-1.5 rounded-sm tabular-nums"
                          style={{ height: 18, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'inline-flex', alignItems: 'center' }}
                        >
                          {img.aspect_ratio}
                        </span>
                      )}
                      {img.approved && (
                        <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--green)' }} aria-label="Aprobada">
                          <Check size={10} aria-hidden="true" style={{ color: '#ffffff' }} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div
                      className="flex items-center justify-between"
                      style={{ padding: '12px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
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
                )
              }

              // CARROUSEL CARD
              const cov = unit.cover
              const n = unit.assets.length
              const allApproved = unit.assets.every(a => a.approved)
              const carouselIds = unit.assets.map(a => a.id)
              const carouselAllSelected = carouselIds.every(id => selectedIds.has(id))
              const carouselSomeSelected = !carouselAllSelected && carouselIds.some(id => selectedIds.has(id))
              const toggleCarouselSelection = () => {
                setSelectedIds(prev => {
                  const next = new Set(prev)
                  if (carouselAllSelected) {
                    for (const id of carouselIds) next.delete(id)
                  } else {
                    for (const id of carouselIds) next.add(id)
                  }
                  return next
                })
              }
              return (
                <div
                  key={unit.carouselId}
                  style={{
                    position: 'relative',
                    cursor: 'pointer',
                    outline: selectionMode && carouselAllSelected ? '3px solid var(--accent)' : undefined,
                    outlineOffset: selectionMode && carouselAllSelected ? '-3px' : undefined,
                  }}
                  onClick={() => {
                    if (selectionMode) toggleCarouselSelection()
                    else openCarousel(unit.carouselId, unit.assets)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (selectionMode) toggleCarouselSelection()
                      else openCarousel(unit.carouselId, unit.assets)
                    }
                  }}
                  role="button" tabIndex={0}
                  aria-label={selectionMode
                    ? `${carouselAllSelected ? 'Deseleccionar' : 'Seleccionar'} carrusel de ${n} imágenes`
                    : `Abrir carrusel de ${n} imágenes`}
                  aria-pressed={selectionMode ? carouselAllSelected : undefined}
                >
                  {/* Stack hint — 2 capas detrás */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 6, left: 6, right: -6, bottom: -6,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      zIndex: 0,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 3, left: 3, right: -3, bottom: -3,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      zIndex: 1,
                    }}
                  />
                  <div
                    className="image-card group relative"
                    style={{ zIndex: 2 }}
                  >
                    <div className="aspect-square overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cov.url} alt={cov.prompt ?? 'Carrusel'} loading="lazy"
                           style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    {selectionMode && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute', top: 8, left: 8,
                          width: 24, height: 24,
                          borderRadius: 6,
                          background: carouselAllSelected
                            ? 'var(--accent)'
                            : carouselSomeSelected
                              ? 'rgba(234,88,12,0.45)'
                              : 'rgba(0,0,0,0.55)',
                          border: carouselAllSelected ? 'none' : '1px solid rgba(255,255,255,0.6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                          zIndex: 3,
                        }}
                      >
                        {carouselAllSelected && <Check size={14} strokeWidth={3} style={{ color: '#fff' }} />}
                        {carouselSomeSelected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>–</span>}
                      </div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <span
                        className="px-1.5 rounded-sm tabular-nums inline-flex items-center gap-1"
                        style={{ height: 18, fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff' }}
                        title={`Carrusel de ${n} imágenes`}
                      >
                        <Layers size={9} aria-hidden="true" />
                        1/{n}
                      </span>
                      {cov.aspect_ratio && (
                        <span
                          className="px-1.5 rounded-sm tabular-nums"
                          style={{ height: 18, fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'inline-flex', alignItems: 'center' }}
                        >
                          {cov.aspect_ratio}
                        </span>
                      )}
                      {allApproved && (
                        <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--green)' }} aria-label="Carrusel aprobado">
                          <Check size={10} aria-hidden="true" style={{ color: '#ffffff' }} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    {/* Footer */}
                    <div
                      className="flex items-center justify-between"
                      style={{ padding: '12px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
                    >
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
                        {cov.created_at.slice(0, 10)}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>
                        Carrusel · {n}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

        </div>{/* /flex-col main */}
      </div>{/* /flex split */}

      {/* ── Generate Modal ── */}
      <Modal
        open={generateModalOpen}
        onClose={() => { if (!generateLoading) setGenerateModalOpen(false) }}
        title="Generar imagen con IA"
        size="md"
      >
        {generateLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
            <div className="text-center">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                {generateProgress || 'Generando con Nano Banana 2…'}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                {genMode === 'curated' ? 'Cada slide tarda 3-8s' : 'Esto puede tardar 3-8 segundos'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mode selector */}
            <div>
              <span className="section-label block mb-1.5">Modo de generación</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { value: 'individual', label: 'Individual', sub: '1 imagen' },
                  { value: 'variants',   label: 'Variantes',  sub: 'N salidas del mismo prompt' },
                  { value: 'curated',    label: 'Carrusel',   sub: 'N slides con prompts distintos' },
                ] as const).map(m => {
                  const active = genMode === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setGenMode(m.value)}
                      aria-pressed={active}
                      style={{
                        flex: 1, minWidth: 120,
                        padding: '8px 6px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        cursor: 'pointer', textAlign: 'center',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--ink)' }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{m.sub}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Count selector — solo para variants/curated */}
            {genMode !== 'individual' && (
              <div>
                <span className="section-label block mb-1.5">Cantidad</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([2, 3, 4] as const).map(n => {
                    const active = genCount === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGenCount(n)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                          color: active ? 'var(--accent)' : 'var(--ink)',
                          cursor: 'pointer', fontSize: 13, fontWeight: 700,
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Aspect ratio */}
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
                        flex: 1, padding: '8px 4px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        cursor: 'pointer', textAlign: 'center',
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

            {/* Prompt(s) */}
            {genMode === 'curated' ? (
              <div>
                <span className="section-label block mb-1.5">Prompts ({genCount} slides)</span>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: genCount }).map((_, i) => (
                    <div key={i} className="relative">
                      <span
                        style={{
                          position: 'absolute', left: 8, top: 8,
                          fontSize: 10, fontWeight: 700,
                          background: 'var(--accent)', color: '#fff',
                          padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        SLIDE {i + 1}
                      </span>
                      <textarea
                        rows={2}
                        value={genPrompts[i] ?? ''}
                        onChange={e => {
                          const next = [...genPrompts]
                          next[i] = e.target.value
                          setGenPrompts(next)
                        }}
                        placeholder={`Prompt slide ${i + 1}…`}
                        className="input"
                        style={{ paddingLeft: 70, paddingTop: 8 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span className="section-label block mb-1.5">Descripción</span>
                <textarea
                  autoFocus
                  rows={4}
                  value={genPrompt}
                  onChange={e => setGenPrompt(e.target.value)}
                  placeholder={
                    genMode === 'variants'
                      ? 'Describe la imagen — generaremos varias variantes con este mismo prompt…'
                      : 'Describe la imagen que necesitas — sé específico con escena, estilo, iluminación…'
                  }
                  className="input"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setGenerateModalOpen(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={handleGenerate} className="btn-cta flex-1">
                <Sparkles size={13} aria-hidden="true" />
                Generar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Detail Modal (single) ── */}
      <Modal open={!!detailImage} onClose={closeDetail} title="Detalle de imagen" size="lg">
        {detailImage && (
          <div className="flex flex-col gap-4">
            <div
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                maxHeight: 360,
              }}
            >
              {isVideoAsset(detailImage) ? (
                <video
                  src={detailImage.url}
                  controls
                  preload="metadata"
                  style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain', display: 'block', background: '#000' }}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={detailImage.url}
                  alt={detailImage.prompt ?? 'Imagen'}
                  style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }}
                />
              )}
            </div>

            <div>
              <span className="section-label block mb-1.5">Prompt original</span>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                {detailImage.prompt ?? <em style={{ color: 'var(--ink-3)' }}>(Imagen subida sin prompt)</em>}
              </p>
            </div>

            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                rowGap: 16, columnGap: 32, padding: 16,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
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
                    {new Date(detailImage.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div>
                <span className="section-label block mb-1">Estado</span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px',
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

            {/* Asignar al pipeline */}
            <div>
              <span className="section-label block mb-1.5">Asignar a ítem del pipeline</span>
              <div className="flex items-center gap-2">
                <select
                  className="input flex-1"
                  value={assignTarget}
                  onChange={e => setAssignTarget(e.target.value)}
                  disabled={assigning || pipelineItems.length === 0}
                >
                  <option value="">— Sin asignar —</option>
                  {pipelineItems.map(it => (
                    <option key={it.id} value={it.id}>
                      [{it.stage}] {it.channel} · {it.title.length > 60 ? it.title.slice(0, 60) + '…' : it.title}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-cta"
                  onClick={handleAssign}
                  disabled={assigning || assignTarget === (detailImage.content_item_id ?? '')}
                  title={assignTarget ? 'Asignar al ítem seleccionado' : 'Desasignar'}
                >
                  {assigning
                    ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    : assignTarget ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                  {assigning ? 'Guardando…' : assignTarget ? 'Asignar' : 'Desasignar'}
                </button>
              </div>
              {detailImage.content_item_id && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                  Asignada actualmente a:{' '}
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                    {pipelineItems.find(p => p.id === detailImage.content_item_id)?.title ?? detailImage.content_item_id.slice(0, 8)}
                  </span>
                </p>
              )}
              {pipelineItems.length === 0 && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                  No hay ítems en el pipeline todavía. Crea uno desde /pipeline.
                </p>
              )}
            </div>

            {/* Editar prompt + regenerar */}
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

            <div
              className="flex items-center justify-between pt-2 flex-wrap gap-2"
              style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}
            >
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

              <div className="flex items-center gap-2 flex-wrap">
                {detailImage.prompt && (
                  <button className="btn-pill-secondary" onClick={() => handleCopyPrompt(detailImage.prompt)} title="Copiar prompt">
                    {copiedPrompt ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {copiedPrompt ? 'Copiado' : 'Copiar'}
                  </button>
                )}
                <button className="btn-pill-secondary" onClick={() => handleDownload(detailImage)} title="Descargar">
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

      {/* ── Carousel Detail Modal ── */}
      <Modal
        open={!!carouselDetail}
        onClose={closeCarousel}
        title="Detalle de carrusel"
        size="lg"
      >
        {carouselDetail && (() => {
          const active = carouselDetail.assets[carouselDetail.activeIdx]
          const n = carouselDetail.assets.length
          const allApproved = carouselDetail.assets.every(a => a.approved)
          const goPrev = () => setCarouselDetail(d => d ? { ...d, activeIdx: (d.activeIdx - 1 + d.assets.length) % d.assets.length } : null)
          const goNext = () => setCarouselDetail(d => d ? { ...d, activeIdx: (d.activeIdx + 1) % d.assets.length } : null)

          return (
            <div className="flex flex-col gap-4">
              {/* Hero — imagen activa */}
              <div
                className="relative"
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  maxHeight: 380, minHeight: 240,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.url}
                  alt={active.prompt ?? 'Slide'}
                  style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }}
                />
                {/* Posición badge */}
                <span
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    fontSize: 11, fontWeight: 700, padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0,0,0,0.65)', color: '#fff',
                  }}
                >
                  {carouselDetail.activeIdx + 1} / {n}
                </span>
                {/* Flechas */}
                {n > 1 && (
                  <>
                    <button
                      onClick={goPrev}
                      aria-label="Anterior"
                      style={{
                        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <button
                      onClick={goNext}
                      aria-label="Siguiente"
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.55)', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails strip */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {carouselDetail.assets.map((a, idx) => {
                  const isActive = idx === carouselDetail.activeIdx
                  return (
                    <button
                      key={a.id}
                      onClick={() => setCarouselDetail(d => d ? { ...d, activeIdx: idx } : null)}
                      style={{
                        flexShrink: 0, width: 72, height: 72,
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                        padding: 0, cursor: 'pointer',
                        background: 'var(--surface-2)',
                        opacity: isActive ? 1 : 0.7,
                      }}
                      aria-label={`Slide ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={`Slide ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  )
                })}
              </div>

              {/* Prompt del slide activo */}
              <div>
                <span className="section-label block mb-1.5">
                  Prompt slide {carouselDetail.activeIdx + 1}
                </span>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                  {active.prompt ?? <em style={{ color: 'var(--ink-3)' }}>(Sin prompt)</em>}
                </p>
              </div>

              {/* Metadatos resumen */}
              <div
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  rowGap: 12, columnGap: 24, padding: 14,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <span className="section-label block mb-1">Slides</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{n}</span>
                </div>
                <div>
                  <span className="section-label block mb-1">Formato</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {active.aspect_ratio ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="section-label block mb-1">Aprobadas</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: allApproved ? 'var(--green-2)' : 'var(--ink-2)' }}>
                    {carouselDetail.assets.filter(a => a.approved).length} / {n}
                  </span>
                </div>
              </div>

              {/* Footer acciones */}
              <div
                className="flex items-center justify-between pt-2 flex-wrap gap-2"
                style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}
              >
                <div>
                  {carouselConfirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[12px]" style={{ color: 'var(--red-2)' }}>
                        ¿Eliminar carrusel completo ({n} imágenes)?
                      </span>
                      <button
                        className="btn-secondary"
                        onClick={() => setCarouselConfirmDelete(false)}
                        style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn-destructive"
                        onClick={handleDeleteCarousel}
                        style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                      >
                        <Trash2 size={11} aria-hidden="true" /> Sí, eliminar
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-pill-secondary"
                      onClick={() => setCarouselConfirmDelete(true)}
                      style={{ color: 'var(--red-2)' }}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Eliminar carrusel
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button className="btn-pill-secondary" onClick={() => handleDownload(active)}>
                    <Download size={13} aria-hidden="true" /> Descargar slide
                  </button>
                  <button
                    className={allApproved ? 'btn-secondary' : 'btn-cta'}
                    onClick={handleApproveAllCarousel}
                    disabled={allApproved}
                  >
                    <Check size={13} aria-hidden="true" />
                    {allApproved ? 'Aprobado completo' : 'Aprobar todo'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
