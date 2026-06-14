import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { CalendarEvent, Market, Channel, Profile } from '@/types/database'

const EVENT_TYPES = ['presential', 'digital'] as const
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

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

// ── GET /api/calendar-events ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to   = url.searchParams.get('to')
  const reqLimit = Number(url.searchParams.get('limit') ?? 500)
  const limit = Math.min(Math.max(Number.isFinite(reqLimit) ? reqLimit : 500, 1), 1000)

  let query = admin
    .from('calendar_events')
    .select('*')
    .order('start_time', { ascending: true })
    .limit(limit)

  if (from) query = query.gte('start_time', from)
  if (to)   query = query.lte('start_time', to)

  const { data, error } = await query.returns<CalendarEvent[]>()
  if (error) {
    console.error('[calendar-events/GET] failed:', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// ── POST /api/calendar-events ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<CalendarEvent>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (!body.start_time) return NextResponse.json({ error: 'start_time_required' }, { status: 400 })
  if (!body.end_time)   return NextResponse.json({ error: 'end_time_required' }, { status: 400 })

  const eventType = body.event_type ?? null
  if (eventType && !EVENT_TYPES.includes(eventType as typeof EVENT_TYPES[number])) {
    return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 })
  }

  // Validar market y channel si están presentes (solo para eventos digitales)
  if (eventType === 'digital' && body.market && !MARKETS.includes(body.market as Market)) {
    return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
  }
  if (eventType === 'digital' && body.channel && !CHANNELS.includes(body.channel as Channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  }

  // Validar fechas
  const startDate = new Date(body.start_time)
  const endDate = new Date(body.end_time)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'invalid_dates' }, { status: 400 })
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'start_after_end' }, { status: 400 })
  }

  const insertRow = {
    title,
    description: body.description ?? null,
    start_time:  startDate.toISOString(),
    end_time:    endDate.toISOString(),
    all_day:     !!body.all_day,
    color:       body.color ?? 'blue',
    category:    body.category ?? null,
    tags:        Array.isArray(body.tags) ? body.tags : [],
    event_type:  eventType,
    location:    eventType === 'presential' ? (body.location ?? null) : null,
    channel:     eventType === 'digital'    ? (body.channel  ?? null) : null,
    market:      eventType === 'digital'    ? (body.market   ?? null) : null,
    created_by:  me.id,
  }

  const { data, error } = await admin
    .from('calendar_events')
    .insert(insertRow as never)
    .select('*')
    .single<CalendarEvent>()
  if (error) {
    console.error('[calendar-events/POST] failed:', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
