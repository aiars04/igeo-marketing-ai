'use client'

import { useState, useCallback } from 'react'
import {
  Sparkles, Loader2, RefreshCw, X, Check, ImagePlus, Layers, Grid3x3, Wand2, AlertCircle,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { Channel } from '@/types/database'

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
  assignedImageId:  string | null
  assignedImageUrl: string | null
  onAssigned:       (assetId: string, url: string) => void
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

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageDrivePanel({
  itemId, itemTitle, channel, assignedImageId, assignedImageUrl, onAssigned, onUnassigned,
}: Props) {
  // Inline panel state
  const [unassigning, setUnassigning] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  // Generation modal state
  const [genModalOpen, setGenModalOpen] = useState(false)
  const [genMode, setGenMode]           = useState<GenMode>('individual')
  const [genCount, setGenCount]         = useState<2 | 3 | 4>(4)
  const [genPrompt, setGenPrompt]       = useState('')
  const [genPrompts, setGenPrompts]     = useState<string[]>(['', '', '', ''])
  const [aspectRatio, setAspectRatio]   = useState<AspectRatio>('1:1')
  const [generating, setGenerating]     = useState(false)
  const [genProgress, setGenProgress]   = useState('')
  const [genError, setGenError]         = useState<string | null>(null)

  // Post-generation variants/curated selection
  const [variants, setVariants]         = useState<ImageAsset[] | null>(null)
  const [assigningId, setAssigningId]   = useState<string | null>(null)

  // ── Reset modal cuando se abre ───────────────────────────────────────────
  const openGenerate = useCallback(() => {
    setGenMode('individual')
    setGenCount(4)
    setGenPrompt(itemTitle)
    setGenPrompts(['', '', '', ''])
    setAspectRatio('1:1')
    setGenError(null)
    setGenProgress('')
    setVariants(null)
    setGenModalOpen(true)
  }, [itemTitle])

  const closeGenerate = useCallback(() => {
    if (generating) return
    setGenModalOpen(false)
    setVariants(null)
    setConfirmRegen(false)
  }, [generating])

  // ── Asignar una imagen al content_item ───────────────────────────────────
  const assignAsset = useCallback(async (assetId: string, url: string) => {
    setAssigningId(assetId)
    try {
      // Desasignar la previa si era distinta
      if (assignedImageId && assignedImageId !== assetId) {
        fetch(`/api/images/${assignedImageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_item_id: null }),
        }).catch(() => {})
      }
      await fetch(`/api/images/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: itemId }),
      })
      onAssigned(assetId, url)
    } finally {
      setAssigningId(null)
    }
  }, [assignedImageId, itemId, onAssigned])

  // ── Quitar imagen asignada ───────────────────────────────────────────────
  const handleUnassign = useCallback(async () => {
    if (!assignedImageId) return
    setUnassigning(true)
    try {
      await fetch(`/api/images/${assignedImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: null }),
      })
      onUnassigned()
    } finally {
      setUnassigning(false)
    }
  }, [assignedImageId, onUnassigned])

  // ── Generar ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setGenError(null)
    setVariants(null)
    setGenerating(true)
    setGenProgress(genMode === 'individual' ? 'Generando con Imagen 4…' : `Generando ${genCount} imágenes…`)
    try {
      if (genMode === 'individual') {
        const promptFinal = (genPrompt.trim() || itemTitle).trim()
        if (!promptFinal) { setGenError('Escribe un prompt o un título'); return }

        const res = await fetch('/api/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptFinal, aspectRatio, channel }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string }
          if (res.status === 504 || res.status === 408 || res.status === 502) {
            setGenError('La generación tardó demasiado. Imagen 4 está saturado o tu plan Vercel limita el tiempo. Pulsa "Generar imagen" otra vez — suele funcionar al segundo intento.')
          } else {
            setGenError(j.error ?? `HTTP ${res.status}`)
          }
          return
        }
        const data = await res.json() as { id: string; url: string }
        await assignAsset(data.id, data.url)
        setGenModalOpen(false)

      } else if (genMode === 'variants') {
        const promptFinal = (genPrompt.trim() || itemTitle).trim()
        if (!promptFinal) { setGenError('Escribe un prompt o un título'); return }

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
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string }
          if (res.status === 504 || res.status === 408 || res.status === 502) {
            setGenError('Timeout generando variantes. Vuelve a intentarlo o prueba en modo Individual.')
          } else {
            setGenError(j.error ?? `HTTP ${res.status}`)
          }
          return
        }
        const data = await res.json() as { assets: ImageAsset[] }
        setVariants(data.assets)

      } else {
        // curated
        const valid = genPrompts.slice(0, genCount).map(p => p.trim()).filter(Boolean)
        if (valid.length !== genCount) {
          setGenError(`Rellena los ${genCount} prompts`)
          return
        }
        const res = await fetch('/api/images/carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'curated', prompts: valid, aspectRatio, channel }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string }
          if (res.status === 504 || res.status === 408 || res.status === 502) {
            setGenError('Timeout en modo curado (4 imágenes pueden tardar >60s en Vercel free). Prueba con 2 prompts o usa modo Individual.')
          } else {
            setGenError(j.error ?? `HTTP ${res.status}`)
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
  }, [genMode, genPrompt, genPrompts, genCount, aspectRatio, channel, itemTitle, assignAsset])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Estado: imagen ya asignada
  // ═══════════════════════════════════════════════════════════════════════

  if (assignedImageUrl) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="relative overflow-hidden"
          style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assignedImageUrl}
            alt="Visual generado"
            style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
          />
        </div>

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
              <button
                className="btn-pill-secondary"
                onClick={() => setConfirmRegen(true)}
                disabled={unassigning}
              >
                <RefreshCw size={12} aria-hidden="true" /> Regenerar
              </button>
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
            Quitar imagen
          </button>
        </div>

        {/* Modal de generación (regenerar) */}
        <GenerationModal
          open={genModalOpen}
          onClose={closeGenerate}
          genMode={genMode} setGenMode={setGenMode}
          genCount={genCount} setGenCount={setGenCount}
          genPrompt={genPrompt} setGenPrompt={setGenPrompt}
          genPrompts={genPrompts} setGenPrompts={setGenPrompts}
          aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
          generating={generating}
          genProgress={genProgress}
          genError={genError}
          variants={variants}
          assigningId={assigningId}
          onGenerate={handleGenerate}
          onAssignVariant={assignAsset}
          onAfterAssign={() => setGenModalOpen(false)}
          itemTitle={itemTitle}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — Estado: sin imagen
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col items-start gap-2">
      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
        Genera el visual con todas las opciones: una imagen, varias variantes del mismo prompt, o un carrusel con prompts distintos.
      </p>
      <button className="btn-cta" onClick={openGenerate}>
        <Sparkles size={13} aria-hidden="true" />
        Generar imagen con IA
      </button>
      <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        Imagen 4 Ultra para el canal <strong>{channel}</strong> · 4 ratios disponibles · 3 modos
      </p>

      {/* Modal de generación */}
      <GenerationModal
        open={genModalOpen}
        onClose={closeGenerate}
        genMode={genMode} setGenMode={setGenMode}
        genCount={genCount} setGenCount={setGenCount}
        genPrompt={genPrompt} setGenPrompt={setGenPrompt}
        genPrompts={genPrompts} setGenPrompts={setGenPrompts}
        aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        generating={generating}
        genProgress={genProgress}
        genError={genError}
        variants={variants}
        assigningId={assigningId}
        onGenerate={handleGenerate}
        onAssignVariant={assignAsset}
        onAfterAssign={() => setGenModalOpen(false)}
        itemTitle={itemTitle}
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
  generating: boolean
  genProgress: string
  genError: string | null
  variants: ImageAsset[] | null
  assigningId: string | null
  onGenerate: () => void
  onAssignVariant: (id: string, url: string) => Promise<void>
  onAfterAssign: () => void
  itemTitle: string
}

function GenerationModal({
  open, onClose, genMode, setGenMode, genCount, setGenCount,
  genPrompt, setGenPrompt, genPrompts, setGenPrompts,
  aspectRatio, setAspectRatio, generating, genProgress, genError,
  variants, assigningId, onGenerate, onAssignVariant, onAfterAssign, itemTitle,
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
              {genProgress || 'Generando con Imagen 4…'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {genMode === 'curated'
                ? 'Generación secuencial — entre 1 y 2 minutos.'
                : 'Entre 10 y 30 segundos.'}
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
                  return (
                    <button
                      key={m.value}
                      onClick={() => setGenMode(m.value)}
                      className="flex flex-col items-start transition-all"
                      style={{
                        padding: 12,
                        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: 4,
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
            ) : (
              <div>
                <p className="section-label" style={{ marginBottom: 8 }}>
                  Prompts ({genCount} slides distintos)
                </p>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: genCount }).map((_, i) => (
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Aspect ratio ─────────────────────────────────────────── */}
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
              Imagen 4 Ultra (con fallback a Base si la cuota está saturada). Imágenes guardadas en biblioteca con prompt y ratio.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
