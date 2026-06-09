'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Loader2, RefreshCw, X } from 'lucide-react'
import type { Channel } from '@/types/database'

interface Props {
  itemId:           string
  itemTitle:        string
  channel:          Channel
  assignedImageId:  string | null
  assignedImageUrl: string | null
  onAssigned:       (assetId: string, url: string) => void
  onUnassigned:     () => void
}

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1 — Cuadrado'    },
  { value: '16:9', label: '16:9 — Horizontal'  },
  { value: '9:16', label: '9:16 — Stories'     },
  { value: '4:5',  label: '4:5 — Portrait'     },
]

export function ImageDrivePanel({
  itemId, itemTitle, channel, assignedImageId, assignedImageUrl, onAssigned, onUnassigned,
}: Props) {
  const [prompt, setPrompt]           = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [generating, setGenerating]   = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const [genError, setGenError]       = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)

  const handleGenerate = useCallback(async (isRegenerate = false) => {
    setGenerating(true)
    setGenError(null)
    setConfirmRegen(false)
    try {
      // Desasignar la imagen previa si existe
      if (assignedImageId) {
        await fetch(`/api/images/${assignedImageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_item_id: null }),
        }).catch(() => {})
      }

      // Generar nueva imagen
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim() || itemTitle,
          aspectRatio,
          channel,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        setGenError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const data = await res.json() as { id: string; url: string }

      // Asignar al content item
      await fetch(`/api/images/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: itemId }),
      })

      onAssigned(data.id, data.url)
      if (!isRegenerate) setPrompt('')
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error de generación')
    } finally {
      setGenerating(false)
    }
  }, [prompt, aspectRatio, channel, itemId, itemTitle, assignedImageId, onAssigned])

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

  // ── Estado: generando ─────────────────────────────────────────────────────
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6">
        <Loader2 size={22} className="animate-spin" aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          Generando imagen con Imagen 4…
        </p>
        <p style={{ fontSize: 11, color: 'var(--ink-2)' }}>
          Puede tardar entre 10 y 30 segundos.
        </p>
      </div>
    )
  }

  // ── Estado: imagen asignada ───────────────────────────────────────────────
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
                  onClick={() => handleGenerate(true)}
                  style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                >
                  <RefreshCw size={11} aria-hidden="true" /> Sí, regenerar
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
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-3)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            {unassigning
              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              : <X size={12} aria-hidden="true" />}
            Quitar imagen
          </button>
        </div>

        {genError && (
          <p style={{ fontSize: 11, color: 'var(--red-2)', marginTop: 4 }}>
            Error: {genError}
          </p>
        )}
      </div>
    )
  }

  // ── Estado: sin imagen — formulario de generación ─────────────────────────
  return (
    <div className="flex flex-col items-start gap-2">
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder={`Describe la imagen (opcional — si está vacío usa el título)`}
        rows={2}
        className="input w-full"
        style={{
          resize: 'vertical',
          minHeight: 60,
          fontSize: 13,
          padding: 10,
          fontFamily: 'inherit',
        }}
      />
      <select
        value={aspectRatio}
        onChange={e => setAspectRatio(e.target.value)}
        className="input"
        style={{ height: 32, fontSize: 12, width: '100%' }}
      >
        {ASPECT_RATIOS.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button
        className="btn-cta"
        onClick={() => handleGenerate(false)}
      >
        <Sparkles size={13} aria-hidden="true" />
        Generar imagen con IA
      </button>
      <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        Usará Imagen 4 Ultra para el canal <strong>{channel}</strong> (10-30s).
      </p>
      {genError && (
        <p style={{ fontSize: 11, color: 'var(--red-2)' }}>
          Error: {genError}
        </p>
      )}
    </div>
  )
}
