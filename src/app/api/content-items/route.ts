import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ContentItem, Profile, Stage, Channel, Market } from '@/types/database'

const STAGES: Stage[] = ['ideas', 'copy', 'design', 'approval', 'scheduled', 'analyzed']
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

// ── GET /api/content-items[?stage=ideas] ───────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const stage = url.searchParams.get('stage') as Stage | null
  // Paginación: ?limit=N (default 200, max 500) y ?before=<createdAt ISO> para cursor.
  const reqLimit = Number(url.searchParams.get('limit') ?? 200)
  const limit = Math.min(Math.max(Number.isFinite(reqLimit) ? reqLimit : 200, 1), 500)
  const before = url.searchParams.get('before')

  let query = admin
    .from('content_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (stage && STAGES.includes(stage)) {
    query = query.eq('stage', stage)
  }
  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query.returns<ContentItem[]>()
  if (error) {
    console.error('[content-items/GET] db failed:', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── POST /api/content-items ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<ContentItem> & { title?: string; channel?: string; stage?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = body.title?.trim()
  const channel = body.channel as Channel
  const stage = (body.stage ?? 'ideas') as Stage
  const market = (body.market ?? 'spain') as Market

  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (!channel || !CHANNELS.includes(channel)) return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  if (!STAGES.includes(stage)) return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })

  // Dedup por calendar_item_id si viene definido
  if (body.calendar_item_id) {
    const { data: dup } = await admin
      .from('content_items')
      .select('id')
      .eq('calendar_item_id', body.calendar_item_id)
      .limit(1)
      .maybeSingle<{ id: string }>()
    if (dup) {
      return NextResponse.json({ error: 'duplicate_calendar_item_id', existing_id: dup.id }, { status: 409 })
    }
  }

  // Validar content_type_id si viene definido: debe existir, estar activo y
  // pertenecer al MISMO canal del item (no se puede asignar un Carrusel-IG
  // a un item de LinkedIn).
  let contentTypeId: string | null = null
  if (body.content_type_id) {
    const { data: ct } = await admin
      .from('content_types')
      .select('id, channel, active')
      .eq('id', body.content_type_id)
      .maybeSingle<{ id: string; channel: Channel; active: boolean }>()
    if (!ct) return NextResponse.json({ error: 'invalid_content_type' }, { status: 400 })
    if (!ct.active) return NextResponse.json({ error: 'content_type_inactive' }, { status: 400 })
    if (ct.channel !== channel) {
      return NextResponse.json({ error: 'content_type_channel_mismatch' }, { status: 400 })
    }
    contentTypeId = ct.id
  }

  // En CREATE NUNCA aceptamos campos de auditoría/aprobación del cliente.
  // human_approved/approved_by/approved_at se setean vía PATCH con role check.
  // postiz_id, clarity_pass, clarity_summary, published_at se setean vía endpoints específicos.
  const insertRow = {
    title,
    channel,
    stage,
    market,
    status: 'pending', // siempre arranca pendiente
    campaign: body.campaign ?? null,
    content: body.content ?? null,
    description: (body as { description?: string }).description ?? null,
    ai_generated: !!body.ai_generated,
    clarity_pass: null,
    clarity_summary: null,
    human_approved: false,
    approved_by: null,
    approved_at: null,
    scheduled_at: body.scheduled_at ?? null,
    published_at: null,
    postiz_id: null,
    calendar_item_id: body.calendar_item_id ?? null,
    content_type_id: contentTypeId,
    created_by: me.id,
  }

  const { data, error } = await admin
    .from('content_items')
    .insert(insertRow as never)
    .select('*')
    .single<ContentItem>()
  if (error) {
    console.error('[content-items/POST] insert failed:', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}
