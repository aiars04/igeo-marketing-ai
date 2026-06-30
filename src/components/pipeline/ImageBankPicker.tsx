'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  X, Search, FolderOpen, Upload, Loader2, Check,
  Sparkles, Image as ImageIcon, ChevronRight, FileText,
} from 'lucide-react'
import type { Channel } from '@/types/database'

interface ImageAsset {
  id:               string
  url:              string
  storage_path:     string
  prompt:           string | null
  asset_type:       'generated' | 'upload' | 'video' | 'document' | string
  mime_type?:       string | null
  approved:         boolean
  channel:          Channel | 'uncategorized' | null
  folder_id:        string | null
  content_item_id:  string | null
  width:            number | null
  height:           number | null
  aspect_ratio:     string | null
  created_at:       string
}

interface ImageFolder {
  id:      string
  name:    string
  channel: Channel | null
  system:  boolean
  color:   string | null
  icon:    string | null
}

interface Props {
  open:        boolean
  onClose:     () => void
  channel:     Channel
  onSelected:  (assetId: string, url: string) => void
  /** Opcional: si el caller soporta multi-asignación (carrusel), recibe el
   *  array de assets en orden de click. Si NO se pasa, el modo selección
   *  múltiple queda oculto y el picker se comporta single-pick como antes. */
  onMultiSelected?: (assets: Array<{ id: string; url: string }>) => Promise<void> | void
}

const FILTER_OPTIONS = [
  { id: 'channel', label: 'Solo del canal' },
  { id: 'all',     label: 'Todas' },
] as const
type FilterMode = typeof FILTER_OPTIONS[number]['id']

/**
 * Picker para elegir una imagen del banco y asignarla al content_item activo.
 *
 * Flujo:
 *   - Carga GET /api/images (filtrable por canal/carpeta)
 *   - Click en una imagen → llama onSelected y cierra
 *   - Botón "Subir nueva" → file picker + POST /api/images/upload → asigna directo
 *
 * NO hace el PATCH de asignación: el padre (ImageDrivePanel) ya tiene
 * assignAsset() implementado. Aquí solo notifica con onSelected(id, url).
 */
export function ImageBankPicker({ open, onClose, channel, onSelected, onMultiSelected }: Props) {
  // Modo selección múltiple — activado por toggle. Guarda el ORDEN de click
  // para usarlo como position 0..N-1 del carrusel resultante.
  const [multiMode, setMultiMode] = useState(false)
  const [multiSelected, setMultiSelected] = useState<Array<{ id: string; url: string }>>([])
  const [multiAssigning, setMultiAssigning] = useState(false)
  const supportsMulti = !!onMultiSelected
  const [folders, setFolders]         = useState<ImageFolder[]>([])
  const [assets, setAssets]           = useState<ImageAsset[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<string | 'all' | 'uncategorized'>('all')
  const [filterMode, setFilterMode]   = useState<FilterMode>('channel')
  const [search, setSearch]           = useState('')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [picking, setPicking]         = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Carga inicial: folders + assets ───────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (filterMode === 'channel') params.set('channel', channel)
      if (selectedFolder === 'uncategorized') params.set('folder_id', 'uncategorized')
      else if (selectedFolder !== 'all')       params.set('folder_id', selectedFolder)

      const [imgRes, foldRes] = await Promise.all([
        fetch(`/api/images?${params.toString()}`),
        folders.length === 0
          ? fetch('/api/image-folders')
          : Promise.resolve(null),
      ])

      if (imgRes.ok) {
        const data = await imgRes.json() as ImageAsset[]
        setAssets(data)
      }
      if (foldRes && foldRes.ok) {
        const fdata = await foldRes.json() as { folders: ImageFolder[] }
        setFolders(fdata.folders ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [channel, filterMode, selectedFolder, folders.length])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [open, load])

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? assets.filter(a => (a.prompt ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : assets

  // ── Subir nueva(s) imagen(es) / PDF ───────────────────────────────────────
  // Acepta multi-seleccion: el input file tiene `multiple` y aqui los subimos
  // en SERIE para no saturar el endpoint ni el bucket (paralelo no aporta
  // ventaja real en multipart upload, y el orden de respuesta es importante
  // para el position si el usuario quiere asignar varios al item).
  const handleUploadClick = () => fileInputRef.current?.click()
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploadError(null)
    setUploading(true)
    let lastCreated: ImageAsset | null = null
    const errors: string[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const formData = new FormData()
        formData.append('file', f)
        formData.append('channel', channel)
        const res = await fetch('/api/images/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          errors.push(`${f.name}: ${j.error ?? res.statusText}`)
          continue
        }
        lastCreated = await res.json() as ImageAsset
      }
      if (errors.length > 0) {
        setUploadError(errors.length === files.length
          ? `Errores: ${errors[0]}`
          : `${files.length - errors.length} subidas, ${errors.length} fallaron. Primer error: ${errors[0]}`,
        )
      }
      // Si AL MENOS uno se subio, auto-asignamos el ULTIMO al item y cerramos
      // el picker. Los demas quedan en el banco para asignacion manual.
      if (lastCreated) {
        onSelected(lastCreated.id, lastCreated.url)
      }
    } finally {
      setUploading(false)
    }
  }

  // ── Selección ─────────────────────────────────────────────────────────────
  const handlePick = async (asset: ImageAsset) => {
    if (multiMode) {
      // En modo múltiple toggle (add si no está, remove si ya estaba).
      // El ORDEN de click se preserva para usarlo como position del carrusel.
      setMultiSelected(prev => {
        const idx = prev.findIndex(a => a.id === asset.id)
        if (idx >= 0) return prev.filter((_, i) => i !== idx)
        return [...prev, { id: asset.id, url: asset.url }]
      })
      return
    }
    setPicking(asset.id)
    try { onSelected(asset.id, asset.url) }
    finally { setPicking(null) }
  }

  const handleConfirmMulti = async () => {
    if (!onMultiSelected || multiSelected.length === 0) return
    setMultiAssigning(true)
    try {
      await onMultiSelected(multiSelected)
    } finally {
      setMultiAssigning(false)
    }
  }

  // ── ESC cierra ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !uploading) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, uploading, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Elegir imagen del banco"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={() => !uploading && onClose()}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 14,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40, height: 40, flexShrink: 0,
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ImageIcon size={18} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
              Elegir del banco
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
              Selecciona una imagen ya generada/subida o sube una nueva propia (branding, plantillas, etc.)
            </p>
          </div>

          {/* Filtro canal/todas */}
          <div style={{
            display: 'inline-flex',
            padding: 3, background: 'var(--surface-2)',
            borderRadius: 'var(--radius-pill)',
            flexShrink: 0,
          }}>
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterMode(opt.id)}
                style={{
                  height: 28, padding: '0 12px',
                  background: filterMode === opt.id ? 'var(--surface)' : 'transparent',
                  color: filterMode === opt.id ? 'var(--ink)' : 'var(--ink-3)',
                  border: 'none', borderRadius: 'var(--radius-pill)',
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  boxShadow: filterMode === opt.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => !uploading && onClose()}
            aria-label="Cerrar"
            disabled={uploading}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--surface-2)', color: 'var(--ink-2)',
              border: '1px solid var(--border)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Barra acciones: subir + buscar */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
            className="btn-cta"
            style={{ flexShrink: 0 }}
          >
            {uploading
              ? <><Loader2 size={13} className="animate-spin" /> Subiendo…</>
              : <><Upload size={13} aria-hidden="true" /> Subir nueva</>}
          </button>

          <div style={{
            flex: 1, position: 'relative',
            display: 'flex', alignItems: 'center',
          }}>
            <Search size={13} aria-hidden="true" style={{ position: 'absolute', left: 10, color: 'var(--ink-3)' }} />
            <input
              className="input"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por prompt…"
              style={{ height: 34, paddingLeft: 30, fontSize: 12.5 }}
            />
          </div>

          {/* Toggle modo selección múltiple — solo si el caller lo soporta
              (onMultiSelected). Permite marcar N imágenes en orden de click
              para asignarlas como carrusel al item. */}
          {supportsMulti && (
            <button
              type="button"
              onClick={() => {
                setMultiMode(prev => {
                  const next = !prev
                  if (!next) setMultiSelected([]) // al salir, limpiar
                  return next
                })
              }}
              disabled={uploading || multiAssigning}
              style={{
                height: 34, padding: '0 12px', fontSize: 12, fontWeight: 600,
                borderRadius: 'var(--radius-pill)',
                border: `1px solid ${multiMode ? 'var(--accent)' : 'var(--border)'}`,
                background: multiMode ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: multiMode ? 'var(--accent-2)' : 'var(--ink-2)',
                cursor: 'pointer', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              title="Selecciona varias imágenes en orden de click para crear un carrusel"
            >
              <Check size={13} aria-hidden="true" />
              {multiMode ? `${multiSelected.length} seleccionada${multiSelected.length === 1 ? '' : 's'}` : 'Selección múltiple'}
            </button>
          )}
        </div>

        {uploadError && (
          <div style={{
            padding: '8px 24px',
            background: 'var(--red-soft)',
            color: 'var(--red-2)',
            fontSize: 12,
            borderBottom: '1px solid rgba(239,68,68,0.20)',
          }}>
            {uploadError}
          </div>
        )}

        {/* Body con sidebar + grid */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar carpetas */}
          <aside
            style={{
              width: 220, flexShrink: 0,
              borderRight: '1px solid var(--border)',
              background: 'var(--surface-2)',
              overflowY: 'auto',
              padding: '12px 10px',
            }}
          >
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--ink-3)',
              margin: '0 6px 8px',
            }}>
              Carpetas
            </p>
            <FolderItem
              active={selectedFolder === 'all'}
              onClick={() => setSelectedFolder('all')}
              label="Todas"
              count={assets.length}
            />
            <FolderItem
              active={selectedFolder === 'uncategorized'}
              onClick={() => setSelectedFolder('uncategorized')}
              label="Sin categorizar"
            />
            <div style={{ height: 8 }} />
            {folders.map(f => (
              <FolderItem
                key={f.id}
                active={selectedFolder === f.id}
                onClick={() => setSelectedFolder(f.id)}
                label={f.name}
              />
            ))}
          </aside>

          {/* Grid de imágenes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
                <Loader2 size={20} className="animate-spin inline-block mr-2" />
                Cargando imágenes…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                padding: 60, textAlign: 'center',
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <Sparkles size={28} aria-hidden="true" style={{ color: 'var(--ink-3)', opacity: 0.4, marginBottom: 10 }} />
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  Sin imágenes en esta vista
                </p>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                  Sube una nueva con el botón de arriba, o cambia el filtro a &quot;Todas&quot;.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 12,
              }}>
                {filtered.map(a => {
                  const orderIdx = multiMode
                    ? multiSelected.findIndex(s => s.id === a.id)
                    : -1
                  return (
                    <ImageThumb
                      key={a.id}
                      asset={a}
                      picking={picking === a.id}
                      onClick={() => handlePick(a)}
                      multiOrder={orderIdx >= 0 ? orderIdx + 1 : undefined}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Barra inferior fija con acción "Asignar N seleccionadas" — solo
            visible cuando el modo múltiple está activo con >=1 seleccionada. */}
        {multiMode && multiSelected.length > 0 && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              flexShrink: 0,
              background: 'var(--surface-2)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
              {multiSelected.length} seleccionada{multiSelected.length === 1 ? '' : 's'}
              {' · '}
              <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>
                {multiSelected.length === 1
                  ? 'Se asignará como imagen única'
                  : `Se asignarán como carrusel (orden 1-${multiSelected.length})`}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMultiSelected([])}
              disabled={multiAssigning}
              style={{
                height: 34, padding: '0 12px', fontSize: 12, fontWeight: 500,
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--ink-2)',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={handleConfirmMulti}
              disabled={multiAssigning}
              className="btn-cta"
              style={{ height: 34 }}
            >
              {multiAssigning
                ? <><Loader2 size={13} className="animate-spin" /> Asignando…</>
                : <><Check size={13} aria-hidden="true" /> Asignar {multiSelected.length}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
function FolderItem({
  active, onClick, label, count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '7px 10px',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent-2)' : 'var(--ink-2)',
        border: 'none', borderRadius: 'var(--radius-sm)',
        fontSize: 12.5, fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        textAlign: 'left',
      }}
    >
      <FolderOpen size={12} aria-hidden="true" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500 }}>
          {count}
        </span>
      )}
    </button>
  )
}

function ImageThumb({
  asset, picking, onClick, multiOrder,
}: {
  asset: ImageAsset
  picking: boolean
  onClick: () => void
  /** Si está seleccionado en modo múltiple, el índice 1-based para mostrar
   *  como badge sobreimpreso. undefined = no seleccionado. */
  multiOrder?: number
}) {
  const isMulti = typeof multiOrder === 'number'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={picking}
      style={{
        position: 'relative',
        padding: 0,
        background: 'var(--surface-2)',
        border: isMulti ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: picking ? 'wait' : 'pointer',
        transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s',
        boxShadow: isMulti ? '0 0 0 3px var(--accent-soft)' : undefined,
      }}
      onMouseEnter={e => {
        if (!isMulti) e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = isMulti
          ? '0 0 0 3px var(--accent-soft), 0 8px 20px rgba(0,0,0,0.10)'
          : '0 8px 20px rgba(0,0,0,0.10)'
      }}
      onMouseLeave={e => {
        if (!isMulti) e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = isMulti ? '0 0 0 3px var(--accent-soft)' : 'none'
      }}
    >
      {isMulti && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 8, left: 8,
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {multiOrder}
        </div>
      )}
      <div style={{
        position: 'relative',
        background: '#0f172a',
        aspectRatio: '1 / 1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {asset.asset_type === 'video' ? (
          <video
            src={asset.url}
            preload="metadata"
            muted
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : asset.asset_type === 'document'
              || asset.mime_type === 'application/pdf'
              || /\.pdf(\?|$)/i.test(asset.url) ? (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 6,
              color: '#94a3b8',
              padding: 16,
            }}
            title="Documento PDF (carrusel LinkedIn)"
          >
            <FileText size={36} aria-hidden="true" />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>PDF</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={asset.url}
            alt={asset.prompt ?? 'Imagen'}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
        {picking && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px', textAlign: 'left' }}>
        <p style={{
          margin: 0, fontSize: 11, color: 'var(--ink-2)',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          lineHeight: 1.35,
          minHeight: 28,
        }}>
          {asset.prompt ?? <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Sin prompt</span>}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 6, fontSize: 9.5, color: 'var(--ink-3)',
        }}>
          {asset.asset_type === 'upload' && (
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: 'var(--green-soft)', color: 'var(--green-2)',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Subida
            </span>
          )}
          {asset.asset_type === 'generated' && (
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: 'var(--accent-soft)', color: 'var(--accent-2)',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              IA
            </span>
          )}
          {asset.aspect_ratio && (
            <span>{asset.aspect_ratio}</span>
          )}
          {asset.content_item_id && (
            <span title="Ya asignada a otro item" style={{ color: '#b25000', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <ChevronRight size={9} aria-hidden="true" /> en uso
            </span>
          )}
          {asset.approved && (
            <Check size={10} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
          )}
        </div>
      </div>
    </button>
  )
}
