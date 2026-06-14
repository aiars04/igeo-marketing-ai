import type { Channel, SocialMentionHandles } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

/**
 * Normaliza un objeto de handles entrante: descarta claves no-Channel y trimea
 * los valores. Devuelve `{}` si nada válido.
 */
export function sanitizeHandles(raw: unknown): SocialMentionHandles {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: SocialMentionHandles = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!CHANNELS.includes(key as Channel)) continue
    if (typeof val !== 'string') continue
    const trimmed = val.trim()
    if (!trimmed) continue
    if (trimmed.length > 300) continue
    out[key as Channel] = trimmed
  }
  return out
}

/**
 * Convierte un handle (puede ser URL completa o @user o user) a una forma
 * "mencionable" en plano texto al pegar en el post.
 * - Si es URL → devuelve la URL tal cual.
 * - Si empieza por @ → tal cual.
 * - Si no → antepone @.
 *
 * Email/blog/newsletter no llevan @; los pasamos como están.
 */
export function formatHandleForInsert(channel: Channel, raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  // URLs y emails se pegan tal cual
  if (/^https?:\/\//i.test(v)) return v
  if (channel === 'email' && v.includes('@') && v.includes('.')) return v
  if (channel === 'blog' || channel === 'newsletter' || channel === 'email') return v
  return v.startsWith('@') ? v : `@${v}`
}
