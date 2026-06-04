/**
 * Content types store — respaldado por Supabase via /api/content-types
 * (antes localStorage 'igeo_content_types_v1'). Mantiene la misma API
 * surface que /admin consume para minimizar cambios.
 */
import { useState, useEffect, useCallback } from 'react'
import type { Channel, ContentType as DbContentType } from '@/types/database'

/* ─── Type usado por /admin (mismo shape que antes, snake_case BD ↔ alias camelCase) ─── */
export type ContentType = {
  id: string
  name: string
  channel: Channel
  description: string
  process: string
  style: string
  active: boolean
  createdAt: string   // alias camelCase de created_at (no rompe /admin)
}

function fromDb(db: DbContentType): ContentType {
  return {
    id: db.id,
    name: db.name,
    channel: db.channel,
    description: db.description,
    process: db.process,
    style: db.style,
    active: db.active,
    createdAt: (db.created_at ?? '').slice(0, 10),
  }
}

/* ─── Defaults (fallback solo si la API falla) ─── */
export const DEFAULT_CONTENT_TYPES: ContentType[] = []

/* ─── Hook ─── */
export function useContentTypes() {
  const [types, setTypes] = useState<ContentType[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Carga inicial desde API
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/content-types')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as DbContentType[]
        if (!cancelled) setTypes(data.map(fromDb))
      } catch (e) {
        console.error('Error loading content types:', e)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const add = useCallback(async (t: Omit<ContentType, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/content-types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: t.name, channel: t.channel,
        description: t.description, process: t.process, style: t.style,
        active: t.active,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? res.statusText)
    }
    const created = await res.json() as DbContentType
    setTypes(prev => [...prev, fromDb(created)])
  }, [])

  const update = useCallback(async (id: string, changes: Partial<Omit<ContentType, 'id' | 'createdAt'>>) => {
    const res = await fetch(`/api/content-types/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? res.statusText)
    }
    const updated = await res.json() as DbContentType
    setTypes(prev => prev.map(t => t.id === id ? fromDb(updated) : t))
  }, [])

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/content-types/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error ?? res.statusText)
    }
    setTypes(prev => prev.filter(t => t.id !== id))
  }, [])

  const toggle = useCallback(async (id: string) => {
    const t = types.find(x => x.id === id)
    if (!t) return
    await update(id, { active: !t.active })
  }, [types, update])

  return { types, add, update, remove, toggle, hydrated }
}
