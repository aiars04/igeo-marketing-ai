import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { CalendarEvent, Profile } from '@/types/database'

const EVENT_TYPES = ['presential', 'digital'] as const

async function requireActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin }
}

// ── PATCH /api/calendar-events/[id] ──────────────────────────────────
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: Partial<CalendarEvent>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const { data: target } = await admin
    .from('calendar_events')
    .select('id, created_by')
    .eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = String(body.title).trim()
  if (body.description !== undefined) patch.description = body.description
  if (body.start_time !== undefined) {
    const d = new Date(body.start_time)
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_start_time' }, { status: 400 })
    patch.start_time = d.toISOString()
  }
  if (body.end_time !== undefined) {
    const d = new Date(body.end_time)
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'invalid_end_time' }, { status: 400 })
    patch.end_time = d.toISOString()
  }
  // Si el patch trae ambas fechas, validar que start <= end
  if (patch.start_time && patch.end_time && new Date(patch.start_time as string) > new Date(patch.end_time as string)) {
    return NextResponse.json({ error: 'start_after_end' }, { status: 400 })
  }
  if (body.all_day !== undefined) patch.all_day = !!body.all_day
  if (body.color !== undefined) patch.color = body.color
  if (body.category !== undefined) patch.category = body.category
  if (body.tags !== undefined) patch.tags = Array.isArray(body.tags) ? body.tags : []
  if (body.event_type !== undefined) {
    if (body.event_type !== null && !EVENT_TYPES.includes(body.event_type as typeof EVENT_TYPES[number])) {
      return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 })
    }
    patch.event_type = body.event_type
  }
  if (body.location !== undefined) patch.location = body.location
  if (body.channel !== undefined) patch.channel = body.channel
  if (body.market !== undefined) patch.market = body.market

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('calendar_events')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single<CalendarEvent>()
  if (error) {
    console.error('[calendar-events/PATCH] failed:', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// ── DELETE /api/calendar-events/[id] ─────────────────────────────────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('calendar_events')
    .select('id, created_by')
    .eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Antes de borrar el evento, desvincular cualquier content_item que se haya
  // creado desde él (calendar_item_id = id del evento). Si no lo hacemos:
  //   - el content_item queda huérfano apuntando a un evento inexistente, y
  //   - el índice único parcial sobre calendar_item_id ENVENENA el dedup:
  //     re-crear el mismo evento daría 409 contra un item fantasma.
  // No borramos el content_item (puede tener trabajo hecho); solo soltamos el
  // vínculo. Best-effort: si falla, seguimos con el borrado del evento.
  const { error: unlinkErr } = await admin
    .from('content_items')
    .update({ calendar_item_id: null } as never)
    .eq('calendar_item_id', id)
  if (unlinkErr) {
    console.warn('[calendar-events/DELETE] no se pudo desvincular content_items:', unlinkErr.message)
  }

  const { error } = await admin.from('calendar_events').delete().eq('id', id)
  if (error) {
    console.error('[calendar-events/DELETE] failed:', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
