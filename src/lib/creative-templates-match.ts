/**
 * Matching de plantillas maestras (creative_templates) contra un content_item.
 *
 * Se reutiliza desde:
 *   - /api/images/generate     → para pasar las plantillas como input visual a Nano Banana
 *   - /api/content-items/[id]/generate → para inyectar metadatos en el prompt de texto
 *
 * La lógica de matching es idéntica en ambos casos. Lo que cambia es qué se
 * hace después con el resultado (descargar archivo / leer metadatos).
 *
 * Criterios:
 *   - channel = item.channel
 *   - market  = item.market O market IS NULL (las que aplican a todos)
 *   - active  = true
 *   - content_type: si la plantilla NO tiene filas pivote → aplica a TODOS los
 *     content_types del canal. Si tiene → solo a los enlazados. El "content_type
 *     activo" del canal es el más reciente con active=true.
 *
 * Devuelve max `cap` resultados (default 5), ordenados por created_at desc.
 */

import type { Channel, ContentItem, CreativeTemplate } from '@/types/database'
import type { createAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

const DEFAULT_CAP = 5

export interface TemplateMatchResult {
  templates:  CreativeTemplate[]
  /** Notas formateadas (rol — nombre: notas) listas para meter en prompts. */
  promptNotes: string[]
  /** ID del content_type activo del canal, si se encontró. Útil para logs. */
  activeContentTypeId: string | null
}

export async function matchTemplatesForItem(
  admin: AdminClient,
  contentItemId: string,
  fallbackChannel: string | null,
  options: { cap?: number } = {},
): Promise<TemplateMatchResult> {
  const cap = options.cap ?? DEFAULT_CAP

  // Cargar item para conocer channel + market
  const { data: item } = await admin
    .from('content_items')
    .select('id, channel, market')
    .eq('id', contentItemId)
    .single<Pick<ContentItem, 'id' | 'channel' | 'market'>>()

  const channel = ((item?.channel ?? fallbackChannel) ?? '') as Channel
  if (!channel) return { templates: [], promptNotes: [], activeContentTypeId: null }
  const market = item?.market ?? null

  // content_type activo del canal (1)
  let activeContentTypeId: string | null = null
  if (item) {
    const { data: ctRows } = await admin
      .from('content_types')
      .select('id')
      .eq('channel', channel).eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (ctRows && ctRows.length > 0) {
      activeContentTypeId = (ctRows[0] as { id: string }).id
    }
  }

  // Query base: canal + activa + (mercado del item O global)
  let q = admin
    .from('creative_templates')
    .select('*')
    .eq('channel', channel)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(50)
  if (market) q = q.or(`market.eq.${market},market.is.null`)
  else q = q.is('market', null)

  const { data: candidates } = await q.returns<CreativeTemplate[]>()
  if (!candidates || candidates.length === 0) {
    return { templates: [], promptNotes: [], activeContentTypeId }
  }

  // Filtrado por content_type via pivote
  const ids = candidates.map(c => c.id)
  const { data: pivotRows } = await admin
    .from('creative_template_content_types')
    .select('template_id, content_type_id')
    .in('template_id', ids)
    .returns<Array<{ template_id: string; content_type_id: string }>>()

  const pivoteByTemplate = new Map<string, string[]>()
  for (const p of pivotRows ?? []) {
    const arr = pivoteByTemplate.get(p.template_id) ?? []
    arr.push(p.content_type_id)
    pivoteByTemplate.set(p.template_id, arr)
  }

  // Contrato: sin pivote = aplica a todos. Con pivote = solo a enlazados.
  const filtered = candidates.filter(t => {
    const linked = pivoteByTemplate.get(t.id)
    if (!linked || linked.length === 0) return true
    if (!activeContentTypeId) return false
    return linked.includes(activeContentTypeId)
  })

  const picked = filtered.slice(0, cap)
  const promptNotes = picked.map(t => {
    const role  = t.asset_role || 'plantilla'
    const dims  = t.width && t.height ? ` ${t.width}×${t.height}` : ''
    const ratio = t.aspect_ratio ? ` ${t.aspect_ratio}` : ''
    const noteTxt = t.notes ? `: ${t.notes}` : ''
    return `[${role}${dims}${ratio} — ${t.name}]${noteTxt}`
  })

  return { templates: picked, promptNotes, activeContentTypeId }
}
