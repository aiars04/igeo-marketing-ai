import { NextRequest, NextResponse } from 'next/server'
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

// ── POST /api/calendar-events/bulk ────────────────────────────────────
// Usado para importar CSV o migrar eventos de localStorage de una sola vez.
// Body: { events: Partial<CalendarEvent>[] }
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: { events?: Partial<CalendarEvent>[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const events = body.events
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events_required' }, { status: 400 })
  }
  if (events.length > 500) {
    return NextResponse.json({ error: 'too_many_events_max_500' }, { status: 400 })
  }

  const rows: Record<string, unknown>[] = []
  const errors: { index: number; error: string }[] = []

  events.forEach((ev, idx) => {
    const title = (ev.title ?? '').toString().trim()
    if (!title) { errors.push({ index: idx, error: 'title_required' }); return }
    if (!ev.start_time) { errors.push({ index: idx, error: 'start_time_required' }); return }
    if (!ev.end_time)   { errors.push({ index: idx, error: 'end_time_required' }); return }

    const startDate = new Date(ev.start_time)
    const endDate = new Date(ev.end_time)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push({ index: idx, error: 'invalid_dates' }); return
    }

    const eventType = ev.event_type ?? null
    if (eventType && !EVENT_TYPES.includes(eventType as typeof EVENT_TYPES[number])) {
      errors.push({ index: idx, error: 'invalid_event_type' }); return
    }

    rows.push({
      title,
      description: ev.description ?? null,
      start_time:  startDate.toISOString(),
      end_time:    endDate.toISOString(),
      all_day:     !!ev.all_day,
      color:       ev.color ?? 'blue',
      category:    ev.category ?? null,
      tags:        Array.isArray(ev.tags) ? ev.tags : [],
      event_type:  eventType,
      location:    eventType === 'presential' ? (ev.location ?? null) : null,
      channel:     eventType === 'digital'    ? (ev.channel  ?? null) : null,
      market:      eventType === 'digital'    ? (ev.market   ?? null) : null,
      created_by:  me.id,
    })
  })

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, errors }, { status: 400 })
  }

  const { data, error } = await admin
    .from('calendar_events')
    .insert(rows as never)
    .select('*')
    .returns<CalendarEvent[]>()
  if (error) {
    console.error('[calendar-events/bulk] failed:', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json({ inserted: data?.length ?? 0, events: data ?? [], errors })
}
