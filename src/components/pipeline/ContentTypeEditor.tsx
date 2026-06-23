'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ContentItem } from '@/types/database'

interface ContentTypeOption {
  id:   string
  name: string
}

interface Props {
  item: ContentItem
  onUpdated?: (updated: ContentItem) => void
}

/**
 * Selector inline del subtipo de canal (content_type) del item.
 * Carga los content_types activos del canal del item; persiste vía
 * PATCH /api/content-items/:id { content_type_id }. Si el usuario
 * deja "Sin asignar" se manda null y el matcher cae al fallback
 * heurístico ("más reciente activo del canal").
 */
export function ContentTypeEditor({ item, onUpdated }: Props) {
  const [options, setOptions] = useState<ContentTypeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/content-types?channel=${encodeURIComponent(item.channel)}&active=true`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: ContentTypeOption[]) => {
        if (cancelled) return
        setOptions(Array.isArray(rows) ? rows.map(r => ({ id: r.id, name: r.name })) : [])
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof Error && e.name === 'AbortError')) return
        setOptions([])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [item.channel])

  const onChange = async (newId: string) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/content-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type_id: newId || null }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const updated = await res.json() as ContentItem
      onUpdated?.(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <span style={{ fontSize: 13, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Cargando…
      </span>
    )
  }

  if (options.length === 0) {
    return (
      <span style={{ fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>
        Sin subtipos para {item.channel}. Gestiona en Admin → Tipos de contenido.
      </span>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <select
        value={item.content_type_id ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={saving}
        aria-label="Tipo de contenido"
        style={{
          height: 30,
          padding: '0 10px',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--ink)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: saving ? 'wait' : 'pointer',
          minWidth: 180,
        }}
      >
        <option value="">— sin asignar —</option>
        {options.map(ct => (
          <option key={ct.id} value={ct.id}>{ct.name}</option>
        ))}
      </select>
      {saving && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
      {error && (
        <span style={{ fontSize: 11, color: '#b91c1c' }}>{error}</span>
      )}
    </div>
  )
}
