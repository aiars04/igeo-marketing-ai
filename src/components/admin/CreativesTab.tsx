'use client'

/**
 * Tab "Creativos digitales" del Admin (Fase 1: catálogo).
 *
 * Permite subir, editar y eliminar plantillas maestras de identidad visual
 * asociadas a un canal y, opcionalmente, a uno o varios content_types.
 *
 * Fase 2 (siguiente iteración) las inyectará como referencia visual al
 * generador de imágenes de Nano Banana 2 — por ahora es un catálogo.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Pencil, Trash2, Upload, Image as ImageIcon, X, Loader2,
  ToggleLeft, ToggleRight, Filter, ImagePlus, ZoomIn, Download, ExternalLink,
} from 'lucide-react'
import { ALL_MARKETS, MARKET_CONFIG } from '@/lib/utils'
import type { Channel, Market, ContentType, CreativeTemplateWithRefs } from '@/types/database'

interface Props {
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  x: 'X', blog: 'Blog', email: 'Email', newsletter: 'Newsletter',
}
// MARKETS derivados de @/lib/utils. La primera opción ('') representa
// "plantilla global válida para todos los mercados" — propio de creatives,
// no se aplica a Ideas/Calendar/Pipeline (donde cada item es de UN mercado).
const MARKETS: { value: Market | ''; label: string }[] = [
  { value: '', label: 'Todos los mercados' },
  ...ALL_MARKETS.map(m => ({ value: m as Market, label: MARKET_CONFIG[m].label })),
]
const ROLE_SUGGESTIONS = ['banner', 'thumbnail', 'cover', 'background', 'logo_overlay', 'slide']

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_MIME = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

function humanSize(n: number | null): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function CreativesTab({ toast }: Props) {
  const [templates, setTemplates] = useState<CreativeTemplateWithRefs[]>([])
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [filterChannel, setFilterChannel] = useState<Channel | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CreativeTemplateWithRefs | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<CreativeTemplateWithRefs | null>(null)
  const [previewing, setPreviewing] = useState<CreativeTemplateWithRefs | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tplRes, ctRes] = await Promise.all([
        fetch('/api/creative-templates'),
        fetch('/api/content-types'),
      ])
      if (tplRes.ok) setTemplates(await tplRes.json() as CreativeTemplateWithRefs[])
      else {
        const j = await tplRes.json().catch(() => ({}))
        toast(`Error cargando plantillas: ${j.error ?? tplRes.statusText}`, 'error')
      }
      if (ctRes.ok) setContentTypes(await ctRes.json() as ContentType[])
    } finally {
      setLoading(false)
    }
  }, [toast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!filterChannel) return templates
    return templates.filter(t => t.channel === filterChannel)
  }, [templates, filterChannel])

  const groupedByChannel = useMemo(() => {
    const map = new Map<Channel, CreativeTemplateWithRefs[]>()
    for (const t of filtered) {
      const arr = map.get(t.channel) ?? []
      arr.push(t)
      map.set(t.channel, arr)
    }
    return map
  }, [filtered])

  const handleToggleActive = async (t: CreativeTemplateWithRefs) => {
    const res = await fetch(`/api/creative-templates/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !t.active }),
    })
    if (res.ok) {
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, active: !t.active } : x))
      toast(t.active ? 'Plantilla desactivada' : 'Plantilla activada', 'success')
    } else {
      const j = await res.json().catch(() => ({}))
      toast(`Error: ${j.error ?? res.statusText}`, 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    const res = await fetch(`/api/creative-templates/${deleteConfirm.id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates(prev => prev.filter(x => x.id !== deleteConfirm.id))
      toast(`Plantilla "${deleteConfirm.name}" eliminada`, 'success')
    } else {
      const j = await res.json().catch(() => ({}))
      toast(`Error: ${j.error ?? res.statusText}`, 'error')
    }
    setDeleteConfirm(null)
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col" style={{ gap: 18 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div style={{ maxWidth: 720 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Creativos digitales — plantillas maestras
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0', lineHeight: 1.55 }}>
            Sube imágenes de referencia (banners, miniaturas, fondos…) para que sirvan de
            base visual a la hora de generar contenido. Las puedes vincular a uno o varios
            tipos de canal — si no vinculas ninguna, se aplica a todos los del canal.
          </p>
        </div>
        <button className="btn-cta" onClick={() => { setEditing(null); setModalOpen(true) }}>
          <Plus size={13} aria-hidden="true" />
          Nueva plantilla
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <Filter size={13} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Canal
        </span>
        {(['', ...CHANNELS] as Array<Channel | ''>).map(ch => {
          const active = filterChannel === ch
          const label = ch === '' ? 'Todos' : CHANNEL_LABEL[ch]
          return (
            <button
              key={ch || 'all'}
              onClick={() => setFilterChannel(ch)}
              style={{
                height: 28, padding: '0 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 11, fontWeight: 600, lineHeight: 1,
                cursor: 'pointer',
                background: active ? 'var(--accent)' : 'var(--surface-2)',
                color: active ? '#fff' : 'var(--ink-2)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div
            className="w-12 h-12 flex items-center justify-center"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
          >
            <ImagePlus size={22} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              {templates.length === 0 ? 'Sin plantillas aún' : 'Sin resultados para este filtro'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0' }}>
              {templates.length === 0
                ? 'Sube la primera plantilla maestra para empezar a unificar la identidad visual'
                : 'Prueba con otro canal'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 24 }}>
          {Array.from(groupedByChannel.entries()).map(([channel, items]) => (
            <div key={channel}>
              <h3 style={{
                fontSize: 12, fontWeight: 700, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px',
              }}>
                {CHANNEL_LABEL[channel]} · {items.length}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 14 }}>
                {items.map(t => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    contentTypes={contentTypes.filter(ct => ct.channel === t.channel)}
                    onPreview={() => setPreviewing(t)}
                    onEdit={() => { setEditing(t); setModalOpen(true) }}
                    onToggle={() => handleToggleActive(t)}
                    onDelete={() => setDeleteConfirm(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal upload/edit */}
      <TemplateModal
        key={editing?.id ?? 'new'}
        open={modalOpen}
        initial={editing}
        contentTypes={contentTypes}
        onClose={() => setModalOpen(false)}
        onSaved={(t) => {
          setTemplates(prev => {
            const exists = prev.some(x => x.id === t.id)
            return exists ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev]
          })
          toast(editing ? 'Plantilla actualizada' : 'Plantilla creada', 'success')
        }}
      />

      {/* Lightbox preview */}
      {previewing && (
        <TemplateLightbox
          template={previewing}
          contentTypes={contentTypes.filter(ct => ct.channel === previewing.channel)}
          onClose={() => setPreviewing(null)}
          onEdit={() => { setEditing(previewing); setPreviewing(null); setModalOpen(true) }}
        />
      )}

      {/* Confirm delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDeleteConfirm(null)}
          />
          <div
            className="relative w-full max-w-sm p-6 space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
          >
            <div className="text-center space-y-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                style={{ background: 'var(--red-soft)' }}
              >
                <Trash2 size={22} aria-hidden="true" style={{ color: 'var(--red-2)' }} />
              </div>
              <h3 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>¿Eliminar plantilla?</h3>
              <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                Se eliminará <strong style={{ color: 'var(--ink)' }}>{deleteConfirm.name}</strong> y su archivo. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-destructive flex-1" onClick={handleDelete}>
                <Trash2 size={13} aria-hidden="true" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────

function TemplateCard({
  template, contentTypes, onPreview, onEdit, onToggle, onDelete,
}: {
  template: CreativeTemplateWithRefs
  contentTypes: ContentType[]
  onPreview: () => void
  onEdit:    () => void
  onToggle:  () => void
  onDelete:  () => void
}) {
  const ctNames = contentTypes
    .filter(ct => template.content_type_ids.includes(ct.id))
    .map(ct => ct.name)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        opacity: template.active ? 1 : 0.55,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Preview clicable — abre lightbox a tamaño completo */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Ver ${template.name} en detalle`}
        style={{
          background: 'var(--surface-2)',
          aspectRatio: '16/9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          position: 'relative',
          width: '100%',
        }}
        onMouseEnter={e => {
          const ov = e.currentTarget.querySelector<HTMLElement>('[data-preview-overlay]')
          if (ov) ov.style.opacity = '1'
        }}
        onMouseLeave={e => {
          const ov = e.currentTarget.querySelector<HTMLElement>('[data-preview-overlay]')
          if (ov) ov.style.opacity = '0'
        }}
      >
        {template.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.signed_url}
            alt={template.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <ImageIcon size={28} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
        )}
        {/* Overlay hover con icono lupa */}
        <span
          data-preview-overlay
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.15s ease',
            color: '#fff',
            fontSize: 12, fontWeight: 600,
            gap: 6,
          }}
        >
          <ZoomIn size={16} aria-hidden="true" />
          Ver en detalle
        </span>
      </button>

      {/* Info */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div className="flex items-start justify-between gap-2">
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }} className="truncate">
              {template.name}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.4 }}>
              {template.asset_role} · {template.width && template.height
                ? `${template.width}×${template.height}`
                : (template.aspect_ratio ?? '—')} · {humanSize(template.file_size)}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onToggle}
              className="admin-card-action admin-card-action-toggle"
              title={template.active ? 'Desactivar' : 'Activar'}
              aria-label={template.active ? 'Desactivar' : 'Activar'}
            >
              {template.active
                ? <ToggleRight size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                : <ToggleLeft size={16} aria-hidden="true" />}
            </button>
            <button onClick={onEdit} className="admin-card-action" title="Editar" aria-label="Editar">
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button onClick={onDelete} className="admin-card-action admin-card-action-delete" title="Eliminar" aria-label="Eliminar">
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mercado + content_types */}
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {template.market && (
            <span
              style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--ink-2)',
              }}
            >
              {MARKETS.find(m => m.value === template.market)?.label ?? template.market}
            </span>
          )}
          {ctNames.length === 0 ? (
            <span
              style={{
                fontSize: 10, fontStyle: 'italic',
                padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                background: 'transparent', border: '1px dashed var(--border)',
                color: 'var(--ink-3)',
              }}
            >
              Todos los tipos del canal
            </span>
          ) : ctNames.slice(0, 3).map(name => (
            <span
              key={name}
              style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
                color: 'var(--accent-2)',
              }}
            >
              {name}
            </span>
          ))}
          {ctNames.length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--ink-3)', padding: '2px 4px' }}>
              +{ctNames.length - 3}
            </span>
          )}
        </div>

        {template.notes && (
          <p style={{ fontSize: 11, color: 'var(--ink-2)', margin: 0, lineHeight: 1.45 }} className="line-clamp-2">
            {template.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Modal upload / edit ─────────────────────────────────────────────────

function TemplateModal({
  open, initial, contentTypes, onClose, onSaved,
}: {
  open: boolean
  initial: CreativeTemplateWithRefs | null
  contentTypes: ContentType[]
  onClose: () => void
  onSaved: (t: CreativeTemplateWithRefs) => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? 'linkedin')
  const [market, setMarket] = useState<Market | ''>((initial?.market ?? '') as Market | '')
  const [assetRole, setAssetRole] = useState(initial?.asset_role ?? 'banner')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [selectedCtIds, setSelectedCtIds] = useState<string[]>(initial?.content_type_ids ?? [])
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(initial?.signed_url ?? null)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(
    initial?.width && initial?.height ? { w: initial.width, h: initial.height } : null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset al abrir/cambiar de target
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setChannel(initial?.channel ?? 'linkedin')
    setMarket((initial?.market ?? '') as Market | '')
    setAssetRole(initial?.asset_role ?? 'banner')
    setNotes(initial?.notes ?? '')
    setSelectedCtIds(initial?.content_type_ids ?? [])
    setFile(null)
    setFilePreview(initial?.signed_url ?? null)
    setDimensions(initial?.width && initial?.height ? { w: initial.width, h: initial.height } : null)
    setError(null)
    setSaving(false)
  }, [initial, open])

  // Filtra content_types por el canal seleccionado
  const filteredCTs = useMemo(
    () => contentTypes.filter(ct => ct.channel === channel),
    [contentTypes, channel],
  )

  // Si el usuario cambia el canal, descarta los ct seleccionados que no son de ese canal
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCtIds(prev =>
      prev.filter(id => filteredCTs.some(ct => ct.id === id)),
    )
  }, [open, channel, filteredCTs])

  const handleFileChange = (f: File | null) => {
    setError(null)
    if (!f) {
      setFile(null); setFilePreview(initial?.signed_url ?? null); setDimensions(null)
      return
    }
    if (f.size > MAX_BYTES) {
      setError('El archivo supera 10 MB')
      return
    }
    setFile(f)
    const url = URL.createObjectURL(f)
    setFilePreview(url)
    // Detectar dimensiones (no aplica a SVG)
    if (f.type !== 'image/svg+xml') {
      const img = new window.Image()
      img.onload = () => {
        setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
      }
      img.src = url
    } else {
      setDimensions(null)
    }
  }

  const toggleCt = (id: string) => {
    setSelectedCtIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const canSubmit = name.trim().length >= 2 && (isEdit || !!file) && !saving

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)
    try {
      if (!isEdit) {
        // CREATE: multipart
        if (!file) { setError('Sube un archivo'); return }
        const fd = new FormData()
        fd.set('file', file)
        fd.set('name', name.trim())
        if (description.trim()) fd.set('description', description.trim())
        fd.set('channel', channel)
        if (market) fd.set('market', market)
        fd.set('asset_role', assetRole.trim() || 'banner')
        if (notes.trim()) fd.set('notes', notes.trim())
        if (dimensions) {
          fd.set('width',  String(dimensions.w))
          fd.set('height', String(dimensions.h))
        }
        for (const id of selectedCtIds) fd.append('content_type_id', id)

        const res = await fetch('/api/creative-templates', { method: 'POST', body: fd })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        const created = await res.json() as CreativeTemplateWithRefs
        onSaved(created)
        onClose()
      } else {
        // EDIT: JSON con metadatos
        const res = await fetch(`/api/creative-templates/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            market: market || null,
            asset_role: assetRole.trim() || 'banner',
            notes: notes.trim() || null,
            content_type_ids: selectedCtIds,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        // Recarga la hidratación
        const refreshed = await fetch('/api/creative-templates').then(r => r.ok ? r.json() : [])
        const found = (refreshed as CreativeTemplateWithRefs[]).find(t => t.id === initial.id)
        if (found) onSaved(found)
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => !saving && onClose()}
      />
      <div
        className="relative w-full max-w-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          maxHeight: 'calc(100vh - 48px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>
            {isEdit ? 'Editar plantilla' : 'Nueva plantilla'}
          </h2>
          <button onClick={() => !saving && onClose()} className="image-menu-trigger" aria-label="Cerrar">
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 flex flex-col" style={{ padding: 24, gap: 16 }}>
          {/* Archivo (solo en create) */}
          {!isEdit && (
            <div>
              <label className="section-label block mb-1.5">Imagen *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME}
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files?.[0] ?? null) }}
                style={{
                  cursor: 'pointer',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface-2)',
                  minHeight: 160,
                }}
              >
                {filePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={filePreview}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }}
                  />
                ) : (
                  <div className="text-center" style={{ color: 'var(--ink-3)' }}>
                    <Upload size={24} aria-hidden="true" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: 0 }}>
                      Arrastra una imagen o haz clic
                    </p>
                    <p style={{ fontSize: 11, margin: '4px 0 0' }}>
                      PNG · JPG · WebP · GIF · SVG · máx. 10 MB
                    </p>
                  </div>
                )}
              </div>
              {dimensions && (
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                  Dimensiones detectadas: <strong>{dimensions.w}×{dimensions.h}</strong>
                </p>
              )}
            </div>
          )}

          {/* En edición, preview compacto del archivo existente */}
          {isEdit && filePreview && (
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 8,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={filePreview} alt={name} style={{ width: 80, height: 60, objectFit: 'contain', background: 'var(--surface)', borderRadius: 4 }} />
              <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: 0 }}>
                Para cambiar el archivo, elimina y vuelve a crearla.
              </p>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="section-label block mb-1.5">Nombre *</label>
            <input
              autoFocus
              className="input"
              placeholder="Banner email Q4"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={140}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="section-label block mb-1.5">Descripción (opcional)</label>
            <input
              className="input"
              placeholder="Plantilla maestra del banner superior"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>

          {/* Canal + Rol + Mercado */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="section-label block mb-1.5">Canal *</label>
              <select
                className="input"
                value={channel}
                onChange={e => setChannel(e.target.value as Channel)}
                disabled={isEdit}
                title={isEdit ? 'No editable — elimina y crea de nuevo si quieres cambiarlo' : undefined}
              >
                {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="section-label block mb-1.5">Rol</label>
              <input
                className="input"
                list="role-suggestions"
                value={assetRole}
                onChange={e => setAssetRole(e.target.value)}
                maxLength={60}
              />
              <datalist id="role-suggestions">
                {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div>
              <label className="section-label block mb-1.5">Mercado</label>
              <select
                className="input"
                value={market}
                onChange={e => setMarket(e.target.value as Market | '')}
              >
                {MARKETS.map(m => <option key={m.value || 'all'} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Content types */}
          <div>
            <label className="section-label block mb-1.5">
              Tipos de canal a los que aplica
            </label>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
              Si no marcas ninguno, la plantilla aplica a TODOS los tipos del canal.
            </p>
            {filteredCTs.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                No hay tipos de canal definidos para {CHANNEL_LABEL[channel]}.
              </p>
            ) : (
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {filteredCTs.map(ct => {
                  const active = selectedCtIds.includes(ct.id)
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => toggleCt(ct.id)}
                      style={{
                        height: 28, padding: '0 11px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 11, fontWeight: 600, lineHeight: 1,
                        cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'var(--surface-2)',
                        color: active ? '#fff' : 'var(--ink-2)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {ct.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notas para la IA */}
          <div>
            <label className="section-label block mb-1.5">
              Notas e instrucciones (para la IA y los humanos)
            </label>
            <textarea
              rows={3}
              className="input"
              placeholder="Respetar paleta corporativa (naranja iGEO #EA580C). Logo abajo a la derecha. Mantener tipografía Inter…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={2000}
              style={{ resize: 'vertical', minHeight: 70 }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px',
              background: 'var(--red-soft)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--red-2)',
            }}>
              Error: {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 shrink-0" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary flex-1" onClick={() => !saving && onClose()} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-cta flex-1" disabled={!canSubmit} onClick={handleSubmit}>
            {saving
              ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Guardando…</>
              : isEdit ? 'Guardar cambios' : 'Subir plantilla'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lightbox: vista en detalle de la plantilla ──────────────────────────

function TemplateLightbox({
  template, contentTypes, onClose, onEdit,
}: {
  template: CreativeTemplateWithRefs
  contentTypes: ContentType[]
  onClose: () => void
  onEdit:  () => void
}) {
  // Cierre con tecla ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ctNames = contentTypes
    .filter(ct => template.content_type_ids.includes(ct.id))
    .map(ct => ct.name)
  const marketLabel = template.market
    ? MARKETS.find(m => m.value === template.market)?.label ?? template.market
    : 'Todos los mercados'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: 24 }}
    >
      {/* Backdrop oscuro */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor */}
      <div
        className="relative flex flex-col"
        style={{
          width: 'min(1200px, 95vw)',
          height: 'min(880px, 92vh)',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.32)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 15, fontWeight: 700, color: 'var(--ink)',
                margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em',
              }}
              className="truncate"
            >
              {template.name}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.3 }}>
              {CHANNEL_LABEL[template.channel]} · {template.asset_role}
              {template.width && template.height
                ? ` · ${template.width}×${template.height} px`
                : (template.aspect_ratio ? ` · ${template.aspect_ratio}` : '')}
              {' · '}{humanSize(template.file_size)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {template.signed_url && (
              <a
                href={template.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pill-secondary"
                style={{ height: 30, padding: '0 12px', fontSize: 11 }}
                title="Abrir el archivo original en una pestaña nueva"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Abrir original
              </a>
            )}
            {template.signed_url && (
              <a
                href={template.signed_url}
                download={template.name}
                className="btn-pill-secondary"
                style={{ height: 30, padding: '0 12px', fontSize: 11 }}
                title="Descargar archivo"
              >
                <Download size={12} aria-hidden="true" />
                Descargar
              </a>
            )}
            <button
              onClick={onEdit}
              className="btn-pill-secondary"
              style={{ height: 30, padding: '0 12px', fontSize: 11 }}
              title="Editar metadatos"
            >
              <Pencil size={12} aria-hidden="true" />
              Editar
            </button>
            <button
              onClick={onClose}
              className="image-menu-trigger"
              aria-label="Cerrar (Esc)"
              title="Cerrar (Esc)"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Imagen a tamaño completo + sidebar de metadatos */}
        <div className="flex flex-1" style={{ minHeight: 0 }}>
          {/* Imagen */}
          <div
            style={{
              flex: 1,
              background:
                'repeating-conic-gradient(rgba(0,0,0,0.05) 0% 25%, transparent 0% 50%) 50% / 24px 24px, var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24, overflow: 'auto',
            }}
          >
            {template.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.signed_url}
                alt={template.name}
                style={{
                  maxWidth: '100%', maxHeight: '100%',
                  objectFit: 'contain',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
                  borderRadius: 4,
                  display: 'block',
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2" style={{ color: 'var(--ink-3)' }}>
                <ImageIcon size={36} aria-hidden="true" />
                <p style={{ fontSize: 12, margin: 0 }}>Vista previa no disponible</p>
              </div>
            )}
          </div>

          {/* Sidebar metadatos */}
          <aside
            style={{
              width: 320,
              borderLeft: '1px solid var(--border)',
              padding: '18px 20px',
              overflow: 'auto',
              background: 'var(--surface)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            {template.description && (
              <Field label="Descripción">
                <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
                  {template.description}
                </p>
              </Field>
            )}

            <Field label="Mercado">
              <p style={{
                fontSize: 13, color: template.market ? 'var(--ink)' : 'var(--ink-3)',
                fontStyle: template.market ? 'normal' : 'italic',
                margin: 0,
              }}>
                {marketLabel}
              </p>
            </Field>

            <Field label="Aplica a tipos de canal">
              {ctNames.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic', margin: 0 }}>
                  Todos los tipos del canal
                </p>
              ) : (
                <div className="flex flex-wrap" style={{ gap: 4 }}>
                  {ctNames.map(name => (
                    <span
                      key={name}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-soft)',
                        border: '1px solid var(--accent-border)',
                        color: 'var(--accent-2)',
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </Field>

            {template.notes && (
              <Field label="Notas / instrucciones para la IA">
                <div
                  style={{
                    fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 10,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {template.notes}
                </div>
              </Field>
            )}

            <Field label="Detalles del archivo">
              <dl style={{ fontSize: 12, margin: 0, color: 'var(--ink-2)', display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 4 }}>
                <dt style={{ color: 'var(--ink-3)' }}>MIME</dt>
                <dd style={{ margin: 0 }}>{template.mime_type}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Tamaño</dt>
                <dd style={{ margin: 0 }}>{humanSize(template.file_size)}</dd>
                {template.width && template.height && (
                  <>
                    <dt style={{ color: 'var(--ink-3)' }}>Dimensiones</dt>
                    <dd style={{ margin: 0 }}>{template.width} × {template.height} px</dd>
                  </>
                )}
                {template.aspect_ratio && (
                  <>
                    <dt style={{ color: 'var(--ink-3)' }}>Proporción</dt>
                    <dd style={{ margin: 0 }}>{template.aspect_ratio}</dd>
                  </>
                )}
                <dt style={{ color: 'var(--ink-3)' }}>Estado</dt>
                <dd style={{ margin: 0, color: template.active ? 'var(--green-2)' : 'var(--ink-3)' }}>
                  {template.active ? 'Activa' : 'Inactiva'}
                </dd>
              </dl>
            </Field>
          </aside>
        </div>
      </div>
    </div>
  )
}

// Helper sencillo para las filas del sidebar — mantengo el style consistente con el resto del admin.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="uppercase"
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--ink-3)', margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}
