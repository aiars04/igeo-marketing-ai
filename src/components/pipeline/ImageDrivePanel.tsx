'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, Loader2, ImageIcon, X, Check, RefreshCw,
} from 'lucide-react'
import type { Channel } from '@/types/database'

interface LibraryAsset {
  id: string
  url: string
  prompt: string | null
  aspect_ratio: string | null
  created_at: string
}

interface Props {
  itemId:           string
  channel:          Channel
  assignedImageId:  string | null
  assignedImageUrl: string | null
  onAssigned:       (assetId: string, url: string) => void
  onUnassigned:     () => void
}

type Tab = 'library' | 'generate'

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1 — Cuadrado' },
  { value: '16:9', label: '16:9 — Horizontal' },
  { value: '9:16', label: '9:16 — Stories' },
  { value: '4:5',  label: '4:5 — Portrait' },
]

export function ImageDrivePanel({
  itemId, channel, assignedImageId, assignedImageUrl, onAssigned, onUnassigned,
}: Props) {
  const [tab, setTab] = useState<Tab>('library')

  // ── Library ───────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [libError, setLibError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)

  const fetchLibrary = useCallback(async () => {
    setLoadingLib(true)
    setLibError(null)
    try {
      const res = await fetch(`/api/images?channel=${channel}&limit=60`)
      if (!res.ok) { setLibError('Error cargando imágenes'); return }
      const data = await res.json() as LibraryAsset[]
      setAssets(data)
    } catch {
      setLibError('Error de red')
    } finally {
      setLoadingLib(false)
    }
  }, [channel])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'library') fetchLibrary()
  }, [tab, fetchLibrary])

  const handleAssign = useCallback(async (assetId: string, url: string) => {
    setAssigning(assetId)
    try {
      const res = await fetch(`/api/images/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: itemId }),
      })
      if (!res.ok) return
      // Si había otro asset asignado, desasignarlo silenciosamente
      if (assignedImageId && assignedImageId !== assetId) {
        fetch(`/api/images/${assignedImageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_item_id: null }),
        }).catch(() => {})
      }
      onAssigned(assetId, url)
    } finally {
      setAssigning(null)
    }
  }, [itemId, assignedImageId, onAssigned])

  const handleUnassign = useCallback(async () => {
    if (!assignedImageId) return
    setAssigning(assignedImageId)
    try {
      await fetch(`/api/images/${assignedImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: null }),
      })
      onUnassigned()
    } finally {
      setAssigning(null)
    }
  }, [assignedImageId, onUnassigned])

  // ── Generate ──────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenError(null)
    setGeneratedUrl(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, channel }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        setGenError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const data = await res.json() as { id: string; url: string }
      setGeneratedUrl(data.url)
      await handleAssign(data.id, data.url)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error de generación')
    } finally {
      setGenerating(false)
    }
  }, [prompt, aspectRatio, channel, handleAssign])

  return (
    <div className="flex flex-col gap-3">

      {/* Imagen asignada actualmente */}
      {assignedImageUrl && (
        <div
          className="relative overflow-hidden"
          style={{ borderRadius: 'var(--radius-md)', border: '2px solid var(--accent)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assignedImageUrl}
            alt="Imagen asignada"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
          />
          <div
            className="absolute top-2 right-2 inline-flex items-center gap-1"
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Check size={11} aria-hidden="true" /> Asignada
          </div>
          <button
            onClick={handleUnassign}
            disabled={!!assigning}
            className="absolute top-2 left-2 flex items-center justify-center transition-opacity hover:opacity-100"
            style={{
              width: 26, height: 26,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.85,
            }}
            aria-label="Desasignar imagen"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 3,
          gap: 3,
        }}
      >
        {(['library', 'generate'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 transition-all"
            style={{
              height: 30,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'calc(var(--radius-md) - 2px)',
              background: tab === t ? 'var(--surface-2)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
              border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
            }}
          >
            {t === 'library' ? (
              <><ImageIcon size={12} aria-hidden="true" /> Biblioteca</>
            ) : (
              <><Sparkles size={12} aria-hidden="true" /> Generar nueva</>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Biblioteca ──────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
              Canal: <strong style={{ color: 'var(--ink-2)' }}>{channel}</strong>
            </p>
            <button
              onClick={fetchLibrary}
              disabled={loadingLib}
              style={{
                color: 'var(--ink-3)', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer', display: 'flex',
              }}
              aria-label="Recargar biblioteca"
            >
              <RefreshCw size={13} className={loadingLib ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>

          {loadingLib ? (
            <div
              className="flex items-center justify-center gap-2 py-8"
              style={{ color: 'var(--ink-3)' }}
            >
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span style={{ fontSize: 12 }}>Cargando…</span>
            </div>
          ) : libError ? (
            <p style={{ fontSize: 12, color: 'var(--red-2)', padding: '8px 0' }}>{libError}</p>
          ) : assets.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8 gap-2"
              style={{ color: 'var(--ink-3)', fontSize: 12 }}
            >
              <ImageIcon size={24} aria-hidden="true" style={{ opacity: 0.35 }} />
              <p>No hay imágenes para este canal.</p>
              <button
                onClick={() => setTab('generate')}
                className="btn-pill-secondary"
                style={{ marginTop: 4 }}
              >
                <Sparkles size={12} aria-hidden="true" /> Generar una nueva
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {assets.map(asset => {
                const isAssigned = asset.id === assignedImageId
                const isLoading  = assigning === asset.id
                return (
                  <button
                    key={asset.id}
                    onClick={() => !isAssigned && handleAssign(asset.id, asset.url)}
                    disabled={isLoading || isAssigned}
                    className="relative overflow-hidden"
                    style={{
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      border: isAssigned
                        ? '2px solid var(--accent)'
                        : '2px solid transparent',
                      background: 'var(--surface-2)',
                      padding: 0,
                      cursor: isAssigned ? 'default' : 'pointer',
                    }}
                    title={asset.prompt ?? undefined}
                    aria-label={isAssigned ? 'Imagen asignada' : `Asignar: ${asset.prompt ?? 'imagen'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.prompt ?? 'imagen'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {isLoading && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.4)' }}
                      >
                        <Loader2
                          size={16}
                          className="animate-spin"
                          style={{ color: '#fff' }}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    {isAssigned && (
                      <div
                        className="absolute bottom-1 right-1 flex items-center justify-center"
                        style={{
                          width: 18, height: 18,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                        }}
                      >
                        <Check size={11} style={{ color: '#fff' }} aria-hidden="true" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Generar nueva ────────────────────────────────────────────────── */}
      {tab === 'generate' && (
        <div className="flex flex-col gap-3">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={`Describe la imagen para ${channel}…`}
            rows={3}
            className="input"
            style={{
              resize: 'vertical',
              minHeight: 80,
              fontSize: 13,
              padding: 10,
              fontFamily: 'inherit',
            }}
            disabled={generating}
          />

          <select
            value={aspectRatio}
            onChange={e => setAspectRatio(e.target.value)}
            className="input"
            style={{ height: 34, fontSize: 12 }}
            disabled={generating}
          >
            {ASPECT_RATIOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {genError && (
            <p style={{ fontSize: 11, color: 'var(--red-2)' }}>Error: {genError}</p>
          )}

          {generatedUrl && (
            <div
              className="overflow-hidden"
              style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedUrl}
                alt="Imagen generada"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
              />
              <div
                className="flex items-center gap-1.5 px-3 py-2"
                style={{
                  background: 'var(--green-soft)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--green-2)',
                }}
              >
                <Check size={11} aria-hidden="true" /> Generada y asignada automáticamente
              </div>
            </div>
          )}

          <button
            className="btn-cta"
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
          >
            {generating ? (
              <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Generando con Imagen 4…</>
            ) : (
              <><Sparkles size={13} aria-hidden="true" /> Generar imagen</>
            )}
          </button>

          <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Usa Imagen 4 Ultra vía Gemini. La imagen se asigna directamente a esta tarjeta (10-30s).
          </p>
        </div>
      )}
    </div>
  )
}
