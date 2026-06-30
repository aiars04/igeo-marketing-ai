'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Sparkles, Loader2, RefreshCw, X, Check, ImagePlus, Layers, Grid3x3, Wand2, AlertCircle,
  Maximize2, Download, Languages, Upload, Film, FileText,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ImageBankPicker } from '@/components/pipeline/ImageBankPicker'
import type { Channel, ContentType } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageAsset {
  id: string
  url: string
  prompt: string | null
  aspect_ratio?: string | null
}

interface Props {
  itemId:           string
  itemTitle:        string
  channel:          Channel
  /** content_type_id del item (puede ser null para items históricos). Si viene,
   *  se usa para cargar el format_spec exacto en vez del "primero del canal". */
  contentTypeId?:   string | null
  /** Si el item es una réplica de otro mercado, contiene el id del item origen.
   *  Cuando viene !=null, se muestra el botón "Traducir imagen del original". */
  replicatedFrom?:  string | null
  assignedImageId:  string | null
  assignedImageUrl: string | null
  onAssigned:       (assetId: string, url: string) => void
  /** Callback para multi-asignación (carrusel desde el banco). Si el parent
   *  no lo provee, el modo selección múltiple queda oculto. */
  onMultiAssigned?: (assets: Array<{ id: string; url: string }>) => void
  onUnassigned:     () => void
}

const RATIOS = [
  { value: '1:1',  label: '1:1',  sub: 'Instagram · LinkedIn' },
  { value: '16:9', label: '16:9', sub: 'Blog · Banner'         },
  { value: '9:16', label: '9:16', sub: 'Stories · Reels'       },
  { value: '4:5',  label: '4:5',  sub: 'Feed Instagram'        },
] as const
type AspectRatio = typeof RATIOS[number]['value']
type GenMode = 'individual' | 'variants' | 'curated'

const MODES: { value: GenMode; label: string; sub: string; icon: typeof Sparkles }[] = [
  { value: 'individual', label: 'Individual', sub: '1 prompt · 1 imagen',           icon: Wand2     },
  { value: 'variants',   label: 'Variantes',  sub: '1 prompt · 2-4 variantes',      icon: Layers    },
  { value: 'curated',    label: 'Curado',     sub: '2-4 prompts · 2-4 imágenes',    icon: Grid3x3   },
]

/**
 * Detecta si una URL apunta a un vídeo por su extensión.
 * Usado para renderizar <video> en vez de <img> cuando el asset asignado
 * al item es un vídeo subido por el usuario (asset_type='video' en BD).
 * Como `itemImageMap` solo guarda {id, url}, derivamos el tipo de la URL.
 */
function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  // El bucket Supabase preserva la extensión original (mp4/mov/webm),
  // y la URL pública ignora query strings.
  const path = url.split('?')[0].toLowerCase()
  return path.endsWith('.mp4') || path.endsWith('.mov') || path.endsWith('.webm')
}

/** Detecta PDFs por extensión (carruseles LinkedIn). */
function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.split('?')[0].toLowerCase().endsWith('.pdf')
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageDrivePanel({
  itemId, itemTitle, channel, contentTypeId, replicatedFrom, assignedImageId, assignedImageUrl, onAssigned, onMultiAssigned, onUnassigned,
}: Props) {
  // Inline panel state
  const [unassigning, setUnassigning] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // Generation modal state
  const [genModalOpen, setGenModalOpen] = useState(false)
  const [genMode, setGenMode]           = useState<GenMode>('individual')
  const [genCount, setGenCount]         = useState<2 | 3 | 4>(4)
  const [genPrompt, setGenPrompt]       = useState('')
  const [genPrompts, setGenPrompts]     = useState<string[]>(['', '', '', ''])
  const [aspectRatio, setAspectRatio]   = useState<AspectRatio>('1:1')
  // Ratio por slide (solo modo curated). Inicializa con 4 slots — el array
  // se trunca/extiende según genCount y se usa solo cuando genMode==='curated'.
  // Si el usuario no toca ninguno, se queda igual al aspectRatio global.
  const [perPromptRatios, setPerPromptRatios] = useState<AspectRatio[]>(['1:1', '1:1', '1:1', '1:1'])
  // Foto base opcional para image-to-image (solo en modo individual). Si
  // está presente, el endpoint la usa como punto de partida y la edita
  // siguiendo el prompt + plantillas. Útil para editar fotos reales de
  // eventos (añadir logo, ajustar marca, etc.).
  const [baseImage, setBaseImage] = useState<{ url: string; id: string } | null>(null)
  const [baseImageUploading, setBaseImageUploading] = useState(false)
  const [baseImageError, setBaseImageError] = useState<string | null>(null)
  // Token de generación: si el usuario cancela/reset mientras el upload está
  // en vuelo, incrementamos el token y descartamos respuestas viejas (sin
  // este guard, la respuesta vieja reasignaría baseImage tras el clear).
  const baseImageReqTokenRef = useRef(0)
  // Cuando el usuario cambia el ratio GLOBAL, propagarlo a todos los slots
  // de curated. Sin esto, el ratio global y los slots se desincronizan y se
  // generan imágenes en ratios que el usuario no eligió conscientemente.
  // Si después quiere personalizar slot a slot, lo hace en su selector.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerPromptRatios(prev => prev.map(() => aspectRatio))
  }, [aspectRatio])
  const [generating, setGenerating]     = useState(false)
  const [genProgress, setGenProgress]   = useState('')
  const [genError, setGenError]         = useState<string | null>(null)

  // Post-generation variants/curated selection
  const [variants, setVariants]         = useState<ImageAsset[] | null>(null)
  const [assigningId, setAssigningId]   = useState<string | null>(null)
  // Error de asignar/quitar imagen (panel principal, distinto de genError del modal)
  const [actionError, setActionError]   = useState<string | null>(null)

  // Bank picker: elegir imagen del banco existente o subir una nueva propia
  const [bankPickerOpen, setBankPickerOpen] = useState(false)

  // Estado del flujo "traducir imagen del original" (solo si replicatedFrom)
  const [translating, setTranslating] = useState(false)
  const [translateConfirm, setTranslateConfirm] = useState(false)

  // Estado del upload de vídeo (MP4/MOV/WebM hasta 100MB). Se asigna al
  // item tras subir, igual que una imagen. Postiz acepta video via
  // `upload-from-url` sin necesidad de cambios en publish.
  const [videoUploading, setVideoUploading] = useState(false)
  const videoReqTokenRef = useRef(0)

  // Plantillas usadas al generar el asset asignado (pill "Generada con X").
  // Se hidrata via dos fetch ligeros: asset → template_ids → nombres.
  const [usedTemplates, setUsedTemplates] = useState<Array<{ id: string; name: string; asset_role: string }>>([])
  const [usedTemplatesMissing, setUsedTemplatesMissing] = useState(0)
  useEffect(() => {
    if (!assignedImageId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsedTemplates([])
      setUsedTemplatesMissing(0)
      return
    }
    let cancelled = false
    fetch(`/api/images/${assignedImageId}`)
      .then(r => r.ok ? r.json() as Promise<{ template_ids?: string[] }> : Promise.resolve({ template_ids: [] as string[] }))
      .then((asset: { template_ids?: string[] }) => {
        if (cancelled) return
        const ids = Array.isArray(asset.template_ids) ? asset.template_ids : []
        if (ids.length === 0) {
          setUsedTemplates([]); setUsedTemplatesMissing(0); return
        }
        fetch(`/api/creative-templates?ids=${ids.join(',')}`)
          .then(r => r.ok ? r.json() as Promise<Array<{ id: string; name: string; asset_role: string }>> : Promise.resolve([]))
          .then(found => {
            if (cancelled) return
            setUsedTemplates(found)
            setUsedTemplatesMissing(Math.max(0, ids.length - found.length))
          })
          .catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [assignedImageId])

  // Format spec del content_type del item — muestra el checklist informativo
  // de qué imágenes espera este formato y permite autoseleccionar ratio/count
  // en el modal de generación.
  //
  // Si el item tiene content_type_id explícito (migración 026) → ese.
  // Si no → fallback "primero activo del canal" para items históricos.
  const [formatSpec, setFormatSpec] = useState<ContentType['format_spec'] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/content-types?channel=${channel}&active=true`)
      .then(r => r.ok ? r.json() as Promise<ContentType[]> : Promise.resolve([]))
      .then(list => {
        if (cancelled) return
        const exact = contentTypeId
          ? (list.find(ct => ct.id === contentTypeId) ?? null)
          : null
        setFormatSpec((exact ?? list[0])?.format_spec ?? null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [channel, contentTypeId])

  // Aspect ratio estándar más cercano a unas dimensiones libres (w/h del
  // format_spec.carousel). Si el content_type define p.ej. 1080×1350 (Instagram
  // feed retrato), elegimos 4:5 automáticamente. Si no hay dimensiones, '1:1'.
  const ratioFromDims = (w: number | null | undefined, h: number | null | undefined): AspectRatio => {
    if (!w || !h) return '1:1'
    const target = w / h
    const candidates: { value: AspectRatio; ratio: number }[] = [
      { value: '1:1',  ratio: 1     },
      { value: '16:9', ratio: 16/9  },
      { value: '9:16', ratio: 9/16  },
      { value: '4:5',  ratio: 4/5   },
    ]
    return candidates.reduce((best, c) =>
      Math.abs(c.ratio - target) < Math.abs(best.ratio - target) ? c : best,
    candidates[0]).value
  }

  // ── Reset modal cuando se abre ───────────────────────────────────────────
  const openGenerate = useCallback(() => {
    // Defaults inteligentes basados en format_spec del content_type:
    //   - carousel definido → modo 'variants', count = carousel.min (clamp 2-4),
    //     aspect ratio derivado de carousel.width/height.
    //   - sin carousel        → modo 'individual', count 4, ratio '1:1'.
    const car = formatSpec?.carousel
    if (car) {
      // Clamp a 2|3|4 (el tipo de setGenCount). Si carousel.min está fuera de
      // rango usamos el extremo más cercano.
      const raw = car.min ?? 2
      const count: 2 | 3 | 4 = raw <= 2 ? 2 : raw >= 4 ? 4 : 3
      const ratio = ratioFromDims(car.width, car.height)
      setGenMode('variants')
      setGenCount(count)
      setGenPrompt(itemTitle)
      setGenPrompts(['', '', '', ''])
      setAspectRatio(ratio)
      // En curated, cada slide arranca con el ratio sugerido por el formato.
      setPerPromptRatios([ratio, ratio, ratio, ratio])
    } else {
      setGenMode('individual')
      setGenCount(4)
      setGenPrompt(itemTitle)
      setGenPrompts(['', '', '', ''])
      setAspectRatio('1:1')
      setPerPromptRatios(['1:1', '1:1', '1:1', '1:1'])
    }
    setGenError(null)
    setGenProgress('')
    setVariants(null)
    setBaseImage(null)
    setBaseImageError(null)
    setGenModalOpen(true)
  }, [itemTitle, formatSpec])

  const closeGenerate = useCallback(() => {
    if (generating) return
    setGenModalOpen(false)
    setVariants(null)
    setConfirmRegen(false)
  }, [generating])

  // ── Asignar una imagen al content_item ───────────────────────────────────
  const assignAsset = useCallback(async (assetId: string, url: string) => {
    setAssigningId(assetId)
    setActionError(null)
    try {
      // Desasignar la previa si era distinta. Si falla no bloqueamos la nueva
      // asignación, pero sí lo registramos en consola (antes se tragaba en silencio).
      if (assignedImageId && assignedImageId !== assetId) {
        await fetch(`/api/images/${assignedImageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_item_id: null }),
        }).catch((e) => { console.warn('[ImageDrivePanel] no se pudo desasignar la imagen previa:', e) })
      }
      const res = await fetch(`/api/images/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: itemId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setActionError(`No se pudo asignar la imagen: ${j.error ?? `HTTP ${res.status}`}`)
        return
      }
      onAssigned(assetId, url)
    } catch (e) {
      setActionError(e instanceof Error ? `No se pudo asignar la imagen: ${e.message}` : 'No se pudo asignar la imagen')
    } finally {
      setAssigningId(null)
    }
  }, [assignedImageId, itemId, onAssigned])

  // Picker del banco: cuando elige imagen → asignar al item y cerrar el modal
  const handleBankSelected = useCallback(async (assetId: string, url: string) => {
    await assignAsset(assetId, url)
    setBankPickerOpen(false)
  }, [assignAsset])

  // Picker del banco modo MÚLTIPLE: bulk-assign al item como carrusel.
  // El endpoint genera un carousel_id común y posiciona los assets 0..N-1
  // en el orden recibido. Luego notificamos al parent con el array completo
  // para que actualice el itemImageMap.
  const handleBankMultiSelected = useCallback(async (selectedAssets: Array<{ id: string; url: string }>) => {
    if (selectedAssets.length === 0) return
    setActionError(null)
    try {
      const res = await fetch('/api/images/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedAssets.map(a => a.id),
          content_item_id: itemId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setActionError(`No se pudieron asignar las imágenes: ${j.detail ?? j.error ?? `HTTP ${res.status}`}`)
        return
      }
      // Notificar al parent con todos los assets en orden de click. Si el
      // parent no provee onMultiAssigned, fallback a onAssigned con el primero
      // para no romper compat (el state quedaría con 1 imagen visible pero
      // las demás están en BD).
      if (onMultiAssigned) onMultiAssigned(selectedAssets)
      else onAssigned(selectedAssets[0].id, selectedAssets[0].url)
      setBankPickerOpen(false)
    } catch (e) {
      setActionError(e instanceof Error ? `Asignación fallida: ${e.message}` : 'Asignación fallida')
    }
  }, [itemId, onAssigned, onMultiAssigned])

  // ── Quitar imagen asignada ───────────────────────────────────────────────
  const handleUnassign = useCallback(async () => {
    if (!assignedImageId) return
    setUnassigning(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/images/${assignedImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: null }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setActionError(`No se pudo quitar la imagen: ${j.error ?? `HTTP ${res.status}`}`)
        return
      }
      onUnassigned()
    } catch (e) {
      setActionError(e instanceof Error ? `No se pudo quitar la imagen: ${e.message}` : 'No se pudo quitar la imagen')
    } finally {
      setUnassigning(false)
    }
  }, [assignedImageId, onUnassigned])

  // ── Subir foto base para image-to-image (modo individual) ──────────────
  // Sube la foto al endpoint /api/images/upload, que la guarda en el bucket
  // 'content-assets' y devuelve url pública. Esa URL la pasamos al endpoint
  // /api/images/generate como baseImageUrl para que Nano Banana la edite.
  const handleBaseImageUpload = useCallback(async (file: File) => {
    // Token único por petición. Si el usuario cancela/reset durante el
    // upload, baseImageReqTokenRef.current cambia; al volver la respuesta,
    // la descartamos.
    baseImageReqTokenRef.current += 1
    const myToken = baseImageReqTokenRef.current
    setBaseImageError(null)
    setBaseImageUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('channel', channel)
      const res = await fetch('/api/images/upload', { method: 'POST', body: fd })
      if (myToken !== baseImageReqTokenRef.current) return  // cancelado
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setBaseImageError(`No se pudo subir la foto: ${j.error ?? `HTTP ${res.status}`}`)
        return
      }
      const data = await res.json() as { id: string; url: string }
      if (myToken !== baseImageReqTokenRef.current) return  // cancelado entre llegada y parse
      setBaseImage({ id: data.id, url: data.url })
    } catch (e) {
      if (myToken !== baseImageReqTokenRef.current) return
      setBaseImageError(e instanceof Error ? `Subida fallida: ${e.message}` : 'Subida fallida')
    } finally {
      if (myToken === baseImageReqTokenRef.current) setBaseImageUploading(false)
    }
  }, [channel])

  const clearBaseImage = useCallback(() => {
    // Invalida el upload en curso (si lo hay) incrementando el token.
    baseImageReqTokenRef.current += 1
    setBaseImage(null)
    setBaseImageError(null)
    setBaseImageUploading(false)
  }, [])

  // ── Subir vídeo pregrabado (MP4/MOV/WebM) y asignarlo al item ──────────
  // Flujo en 3 pasos para SALTAR el límite de body de Vercel (~4.5 MB en
  // serverless functions). Sin este patrón, vídeos reales (>5 MB) fallaban
  // con un 413 opaco antes de llegar al endpoint:
  //
  //   1. POST /api/videos/sign-upload → URL firmada de Supabase Storage.
  //   2. PUT del archivo DIRECTAMENTE al bucket (browser → Supabase, no pasa
  //      por la función serverless, así que no aplica el límite de Vercel).
  //   3. POST /api/videos/register → crea content_asset y vincula al item.
  //
  // Tope efectivo: el límite del bucket Supabase (50 MB por defecto, hasta
  // 5 GB con plan Pro). Mucho más que el modelo serverless.
  const handleVideoUpload = useCallback(async (file: File) => {
    videoReqTokenRef.current += 1
    const myToken = videoReqTokenRef.current
    setActionError(null)
    setVideoUploading(true)
    try {
      // Validación temprana cliente: MIME y tamaño. Sin el chequeo de tamaño,
      // un vídeo de 200 MB iba a empezar a subir, gastar tiempo y fallar al
      // final con un error opaco del bucket. Mejor cortar antes.
      const ALLOWED = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
      if (!ALLOWED.has(file.type)) {
        setActionError(`Formato no soportado (${file.type || 'desconocido'}). Usa MP4, MOV o WebM.`)
        return
      }
      const MAX_BYTES = 50 * 1024 * 1024
      if (file.size > MAX_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1)
        setActionError(`El vídeo pesa ${mb} MB. El límite es 50 MB; reduce la duración o la resolución.`)
        return
      }

      // 1. Pedir URL firmada al backend
      const signRes = await fetch('/api/videos/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (myToken !== videoReqTokenRef.current) return
      if (!signRes.ok) {
        const j = await signRes.json().catch(() => ({}))
        setActionError(`No se pudo iniciar la subida: ${j.detail ?? j.error ?? `HTTP ${signRes.status}`}`)
        return
      }
      const { path, signedUrl } = await signRes.json() as { path: string; token: string; signedUrl: string }

      // 2. PUT directo del archivo al bucket — sin pasar por Vercel
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      })
      if (myToken !== videoReqTokenRef.current) return
      if (!putRes.ok) {
        setActionError(`Subida directa falló (HTTP ${putRes.status}). Reintenta o usa un vídeo más pequeño.`)
        return
      }

      // 3. Registrar el asset en la BD
      const regRes = await fetch('/api/videos/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, mime_type: file.type, channel, content_item_id: itemId }),
      })
      if (myToken !== videoReqTokenRef.current) return
      if (!regRes.ok) {
        const j = await regRes.json().catch(() => ({}))
        setActionError(`No se pudo registrar el vídeo: ${j.detail ?? j.error ?? `HTTP ${regRes.status}`}`)
        return
      }
      const data = await regRes.json() as { id: string; url: string }
      // assignAsset desvincula la imagen/vídeo previo del item (si lo había)
      // y re-vincula este. Mismo flujo que "Cambiar del banco".
      await assignAsset(data.id, data.url)
    } catch (e) {
      if (myToken !== videoReqTokenRef.current) return
      setActionError(e instanceof Error ? `Subida fallida: ${e.message}` : 'Subida fallida')
    } finally {
      if (myToken === videoReqTokenRef.current) setVideoUploading(false)
    }
  }, [channel, itemId, assignAsset])

  // ── Traducir imagen del item original (solo réplicas) ──────────────────
  // Genera una imagen idéntica a la del item origen pero con el texto
  // traducido al idioma del mercado destino. El endpoint hace toda la
  // mecánica: lee la imagen del source, llama Nano Banana con el original
  // como ref visual y prompt de traducción, crea el asset vinculado a este
  // item. Aquí solo asignamos la nueva imagen al item (sobrescribiendo la
  // anterior si la había).
  const handleTranslateFromOriginal = useCallback(async () => {
    if (!replicatedFrom) return
    setTranslating(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/content-items/${itemId}/translate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setActionError(j.detail ?? `No se pudo traducir la imagen: ${j.error ?? `HTTP ${res.status}`}`)
        return
      }
      const data = await res.json() as { id: string; url: string }
      // Desasignar la imagen anterior (si la había) y asignar la nueva.
      // `assignAsset` ya cubre ambos pasos, pero el endpoint translate-image
      // ya vincula el asset con content_item_id directamente — solo
      // necesitamos avisar al parent vía onAssigned.
      onAssigned(data.id, data.url)
      setTranslateConfirm(false)
    } catch (e) {
      setActionError(e instanceof Error ? `No se pudo traducir la imagen: ${e.message}` : 'No se pudo traducir la imagen')
    } finally {
      setTranslating(false)
    }
  }, [replicatedFrom, itemId, onAssigned])

  // ── Generar con retry + backoff exponencial ────────────────────────────
  // Backoff progresivo en segundos entre intentos: 0s, 4s, 10s, 20s, 35s
  const handleGenerate = useCallback(async () => {
    setGenError(null)
    setVariants(null)
    setGenerating(true)

    const MAX_ATTEMPTS = 5
    const BACKOFF_SECONDS = [0, 4, 10, 20, 35] // espera antes de cada intento (idx 0 = primer intento sin espera)

    // Detecta errores transitorios: 5xx + 429 (rate limit) + 500 (puede venir del SDK Gemini)
    // También detecta el texto 'unavailable' / 'quota' / 'exhausted' del mensaje del backend
    const isTransient = (status: number, errorText: string) => {
      if (status === 504 || status === 502 || status === 408 || status === 503 || status === 429 || status === 500) return true
      const msg = (errorText || '').toLowerCase()
      return msg.includes('unavailable') || msg.includes('quota') || msg.includes('exhausted') ||
             msg.includes('saturated') || msg.includes('overloaded') || msg.includes('rate')
    }

    const sleep = (s: number) => new Promise(r => setTimeout(r, s * 1000))

    const countdownProgress = async (seconds: number, attempt: number, maxAttempts: number) => {
      for (let s = seconds; s > 0; s--) {
        setGenProgress(`Esperando ${s}s antes del reintento ${attempt} de ${maxAttempts}…`)
        await sleep(1)
      }
    }

    try {
      if (genMode === 'individual') {
        const promptFinal = (genPrompt.trim() || itemTitle).trim()
        if (!promptFinal) { setGenError('Escribe un prompt o un título'); return }

        let lastError = ''
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          // Backoff antes de reintentar (excepto el primero)
          const wait = BACKOFF_SECONDS[attempt - 1] ?? 35
          if (wait > 0) await countdownProgress(wait, attempt, MAX_ATTEMPTS)

          setGenProgress(
            attempt === 1
              ? 'Generando con Nano Banana 2…'
              : `Reintento ${attempt} de ${MAX_ATTEMPTS}…`,
          )
          const res = await fetch('/api/images/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // content_item_id activa la inyección de plantillas maestras como
            // referencia visual (Fase 2 de Creativos digitales).
            // baseImageUrl (opcional) habilita image-to-image: Nano Banana
            // edita la foto subida aplicando prompt + plantillas.
            body: JSON.stringify({
              prompt: promptFinal,
              aspectRatio,
              channel,
              content_item_id: itemId,
              ...(baseImage ? { baseImageUrl: baseImage.url } : {}),
            }),
          })
          if (res.ok) {
            const data = await res.json() as { id: string; url: string }
            await assignAsset(data.id, data.url)
            setGenModalOpen(false)
            return
          }
          const j = await res.json().catch(() => ({})) as { error?: string; detail?: string }
          lastError = j.error ?? `HTTP ${res.status}`
          // Errores específicos de la foto base NO son transitorios aunque
          // su status sea 502 o el mensaje contenga 'unavailable'. Sin este
          // short-circuit, el bucle reintentaría 5 veces inútilmente y al
          // final mostraría 'Nano Banana saturado' en vez del `detail` real.
          if (lastError.startsWith('base_image_')) {
            setGenError(j.detail ?? 'No se pudo usar la foto base. Quítala o sube otra.')
            return
          }
          if (!isTransient(res.status, lastError)) {
            // Error definitivo no relacionado con la foto base: si viene
            // `detail` en español, mostrarlo; sino el genérico.
            if (j.detail) {
              setGenError(j.detail)
              return
            }
            break
          }
        }
        setGenError(`Nano Banana 2 está saturado (${lastError}). Espera unos segundos y vuelve a intentarlo.`)
        return

      } else if (genMode === 'variants') {
        const promptFinal = (genPrompt.trim() || itemTitle).trim()
        if (!promptFinal) { setGenError('Escribe un prompt o un título'); return }

        let lastError = ''
        let lastDetail: string | null = null
        let assets: ImageAsset[] | null = null
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const wait = BACKOFF_SECONDS[attempt - 1] ?? 35
          if (wait > 0) await countdownProgress(wait, attempt, MAX_ATTEMPTS)

          setGenProgress(
            attempt === 1
              ? `Generando ${genCount} variantes…`
              : `Reintento ${attempt} de ${MAX_ATTEMPTS}…`,
          )
          const res = await fetch('/api/images/carousel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'variants',
              prompts: [promptFinal],
              count: genCount,
              aspectRatio,
              channel,
            }),
          })
          if (res.ok) {
            const data = await res.json() as { assets: ImageAsset[] }
            assets = data.assets
            break
          }
          const j = await res.json().catch(() => ({})) as { error?: string; detail?: string }
          lastError = j.error ?? `HTTP ${res.status}`
          lastDetail = j.detail ?? null
          if (!isTransient(res.status, lastError)) break
        }
        if (!assets) {
          const suffix = lastDetail ? `\n${lastDetail}` : ''
          setGenError(`No se pudo generar el carrusel (${lastError}). Espera unos segundos o prueba modo Individual.${suffix}`)
          return
        }
        setVariants(assets)

      } else {
        // curated
        const valid = genPrompts.slice(0, genCount).map(p => p.trim()).filter(Boolean)
        if (valid.length !== genCount) {
          setGenError(`Rellena los ${genCount} prompts`)
          return
        }
        // Ratio por slide: si alguno difiere del global, lo mandamos al backend;
        // si todos coinciden con el global, omitimos el campo (compat hacia atrás).
        const slidesRatios = perPromptRatios.slice(0, genCount)
        const sendPerSlide = slidesRatios.some(r => r !== aspectRatio)
        const res = await fetch('/api/images/carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'curated',
            prompts: valid,
            aspectRatio,
            channel,
            ...(sendPerSlide ? { aspectRatios: slidesRatios } : {}),
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string; detail?: string }
          const suffix = j.detail ? `\n${j.detail}` : ''
          if (res.status === 504 || res.status === 408 || res.status === 502) {
            setGenError(`Timeout en modo curado (4 imágenes pueden tardar >60s en Vercel free). Prueba con 2 prompts o usa modo Individual.${suffix}`)
          } else {
            setGenError(`${j.error ?? `HTTP ${res.status}`}${suffix}`)
          }
          return
        }
        const data = await res.json() as { assets: ImageAsset[] }
        setVariants(data.assets)
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error de generación')
    } finally {
      setGenerating(false)
      setGenProgress('')
    }
  }, [genMode, genPrompt, genPrompts, genCount, aspectRatio, perPromptRatios, baseImage, channel, itemTitle, itemId, assignAsset])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Estado: imagen ya asignada
  // ═══════════════════════════════════════════════════════════════════════

  // Banner informativo: qué imágenes espera este formato según el content_type.
  // Solo aparece si el content_type del canal tiene format_spec.images o carousel definidos.
  const expectedImages = formatSpec?.images ?? []
  const expectedCarousel = formatSpec?.carousel ?? null
  const hasFormatExpectations = expectedImages.length > 0 || !!expectedCarousel
  const checklistBanner = hasFormatExpectations ? (
    <div
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ImagePlus size={12} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
        <span style={{
          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--accent-2)',
        }}>
          Este formato espera
        </span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {expectedImages.map((img, i) => {
          const dims = img.width && img.height ? ` · ${img.width}×${img.height}` : ''
          const req = img.required ? '' : ' (opcional)'
          return (
            <li key={i} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              <strong style={{ color: 'var(--ink)' }}>{img.label}</strong>{dims}{req}
              {img.notes && <span style={{ color: 'var(--ink-3)' }}> — {img.notes}</span>}
            </li>
          )
        })}
        {expectedCarousel && (
          <li style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink)' }}>Carrusel</strong>
            {' '}({expectedCarousel.min}–{expectedCarousel.max} slides
            {expectedCarousel.width && expectedCarousel.height
              ? ` · ${expectedCarousel.width}×${expectedCarousel.height}`
              : ''})
          </li>
        )}
      </ul>
    </div>
  ) : null

  if (assignedImageUrl) {
    return (
      <div className="flex flex-col gap-2">
        {checklistBanner}
        {/* Preview: contain para ver imagen completa + click para ampliar */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="relative group"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            padding: 0,
            cursor: 'zoom-in',
            overflow: 'hidden',
            width: '100%',
          }}
          aria-label="Ampliar imagen"
        >
          {isVideoUrl(assignedImageUrl) ? (
            <video
              src={assignedImageUrl}
              controls
              preload="metadata"
              style={{
                width: '100%',
                maxHeight: 420,
                minHeight: 200,
                objectFit: 'contain',
                display: 'block',
                background: 'var(--surface-2)',
              }}
            />
          ) : isPdfUrl(assignedImageUrl) ? (
            <div
              style={{
                width: '100%',
                minHeight: 200,
                maxHeight: 420,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8,
                background: '#0f172a',
                color: '#94a3b8',
                padding: 24,
              }}
              title="Documento PDF (carrusel LinkedIn)"
            >
              <FileText size={48} aria-hidden="true" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>PDF</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>Pulsa para abrir en pestaña nueva</span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={assignedImageUrl}
              alt="Visual generado"
              style={{
                width: '100%',
                maxHeight: 420,
                minHeight: 200,
                objectFit: 'contain',
                display: 'block',
                background: 'var(--surface-2)',
              }}
            />
          )}
          {/* Hover overlay con icono ampliar */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
            style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }}
          >
            <div
              className="flex items-center gap-1.5"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(255,255,255,0.95)',
                color: 'var(--ink)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Maximize2 size={12} aria-hidden="true" /> Ver tamaño completo
            </div>
          </div>
        </button>

        {/* Pill de trazabilidad: plantillas maestras usadas al generar el asset.
            Se hidrata vía useEffect cuando cambia assignedImageId. */}
        {(usedTemplates.length > 0 || usedTemplatesMissing > 0) && (
          <div
            className="flex items-center flex-wrap"
            style={{ gap: 6, marginTop: -4 }}
            title={usedTemplates.map(t => `${t.asset_role}: ${t.name}`).join('\n')}
          >
            <span
              className="inline-flex items-center"
              style={{
                gap: 5,
                height: 22,
                padding: '0 9px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                color: 'var(--accent-2)',
                lineHeight: 1,
              }}
            >
              <Sparkles size={11} aria-hidden="true" />
              Generada con {usedTemplates.length === 1
                ? usedTemplates[0].name
                : `${usedTemplates.length} plantilla${usedTemplates.length === 1 ? '' : 's'}`}
              {usedTemplatesMissing > 0 && (
                <span style={{ opacity: 0.7, fontWeight: 500 }}>
                  {' '}({usedTemplatesMissing} eliminada{usedTemplatesMissing === 1 ? '' : 's'})
                </span>
              )}
            </span>
            {usedTemplates.length > 1 && usedTemplates.slice(1, 4).map(t => (
              <span
                key={t.id}
                style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink-2)',
                  lineHeight: 1.4,
                }}
                title={`${t.asset_role}: ${t.name}`}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Lightbox a tamaño completo */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.85)', padding: 24 }}
            onClick={() => setLightboxOpen(false)}
            role="dialog"
            aria-label="Vista completa de la imagen"
          >
            {isVideoUrl(assignedImageUrl) ? (
              <video
                src={assignedImageUrl}
                controls
                autoPlay
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  background: '#000',
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={assignedImageUrl}
                alt="Visual generado (tamaño completo)"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
                onClick={e => e.stopPropagation()}
              />
            )}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 flex items-center justify-center transition-colors"
              style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Cerrar"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <a
              href={assignedImageUrl}
              download
              onClick={e => e.stopPropagation()}
              className="absolute top-4 right-16 inline-flex items-center gap-1.5 transition-colors"
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Download size={12} aria-hidden="true" /> Descargar
            </a>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            {confirmRegen ? (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, color: 'var(--red-2)' }}>
                  ¿Generar una nueva imagen?
                </span>
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmRegen(false)}
                  style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-destructive"
                  onClick={() => { setConfirmRegen(false); openGenerate() }}
                  style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                >
                  <RefreshCw size={11} aria-hidden="true" /> Sí, abrir editor
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="btn-pill-secondary"
                  onClick={() => setConfirmRegen(true)}
                  disabled={unassigning || translating || videoUploading}
                >
                  <RefreshCw size={12} aria-hidden="true" /> Regenerar
                </button>
                <button
                  className="btn-pill-secondary"
                  onClick={() => setBankPickerOpen(true)}
                  disabled={unassigning || translating || videoUploading}
                >
                  <ImagePlus size={12} aria-hidden="true" /> Cambiar del banco
                </button>
                <label
                  className="btn-pill-secondary"
                  style={{
                    cursor: (videoUploading || unassigning || translating) ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    opacity: (unassigning || translating) ? 0.5 : 1,
                  }}
                  title="Sustituye el visual por un vídeo (MP4/MOV/WebM hasta 50 MB)"
                >
                  {videoUploading
                    ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                    : <Film size={12} aria-hidden="true" />}
                  {videoUploading ? 'Subiendo…' : 'Subir vídeo'}
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleVideoUpload(f)
                      e.target.value = ''
                    }}
                    disabled={videoUploading || unassigning || translating}
                    style={{ display: 'none' }}
                  />
                </label>
                {replicatedFrom && !translateConfirm && (
                  <button
                    className="btn-pill-secondary"
                    onClick={() => setTranslateConfirm(true)}
                    disabled={unassigning || translating}
                    title="Sustituye la imagen actual por la del item original con el texto traducido"
                  >
                    <Languages size={12} aria-hidden="true" /> Traducir del original
                  </button>
                )}
                {replicatedFrom && translateConfirm && (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: 'var(--red-2)' }}>
                      ¿Sustituir la imagen actual?
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => setTranslateConfirm(false)}
                      disabled={translating}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn-destructive"
                      onClick={handleTranslateFromOriginal}
                      disabled={translating}
                      style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                    >
                      {translating
                        ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                        : <Languages size={11} aria-hidden="true" />}
                      {translating ? 'Traduciendo…' : 'Sí, traducir'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleUnassign}
            disabled={unassigning}
            className="inline-flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12, fontWeight: 500, color: 'var(--ink-3)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
            }}
          >
            {unassigning ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
            {isVideoUrl(assignedImageUrl)
              ? 'Quitar vídeo'
              : isPdfUrl(assignedImageUrl)
                ? 'Quitar PDF'
                : 'Quitar imagen'}
          </button>
        </div>

        {actionError && (
          <p style={{ fontSize: 12, color: 'var(--red-2)', marginTop: 8 }}>{actionError}</p>
        )}

        {/* Modal de generación (regenerar) */}
        <GenerationModal
          open={genModalOpen}
          onClose={closeGenerate}
          genMode={genMode} setGenMode={setGenMode}
          genCount={genCount} setGenCount={setGenCount}
          genPrompt={genPrompt} setGenPrompt={setGenPrompt}
          genPrompts={genPrompts} setGenPrompts={setGenPrompts}
          aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
          perPromptRatios={perPromptRatios} setPerPromptRatios={setPerPromptRatios}
          baseImage={baseImage}
          baseImageUploading={baseImageUploading}
          baseImageError={baseImageError}
          onBaseImageUpload={handleBaseImageUpload}
          onClearBaseImage={clearBaseImage}
          generating={generating}
          genProgress={genProgress}
          genError={genError}
          variants={variants}
          assigningId={assigningId}
          onGenerate={handleGenerate}
          onAssignVariant={assignAsset}
          onAfterAssign={() => setGenModalOpen(false)}
          itemTitle={itemTitle}
          isCarouselFormat={!!formatSpec?.carousel}
        />

        {/* Picker del banco — elegir o subir imagen propia */}
        <ImageBankPicker
          open={bankPickerOpen}
          onClose={() => setBankPickerOpen(false)}
          channel={channel}
          onSelected={handleBankSelected}
          onMultiSelected={handleBankMultiSelected}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Estado: sin imagen
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col items-start gap-2">
      {checklistBanner}
      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
        Genera el visual con todas las opciones: una imagen, varias variantes del mismo prompt, o un carrusel con prompts distintos.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn-cta" onClick={openGenerate}>
          <Sparkles size={13} aria-hidden="true" />
          Generar imagen con IA
        </button>
        <button className="btn-pill-secondary" onClick={() => setBankPickerOpen(true)}>
          <ImagePlus size={13} aria-hidden="true" />
          Elegir del banco
        </button>
        <label
          className="btn-pill-secondary"
          style={{ cursor: videoUploading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Sube un vídeo MP4/MOV/WebM hasta 50 MB. Se asignará a este item y se publicará junto al copy en Postiz."
        >
          {videoUploading
            ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            : <Film size={13} aria-hidden="true" />}
          {videoUploading ? 'Subiendo vídeo…' : 'Subir vídeo'}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleVideoUpload(f)
              e.target.value = ''
            }}
            disabled={videoUploading}
            style={{ display: 'none' }}
          />
        </label>
        {replicatedFrom && !translateConfirm && (
          <button
            className="btn-pill-secondary"
            onClick={() => setTranslateConfirm(true)}
            disabled={translating}
            title="Recrea la imagen del item original con el texto traducido al idioma de este mercado"
          >
            <Languages size={13} aria-hidden="true" />
            Traducir imagen del original
          </button>
        )}
        {replicatedFrom && translateConfirm && (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
              ¿Generar la imagen traducida del original?
            </span>
            <button
              className="btn-secondary"
              onClick={() => setTranslateConfirm(false)}
              disabled={translating}
              style={{ height: 28, fontSize: 11, padding: '0 10px' }}
            >
              Cancelar
            </button>
            <button
              className="btn-cta"
              onClick={handleTranslateFromOriginal}
              disabled={translating}
              style={{ height: 28, fontSize: 11, padding: '0 10px' }}
            >
              {translating
                ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                : <Languages size={11} aria-hidden="true" />}
              {translating ? 'Traduciendo…' : 'Sí, traducir'}
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        Nano Banana 2 para el canal <strong>{channel}</strong> · 4 ratios · 3 modos · o sube/elige una propia
      </p>
      {actionError && (
        <p style={{ fontSize: 12, color: 'var(--red-2)' }}>{actionError}</p>
      )}

      {/* Modal de generación */}
      <GenerationModal
        open={genModalOpen}
        onClose={closeGenerate}
        genMode={genMode} setGenMode={setGenMode}
        genCount={genCount} setGenCount={setGenCount}
        genPrompt={genPrompt} setGenPrompt={setGenPrompt}
        genPrompts={genPrompts} setGenPrompts={setGenPrompts}
        aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        perPromptRatios={perPromptRatios} setPerPromptRatios={setPerPromptRatios}
        baseImage={baseImage}
        baseImageUploading={baseImageUploading}
        baseImageError={baseImageError}
        onBaseImageUpload={handleBaseImageUpload}
        onClearBaseImage={clearBaseImage}
        generating={generating}
        genProgress={genProgress}
        genError={genError}
        variants={variants}
        assigningId={assigningId}
        onGenerate={handleGenerate}
        onAssignVariant={assignAsset}
        onAfterAssign={() => setGenModalOpen(false)}
        itemTitle={itemTitle}
        isCarouselFormat={!!formatSpec?.carousel}
      />

      {/* Picker del banco — elegir o subir imagen propia */}
      <ImageBankPicker
        open={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        channel={channel}
        onSelected={handleBankSelected}
        onMultiSelected={handleBankMultiSelected}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// GenerationModal
// ═══════════════════════════════════════════════════════════════════════════

interface GenModalProps {
  open: boolean
  onClose: () => void
  genMode: GenMode
  setGenMode: (m: GenMode) => void
  genCount: 2 | 3 | 4
  setGenCount: (c: 2 | 3 | 4) => void
  genPrompt: string
  setGenPrompt: (p: string) => void
  genPrompts: string[]
  setGenPrompts: (p: string[]) => void
  aspectRatio: AspectRatio
  setAspectRatio: (r: AspectRatio) => void
  /** Ratios por slide en modo curated. Length 4 (slots máximos). */
  perPromptRatios: AspectRatio[]
  setPerPromptRatios: (r: AspectRatio[]) => void
  /** Foto base subida por el usuario (modo individual, image-to-image). */
  baseImage: { id: string; url: string } | null
  baseImageUploading: boolean
  baseImageError: string | null
  onBaseImageUpload: (file: File) => void
  onClearBaseImage: () => void
  generating: boolean
  genProgress: string
  genError: string | null
  variants: ImageAsset[] | null
  assigningId: string | null
  onGenerate: () => void
  onAssignVariant: (id: string, url: string) => Promise<void>
  onAfterAssign: () => void
  itemTitle: string
  /** Si true, el content_type del item es un carrusel: deshabilita el modo
   *  Individual (un carrusel necesita N imágenes separadas) y avisa con hint. */
  isCarouselFormat?: boolean
}

function GenerationModal({
  open, onClose, genMode, setGenMode, genCount, setGenCount,
  genPrompt, setGenPrompt, genPrompts, setGenPrompts,
  aspectRatio, setAspectRatio, perPromptRatios, setPerPromptRatios,
  baseImage, baseImageUploading, baseImageError, onBaseImageUpload, onClearBaseImage,
  generating, genProgress, genError,
  variants, assigningId, onGenerate, onAssignVariant, onAfterAssign, itemTitle,
  isCarouselFormat = false,
}: GenModalProps) {

  // Si hay variantes/curated, mostrar selector de imagen
  if (variants && variants.length > 0) {
    return (
      <Modal open={open} onClose={onClose} title="Elige la imagen para este post" size="lg">
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            {variants.length} imágenes generadas. Selecciona la que quieres asignar a este post — las demás se guardan en la biblioteca.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: variants.length === 2 ? '1fr 1fr' : 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            {variants.map(v => {
              const isLoading = assigningId === v.id
              return (
                <button
                  key={v.id}
                  onClick={async () => {
                    await onAssignVariant(v.id, v.url)
                    onAfterAssign()
                  }}
                  disabled={!!assigningId}
                  className="relative overflow-hidden transition-all"
                  style={{
                    aspectRatio: aspectRatio.replace(':', '/'),
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid transparent',
                    background: 'var(--surface-2)',
                    padding: 0,
                    cursor: assigningId ? 'wait' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!assigningId) e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent' }}
                  aria-label={`Asignar variante ${v.prompt ?? ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.url}
                    alt={v.prompt ?? 'variante'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {isLoading && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{ background: 'rgba(0,0,0,0.55)' }}
                    >
                      <Loader2 size={20} className="animate-spin" style={{ color: '#fff' }} aria-hidden="true" />
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Asignando…</span>
                    </div>
                  )}
                  {!isLoading && (
                    <div
                      className="absolute bottom-2 right-2 flex items-center justify-center"
                      style={{
                        width: 28, height: 28,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.9)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Check size={14} aria-hidden="true" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Las imágenes están disponibles en la pestaña Imágenes con prompt y aspect ratio guardados.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar imagen" size="lg">
      <div className="flex flex-col gap-4">

        {/* Loading state ocupa todo el modal cuando está generando */}
        {generating ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-2)' }} aria-hidden="true" />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              {genProgress || 'Generando con Nano Banana 2…'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {genMode === 'curated'
                ? 'Generación secuencial — entre 15 y 40 segundos.'
                : 'Entre 3 y 8 segundos.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Selector de modo ─────────────────────────────────────── */}
            <div>
              <p className="section-label" style={{ marginBottom: 8 }}>Modo de generación</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                }}
              >
                {MODES.map(m => {
                  const Icon = m.icon
                  const active = genMode === m.value
                  // Individual deshabilitado para formatos carrusel: 1 imagen no
                  // sirve para un carrusel de N slides. Antes esto causaba que
                  // Gemini "interpretase" el prompt y devolviese una imagen
                  // dividida en 4 viñetas en vez de 4 imágenes separadas
                  // (bug reportado por Ramon 2026-06-23).
                  const disabled = isCarouselFormat && m.value === 'individual'
                  return (
                    <button
                      key={m.value}
                      onClick={() => { if (!disabled) setGenMode(m.value) }}
                      disabled={disabled}
                      title={disabled
                        ? 'No disponible: este formato es un carrusel; usa Variantes o Curado para generar N imágenes separadas.'
                        : m.sub}
                      className="flex flex-col items-start transition-all"
                      style={{
                        padding: 12,
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        gap: 4,
                        opacity: disabled ? 0.45 : 1,
                      }}
                    >
                      <Icon size={14} aria-hidden="true" style={{ color: active ? 'var(--accent)' : 'var(--ink-2)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--ink)' }}>
                        {m.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.3 }}>
                        {m.sub}
                      </span>
                    </button>
                  )
                })}
              </div>
              {isCarouselFormat && (
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.4 }}>
                  Este formato es un <strong>carrusel</strong>: necesita N imágenes separadas (una por slide).
                  Usa <strong>Variantes</strong> (mismo prompt) o <strong>Curado</strong> (1 prompt por slide).
                </p>
              )}
            </div>

            {/* ── Count (variants/curated) ─────────────────────────────── */}
            {genMode !== 'individual' && (
              <div>
                <p className="section-label" style={{ marginBottom: 8 }}>
                  {genMode === 'variants' ? 'Número de variantes' : 'Número de slides'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([2, 3, 4] as const).map(n => {
                    const active = genCount === n
                    return (
                      <button
                        key={n}
                        onClick={() => setGenCount(n)}
                        className="transition-all"
                        style={{
                          flex: 1,
                          height: 36,
                          fontSize: 13, fontWeight: 700,
                          background: active ? 'var(--accent)' : 'var(--surface-2)',
                          color: active ? '#fff' : 'var(--ink)',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Prompt(s) ────────────────────────────────────────────── */}
            {(genMode === 'individual' || genMode === 'variants') ? (
              <>
              <div>
                <p className="section-label" style={{ marginBottom: 8 }}>
                  Prompt {genMode === 'variants' ? '(se usará para todas las variantes)' : ''}
                </p>
                <textarea
                  value={genPrompt}
                  onChange={e => setGenPrompt(e.target.value)}
                  placeholder={`Describe la imagen… (si dejas vacío usa: "${itemTitle}")`}
                  rows={3}
                  className="input w-full"
                  style={{ minHeight: 80, fontSize: 13, padding: 12, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* Foto base opcional (solo modo Individual). Si se sube, Nano
                  Banana hará image-to-image: editar la foto aplicando prompt +
                  plantillas (ideal para fotos de eventos a las que añadir
                  logo/branding sin re-generar desde cero). */}
              {genMode === 'individual' && (
                <div>
                  <p className="section-label" style={{ marginBottom: 8 }}>
                    Foto base (opcional)
                  </p>
                  {baseImage ? (
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: 10,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--accent)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={baseImage.url}
                        alt="Foto base"
                        style={{
                          width: 56, height: 56, objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)', flexShrink: 0,
                          border: '1px solid var(--border)',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                          Foto base cargada
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.3 }}>
                          Nano Banana 2 la usará como punto de partida y aplicará el prompt + plantillas encima.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onClearBaseImage}
                        title="Quitar foto base"
                        aria-label="Quitar foto base"
                        style={{
                          width: 28, height: 28, flexShrink: 0,
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--ink-2)',
                        }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <label
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '14px 12px',
                        border: '1px dashed var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-2)',
                        cursor: baseImageUploading ? 'wait' : 'pointer',
                        color: 'var(--ink-2)',
                        fontSize: 12, fontWeight: 500,
                      }}
                    >
                      {baseImageUploading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                          Subiendo foto…
                        </>
                      ) : (
                        <>
                          <Upload size={14} aria-hidden="true" />
                          Subir foto de evento (PNG, JPG, WebP — max 10 MB)
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) onBaseImageUpload(f)
                          // Permite re-seleccionar el mismo archivo tras un clear
                          e.target.value = ''
                        }}
                        disabled={baseImageUploading}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                  {baseImageError && (
                    <p style={{ fontSize: 11, color: 'var(--red-2)', marginTop: 6 }}>
                      {baseImageError}
                    </p>
                  )}
                  <p style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.4 }}>
                    Si subes una foto, el modelo la editará en lugar de generar desde cero. Útil para añadir logo / marca a fotos reales de eventos.
                  </p>
                </div>
              )}
              </>
            ) : (
              <div>
                <p className="section-label" style={{ marginBottom: 8 }}>
                  Prompts ({genCount} slides distintos)
                </p>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: genCount }).map((_, i) => {
                    const slideRatio = perPromptRatios[i] ?? aspectRatio
                    const slideDims = i < perPromptRatios.length
                      ? (RATIOS.find(r => r.value === slideRatio)?.sub ?? '')
                      : ''
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div
                          className="shrink-0 flex items-center justify-center"
                          style={{
                            width: 28, height: 28,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            fontSize: 12, fontWeight: 700,
                            marginTop: 4,
                          }}
                        >
                          {i + 1}
                        </div>
                        <textarea
                          value={genPrompts[i] ?? ''}
                          onChange={e => {
                            const next = [...genPrompts]
                            next[i] = e.target.value
                            setGenPrompts(next)
                          }}
                          placeholder={`Slide ${i + 1}…`}
                          rows={2}
                          className="input flex-1"
                          style={{ minHeight: 56, fontSize: 13, padding: 10, fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        {/* Selector compacto de ratio por slide. Si no se toca,
                            usa el aspectRatio global. */}
                        <div className="shrink-0 flex flex-col items-stretch gap-1" style={{ marginTop: 4, width: 96 }}>
                          <select
                            value={slideRatio}
                            onChange={e => {
                              const next = [...perPromptRatios]
                              next[i] = e.target.value as AspectRatio
                              setPerPromptRatios(next)
                            }}
                            className="input"
                            style={{ height: 28, fontSize: 12, padding: '0 6px', fontFamily: 'inherit' }}
                            title="Formato de esta imagen"
                          >
                            {RATIOS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.2, textAlign: 'center' }}>
                            {slideDims}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Aspect ratio (en curated, cada slide tiene el suyo) ──── */}
            {genMode !== 'curated' && (
            <div>
              <p className="section-label" style={{ marginBottom: 8 }}>Formato</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}
              >
                {RATIOS.map(r => {
                  const active = aspectRatio === r.value
                  return (
                    <button
                      key={r.value}
                      onClick={() => setAspectRatio(r.value)}
                      className="flex flex-col items-center justify-center transition-all"
                      style={{
                        padding: '10px 8px',
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--ink)' }}>
                        {r.label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.2, textAlign: 'center' }}>
                        {r.sub}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            )}

            {/* Error */}
            {genError && (
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--red-soft)',
                  color: 'var(--red-2)',
                  fontSize: 12,
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                <AlertCircle size={13} aria-hidden="true" />
                {genError}
              </div>
            )}

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button onClick={onClose} className="btn-ghost">Cancelar</button>
              <button onClick={onGenerate} className="btn-cta">
                <Sparkles size={13} aria-hidden="true" />
                {genMode === 'individual' ? 'Generar imagen' : `Generar ${genCount} imágenes`}
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              <ImagePlus size={10} aria-hidden="true" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Nano Banana 2 (Gemini 3.1 Flash Image) con fallback a Imagen 4 si la cuota está saturada. Imágenes guardadas en biblioteca con prompt y ratio.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
