'use client'

/**
 * Repositorio de menciones sociales — admin.
 * Cada entrada tiene un nombre + handles por canal. Desde el pipeline
 * se podrán insertar al redactar contenido (botón "@ Mencionar").
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, AtSign, Loader2, X, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Channel, SocialMention, SocialMentionHandles } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  x: 'X / Twitter', blog: 'Blog', email: 'Email', newsletter: 'Newsletter',
}

interface Props {
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const EMPTY_FORM = {
  name: '',
  description: '',
  handles: {} as SocialMentionHandles,
  tagsText: '',
  active: true,
}

export function MentionsTab({ toast }: Props) {
  const [items, setItems] = useState<SocialMention[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SocialMention | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mentions')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const data = await res.json() as SocialMention[]
      setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [toast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (m: SocialMention) => { setEditTarget(m); setModalOpen(true) }

  const handleToggle = async (m: SocialMention) => {
    const res = await fetch(`/api/mentions/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    })
    if (res.ok) {
      const updated = await res.json() as SocialMention
      setItems(p => p.map(x => x.id === m.id ? updated : x))
      toast(updated.active ? 'Activado' : 'Desactivado', 'success')
    } else {
      const j = await res.json().catch(() => ({}))
      toast(`Error: ${j.error ?? res.statusText}`, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/mentions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(p => p.filter(x => x.id !== id))
      toast('Mención eliminada', 'success')
    } else {
      const j = await res.json().catch(() => ({}))
      toast(`Error: ${j.error ?? res.statusText}`, 'error')
    }
    setDeleteConfirm(null)
  }

  const handleSave = async (payload: {
    name: string; description: string; handles: SocialMentionHandles; tags: string[]; active: boolean
  }) => {
    if (editTarget) {
      const res = await fetch(`/api/mentions/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? res.statusText)
      }
      const updated = await res.json() as SocialMention
      setItems(p => p.map(x => x.id === editTarget.id ? updated : x))
      toast('Mención actualizada', 'success')
    } else {
      const res = await fetch('/api/mentions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? res.statusText)
      }
      const created = await res.json() as SocialMention
      setItems(p => [created, ...p])
      toast('Mención creada', 'success')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col" style={{ gap: 18 }}>
      {/* Header del tab */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div style={{ maxWidth: 640 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Menciones por red social
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0', lineHeight: 1.5 }}>
            Guarda perfiles de clientes, partners e influencers con su handle por canal. Aparecerán
            como sugerencias al escribir un post.
          </p>
        </div>
        <button className="btn-cta" onClick={openCreate}>
          <Plus size={13} aria-hidden="true" /> Nueva mención
        </button>
      </div>

      {/* Buscador */}
      <div className="relative" style={{ maxWidth: 360 }}>
        <Search
          size={14}
          aria-hidden="true"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o descripción…"
          className="input"
          style={{ height: 36, padding: '0 12px 0 34px', fontSize: 13 }}
        />
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
            <AtSign size={22} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              {items.length === 0 ? 'Sin menciones aún' : 'Sin resultados'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0' }}>
              {items.length === 0
                ? 'Crea la primera para empezar a mencionar perfiles en tus posts'
                : 'Prueba con otro término de búsqueda'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: 14 }}>
          {filtered.map(m => (
            <MentionCard
              key={m.id}
              mention={m}
              onEdit={() => openEdit(m)}
              onToggle={() => handleToggle(m)}
              onDelete={() => setDeleteConfirm(m.id)}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <MentionFormModal
        key={editTarget?.id ?? 'new'}
        open={modalOpen}
        initial={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      {/* Confirmación delete */}
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
              <h3 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>¿Eliminar mención?</h3>
              <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                Se eliminará <strong style={{ color: 'var(--ink)' }}>{items.find(m => m.id === deleteConfirm)?.name}</strong>.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="btn-destructive flex-1" onClick={() => handleDelete(deleteConfirm)}>
                <Trash2 size={13} aria-hidden="true" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tarjeta de mención ──────────────────────────────────────────────────

function MentionCard({
  mention, onEdit, onToggle, onDelete,
}: {
  mention: SocialMention
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const channelsWithHandle = CHANNELS.filter(ch => {
    const v = mention.handles?.[ch]
    return typeof v === 'string' && v.trim().length > 0
  })

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        opacity: mention.active ? 1 : 0.55,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)' }}
          >
            <AtSign size={14} aria-hidden="true" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1.3 }} className="truncate">
              {mention.name}
            </p>
            {mention.description && (
              <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.4 }} className="line-clamp-1">
                {mention.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onToggle}
            className="admin-card-action admin-card-action-toggle"
            title={mention.active ? 'Desactivar' : 'Activar'}
            aria-label={mention.active ? 'Desactivar' : 'Activar'}
          >
            {mention.active
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

      {/* Handles por canal */}
      {channelsWithHandle.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', margin: 0 }}>
          Sin handles configurados
        </p>
      ) : (
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {channelsWithHandle.map(ch => (
            <span
              key={ch}
              className="inline-flex items-center"
              style={{
                height: 22,
                padding: '0 8px',
                gap: 5,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--ink-2)',
                lineHeight: 1,
                maxWidth: 180,
              }}
              title={mention.handles[ch]}
            >
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{CHANNEL_LABELS[ch]}</strong>
              <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(mention.handles[ch] ?? '').slice(0, 28)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Tags */}
      {mention.tags.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {mention.tags.map(t => (
            <span
              key={t}
              style={{
                height: 18,
                padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                border: '1px solid var(--border)',
                fontSize: 10,
                color: 'var(--ink-3)',
                fontWeight: 600,
                lineHeight: '18px',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal crear / editar ────────────────────────────────────────────────

function MentionFormModal({
  open, initial, onClose, onSave,
}: {
  open: boolean
  initial: SocialMention | null
  onClose: () => void
  onSave: (payload: {
    name: string; description: string; handles: SocialMentionHandles; tags: string[]; active: boolean
  }) => Promise<void>
}) {
  const [form, setForm] = useState(() => initial ? {
    name: initial.name,
    description: initial.description ?? '',
    handles: { ...initial.handles },
    tagsText: initial.tags.join(', '),
    active: initial.active,
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync con prop cuando se abre/cambia el target
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(initial ? {
      name: initial.name,
      description: initial.description ?? '',
      handles: { ...initial.handles },
      tagsText: initial.tags.join(', '),
      active: initial.active,
    } : EMPTY_FORM)
    setError(null)
  }, [initial, open])

  if (!open) return null

  const canSave = form.name.trim().length >= 2 && !saving

  const setHandle = (ch: Channel, val: string) => {
    setForm(p => ({ ...p, handles: { ...p.handles, [ch]: val } }))
  }

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)
    try {
      const tags = form.tagsText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const handles: SocialMentionHandles = {}
      for (const ch of CHANNELS) {
        const v = (form.handles[ch] ?? '').trim()
        if (v) handles[ch] = v
      }
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        handles,
        tags,
        active: form.active,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={() => !saving && onClose()}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden flex flex-col"
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
            {initial ? 'Editar mención' : 'Nueva mención'}
          </h2>
          <button onClick={() => !saving && onClose()} className="image-menu-trigger" aria-label="Cerrar">
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 flex flex-col" style={{ padding: 24, gap: 16 }}>
          <div>
            <label className="section-label block mb-1.5">Nombre</label>
            <input
              autoFocus
              className="input"
              placeholder="Cliente Acme — Juan Pérez"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="section-label block mb-1.5">Descripción (opcional)</label>
            <textarea
              rows={2}
              className="input"
              placeholder="CEO de Acme · cliente clave Q3"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </div>

          <div>
            <label className="section-label block mb-1.5">Handles por canal</label>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
              Pega el @ user, la URL completa o el identificador. Se mostrarán solo los canales con valor.
            </p>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {CHANNELS.map(ch => (
                <div key={ch} className="flex items-center gap-2">
                  <span
                    style={{
                      width: 92,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--ink-2)',
                      flexShrink: 0,
                    }}
                  >
                    {CHANNEL_LABELS[ch]}
                  </span>
                  <input
                    className="input"
                    placeholder={
                      ch === 'linkedin' ? 'https://linkedin.com/in/usuario'
                      : ch === 'email' ? 'nombre@empresa.com'
                      : ch === 'blog' ? 'https://blog.empresa.com/autor'
                      : ch === 'newsletter' ? 'autor@newsletter.com'
                      : '@usuario'
                    }
                    value={form.handles[ch] ?? ''}
                    onChange={e => setHandle(ch, e.target.value)}
                    style={{ flex: 1, height: 32, fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="section-label block mb-1.5">Tags (opcional)</label>
            <input
              className="input"
              placeholder="cliente, partner, influencer"
              value={form.tagsText}
              onChange={e => setForm(p => ({ ...p, tagsText: e.target.value }))}
            />
            <p style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
              Separa por comas. Útil para filtrar más adelante.
            </p>
          </div>

          <label className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
            />
            Activa (visible en el picker del pipeline)
          </label>

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
          <button className="btn-cta flex-1" disabled={!canSave} onClick={handleSubmit}>
            {saving
              ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Guardando…</>
              : initial ? 'Guardar cambios' : 'Crear mención'}
          </button>
        </div>
      </div>
    </div>
  )
}
