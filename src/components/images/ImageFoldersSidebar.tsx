'use client'

import { useState } from 'react'
import {
  FolderClosed, Plus, Loader2, X, Check, Pencil, Trash2,
  Mail, FileText, AtSign, Hash,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { Channel } from '@/types/database'

export interface FolderWithCount {
  id: string
  name: string
  channel: Channel | null
  system: boolean
  color: string | null
  icon: string | null
  asset_count: number
}

// Mapeo de string `icon` (BD) a icon component lucide.
// Solo usamos los neutrales — lucide no tiene los logos de marca.
const ICON_MAP: Record<string, typeof FolderClosed> = {
  Mail, FileText, AtSign, Hash,
}

const COLOR_SWATCHES = [
  { value: '#0071e3', name: 'Azul' },
  { value: '#e8388c', name: 'Rosa' },
  { value: '#34c759', name: 'Verde' },
  { value: '#ff9f0a', name: 'Naranja' },
  { value: '#af52de', name: 'Morado' },
  { value: '#6e6e73', name: 'Gris' },
]

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'linkedin',   label: 'LinkedIn' },
  { value: 'instagram',  label: 'Instagram' },
  { value: 'facebook',   label: 'Facebook' },
  { value: 'x',          label: 'X (Twitter)' },
  { value: 'blog',       label: 'Blog' },
  { value: 'email',      label: 'Email' },
  { value: 'newsletter', label: 'Newsletter' },
]

export function ImageFoldersSidebar({
  folders,
  totalCount,
  uncategorizedCount,
  selectedFolder,
  onSelect,
  onFoldersChange,
  canManage,
  showError,
}: {
  folders: FolderWithCount[]
  totalCount: number
  uncategorizedCount: number
  selectedFolder: string | null
  onSelect: (folderId: string | null) => void
  onFoldersChange: () => void
  canManage: boolean
  showError: (msg: string) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newChannel, setNewChannel] = useState<Channel | ''>('')
  const [newColor, setNewColor] = useState<string>(COLOR_SWATCHES[0].value)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const systemFolders = folders.filter(f => f.system)
  const customFolders = folders.filter(f => !f.system)

  const handleCreate = async () => {
    const n = newName.trim()
    if (n.length < 2) return showError('El nombre debe tener al menos 2 caracteres')
    setCreating(true)
    try {
      const res = await fetch('/api/image-folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: n,
          channel: newChannel || null,
          color: newColor,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showError(`Error: ${j.error ?? res.statusText}`)
        return
      }
      setCreateOpen(false)
      setNewName('')
      setNewChannel('')
      setNewColor(COLOR_SWATCHES[0].value)
      onFoldersChange()
    } finally {
      setCreating(false)
    }
  }

  const handleRename = async (folderId: string) => {
    const n = editName.trim()
    if (n.length < 2) return showError('Nombre demasiado corto')
    setSavingId(folderId)
    const res = await fetch(`/api/image-folders/${folderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    })
    setSavingId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showError(`Error: ${j.error ?? res.statusText}`)
      return
    }
    setEditingId(null)
    setEditName('')
    onFoldersChange()
  }

  const handleDelete = async (folderId: string) => {
    setSavingId(folderId)
    const res = await fetch(`/api/image-folders/${folderId}`, { method: 'DELETE' })
    setSavingId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showError(`Error: ${j.error ?? res.statusText}`)
      return
    }
    setConfirmDeleteId(null)
    // Si la carpeta borrada era la activa, volver a "Todas"
    if (selectedFolder === folderId) onSelect(null)
    onFoldersChange()
  }

  return (
    <>
      <aside
        style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '16px 10px 8px' }}>
          {/* Item Todas */}
          <SidebarItem
            label="Todas las imágenes"
            count={totalCount}
            icon={<FolderClosed size={14} aria-hidden="true" />}
            color={null}
            active={selectedFolder === null}
            onClick={() => onSelect(null)}
          />
        </div>

        {/* POR CANAL */}
        <div style={{ padding: '4px 10px' }}>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--ink-3)',
            padding: '12px 8px 8px',
          }}>
            Por canal
          </p>
          <div className="flex flex-col gap-1">
            {systemFolders.map(f => {
              const Icon: typeof FolderClosed = (f.icon ? ICON_MAP[f.icon] : undefined) ?? FolderClosed
              return (
                <SidebarItem
                  key={f.id}
                  label={f.name}
                  count={f.asset_count}
                  icon={<Icon size={14} aria-hidden="true" />}
                  color={f.color}
                  active={selectedFolder === f.id}
                  onClick={() => onSelect(f.id)}
                />
              )
            })}
            <SidebarItem
              label="Sin clasificar"
              count={uncategorizedCount}
              icon={<FolderClosed size={14} aria-hidden="true" style={{ opacity: 0.6 }} />}
              color={null}
              active={selectedFolder === 'uncategorized'}
              onClick={() => onSelect('uncategorized')}
              muted
            />
          </div>
        </div>

        {/* CUSTOM */}
        <div style={{ padding: '4px 10px 16px' }}>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--ink-3)',
            padding: '18px 8px 8px',
          }}>
            Custom
          </p>
          <div className="flex flex-col gap-1">
            {customFolders.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 8px', lineHeight: 1.4 }}>
                Sin carpetas custom todavía
              </p>
            )}
            {customFolders.map(f => {
              const isEditing = editingId === f.id
              const isConfirmDel = confirmDeleteId === f.id
              if (isEditing) {
                return (
                  <div key={f.id} className="flex items-center gap-1" style={{ padding: '4px 8px' }}>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(f.id)
                        if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                      }}
                      className="input"
                      style={{ height: 26, fontSize: 12, padding: '0 8px', flex: 1 }}
                      disabled={savingId === f.id}
                    />
                    <button
                      onClick={() => handleRename(f.id)}
                      disabled={savingId === f.id}
                      style={{
                        width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                        border: 'none', background: 'var(--accent)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      aria-label="Guardar"
                    >
                      {savingId === f.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                  </div>
                )
              }
              return (
                <div key={f.id} className="group relative">
                  {isConfirmDel ? (
                    <div
                      className="flex items-center gap-1"
                      style={{ padding: '4px 8px', background: 'var(--red-soft)', borderRadius: 'var(--radius-sm)' }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--red-2)', flex: 1 }}>¿Borrar?</span>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-2)' }}
                        aria-label="Cancelar"
                      >
                        <X size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        disabled={savingId === f.id}
                        style={{ width: 22, height: 22, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--red-2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label="Confirmar borrar"
                      >
                        {savingId === f.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  ) : (
                    <>
                      <SidebarItem
                        label={f.name}
                        count={f.asset_count}
                        icon={<FolderClosed size={14} aria-hidden="true" />}
                        color={f.color}
                        active={selectedFolder === f.id}
                        onClick={() => onSelect(f.id)}
                      />
                      {canManage && (
                        <div
                          className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => { setEditingId(f.id); setEditName(f.name) }}
                            style={{
                              width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                              border: 'none', background: 'var(--surface)',
                              color: 'var(--ink-2)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            aria-label="Renombrar"
                            title="Renombrar"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(f.id)}
                            style={{
                              width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                              border: 'none', background: 'var(--surface)',
                              color: 'var(--red-2)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            aria-label="Borrar"
                            title="Borrar"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {canManage && (
              <button
                onClick={() => setCreateOpen(true)}
                style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: 'var(--accent-2)',
                  background: 'transparent', border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  width: '100%', textAlign: 'left',
                }}
              >
                <Plus size={12} aria-hidden="true" /> Nueva carpeta
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Modal nueva carpeta */}
      <Modal open={createOpen} onClose={() => { if (!creating) setCreateOpen(false) }} title="Nueva carpeta" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <span className="section-label block mb-1.5">Nombre</span>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Ej: Campaña Q3 2026"
              className="input"
            />
          </div>
          <div>
            <span className="section-label block mb-1.5">Canal (opcional)</span>
            <select
              value={newChannel}
              onChange={e => setNewChannel((e.target.value || '') as Channel | '')}
              className="input"
            >
              <option value="">— Sin canal específico —</option>
              {CHANNEL_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <span className="section-label block mb-1.5">Color</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_SWATCHES.map(c => {
                const active = newColor === c.value
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewColor(c.value)}
                    aria-label={c.name}
                    title={c.name}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: c.value,
                      border: `2px solid ${active ? 'var(--ink)' : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'transform 0.12s ease',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                )
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setCreateOpen(false)} className="btn-secondary flex-1" disabled={creating}>
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={creating || newName.trim().length < 2} className="btn-cta flex-1">
              {creating
                ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Creando…</>
                : <><Plus size={13} aria-hidden="true" /> Crear carpeta</>}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── SidebarItem ─────────────────────────────────────────────────────────────

function SidebarItem({
  label, count, icon, color, active, onClick, muted,
}: {
  label: string
  count: number
  icon: React.ReactNode
  color: string | null
  active: boolean
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        width: '100%',
        textAlign: 'left',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: active ? 'var(--accent-soft)' : 'transparent',
        borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--accent-2)' : (muted ? 'var(--ink-3)' : 'var(--ink-2)'),
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span
        className="shrink-0 inline-flex items-center justify-center"
        style={{
          width: 22, height: 22, borderRadius: 'var(--radius-sm)',
          background: color ?? 'var(--surface-2)',
          color: color ? '#fff' : 'var(--ink-2)',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span
        className="tabular-nums shrink-0"
        style={{
          fontSize: 11, fontWeight: 600,
          color: active ? 'var(--accent-2)' : 'var(--ink-3)',
        }}
      >
        {count}
      </span>
    </button>
  )
}
