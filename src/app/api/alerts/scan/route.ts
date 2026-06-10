import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Alert, AlertLevel, AlertType, ContentItem, Profile,
} from '@/types/database'

/**
 * POST /api/alerts/scan
 *
 * Revisa todos los content_items próximos a publicar y crea/resuelve alertas.
 *
 * Reglas implementadas:
 *  - missing_copy:     scheduled_at < now+10d, sin content
 *  - missing_image:    stage in (design, scheduled), scheduled_at < now+10d, sin imagen asignada
 *  - missing_approval: scheduled_at < now+7d, sin human_approved
 *
 * Niveles:
 *  - critical: due_at < now+3d
 *  - warning:  due_at < now+7d
 *  - info:     resto
 *
 * Dedup: para cada (related_content_item_id, type) sólo una alerta activa.
 * Auto-resolve: si la condición ya no se cumple, marca la alerta como resuelta.
 */

const WARNING_WINDOW_DAYS = 10
const CRITICAL_WINDOW_DAYS = 3
const APPROVAL_WINDOW_DAYS = 7

interface RuleResult {
  type: AlertType
  level: AlertLevel
  title: string
  description: string
  related_content_item_id: string
  related_package_id: string | null
  due_at: string
}

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000)
}

function pickLevel(daysAhead: number): AlertLevel {
  if (daysAhead < CRITICAL_WINDOW_DAYS) return 'critical'
  if (daysAhead < APPROVAL_WINDOW_DAYS) return 'warning'
  return 'info'
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 1) Cargar items relevantes: con scheduled_at no nulo, no publicados aún
  const nowIso = new Date().toISOString()
  const horizonIso = new Date(Date.now() + WARNING_WINDOW_DAYS * 86400000).toISOString()

  const itemsResult = await admin
    .from('content_items')
    .select('*')
    .not('scheduled_at', 'is', null)
    .is('published_at', null)
    .gte('scheduled_at', nowIso)
    .lte('scheduled_at', horizonIso)
    .returns<ContentItem[]>()
  if (itemsResult.error) {
    console.error('[alerts/scan] items load failed:', itemsResult.error.message)
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 })
  }
  const items: ContentItem[] = itemsResult.data ?? []

  // 2) Cargar imágenes asignadas (para detectar missing_image)
  const itemIds = items.map(i => i.id)
  const imageByItem = new Set<string>()
  if (itemIds.length > 0) {
    const { data: assets } = await admin
      .from('content_assets')
      .select('content_item_id')
      .in('content_item_id', itemIds)
      .returns<{ content_item_id: string }[]>()
    for (const a of assets ?? []) {
      if (a.content_item_id) imageByItem.add(a.content_item_id)
    }
  }

  // 3) Evaluar reglas → lista de RuleResult
  const desired: RuleResult[] = []
  for (const item of items) {
    if (!item.scheduled_at) continue
    const days = daysUntil(item.scheduled_at)
    const level = pickLevel(days)
    const itemTitle = item.title.length > 80 ? item.title.slice(0, 77) + '…' : item.title

    // Regla 1: missing_copy
    const hasContent = !!(item.content && item.content.trim().length > 0)
    if (!hasContent) {
      desired.push({
        type: 'missing_copy',
        level,
        title: `Falta copy: ${itemTitle}`,
        description: `Programado para ${new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} (${days} día${days === 1 ? '' : 's'}). No tiene contenido generado todavía.`,
        related_content_item_id: item.id,
        related_package_id: item.package_id,
        due_at: item.scheduled_at,
      })
    }

    // Regla 2: missing_image (solo en design/scheduled)
    if ((item.stage === 'design' || item.stage === 'scheduled') && !imageByItem.has(item.id)) {
      desired.push({
        type: 'missing_image',
        level,
        title: `Falta imagen: ${itemTitle}`,
        description: `Pieza en stage ${item.stage} programada para ${new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}. Sin imagen asignada.`,
        related_content_item_id: item.id,
        related_package_id: item.package_id,
        due_at: item.scheduled_at,
      })
    }

    // Regla 3: missing_approval (sólo si está cerca: < APPROVAL_WINDOW)
    if (!item.human_approved && days < APPROVAL_WINDOW_DAYS) {
      desired.push({
        type: 'missing_approval',
        level: days < CRITICAL_WINDOW_DAYS ? 'critical' : 'warning',
        title: `Sin aprobar: ${itemTitle}`,
        description: `Programado para ${new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} (${days} día${days === 1 ? '' : 's'}). No tiene aprobación humana.`,
        related_content_item_id: item.id,
        related_package_id: item.package_id,
        due_at: item.scheduled_at,
      })
    }
  }

  // 4) Cargar alertas existentes (activas) y dedup
  const { data: existing } = await admin
    .from('alerts')
    .select('id, type, related_content_item_id, level')
    .eq('resolved', false)
    .returns<Pick<Alert, 'id' | 'type' | 'related_content_item_id' | 'level'>[]>()

  const existingByKey = new Map<string, { id: string; level: AlertLevel }>()
  for (const e of existing ?? []) {
    if (e.related_content_item_id) {
      existingByKey.set(`${e.type}:${e.related_content_item_id}`, { id: e.id, level: e.level })
    }
  }

  // 5) Insertar nuevas o actualizar nivel si cambió
  const toInsert: Omit<RuleResult, never>[] = []
  const toUpdate: { id: string; level: AlertLevel }[] = []
  const desiredKeys = new Set<string>()

  for (const d of desired) {
    const key = `${d.type}:${d.related_content_item_id}`
    desiredKeys.add(key)
    const ex = existingByKey.get(key)
    if (!ex) {
      toInsert.push(d)
    } else if (ex.level !== d.level) {
      toUpdate.push({ id: ex.id, level: d.level })
    }
  }

  // 6) Auto-resolve: alertas existentes que ya no aplican
  const toResolve: string[] = []
  for (const [key, ex] of existingByKey) {
    if (!desiredKeys.has(key)) {
      toResolve.push(ex.id)
    }
  }

  // 7) Ejecutar en bloque
  let inserted = 0, updated = 0, resolved = 0
  if (toInsert.length > 0) {
    const { error } = await admin
      .from('alerts')
      .insert(toInsert.map(r => ({
        type: r.type,
        level: r.level,
        title: r.title,
        description: r.description,
        related_content_item_id: r.related_content_item_id,
        related_package_id: r.related_package_id,
        due_at: r.due_at,
        resolved: false,
      })) as never)
    if (error) console.error('[alerts/scan] insert failed:', error.message)
    else inserted = toInsert.length
  }

  for (const u of toUpdate) {
    const { error } = await admin
      .from('alerts').update({ level: u.level } as never).eq('id', u.id)
    if (!error) updated++
  }

  if (toResolve.length > 0) {
    const { error } = await admin
      .from('alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: profile.id } as never)
      .in('id', toResolve)
    if (!error) resolved = toResolve.length
  }

  return NextResponse.json({
    scanned_items: items.length,
    inserted,
    updated,
    auto_resolved: resolved,
    total_active: desired.length,
  })
}
