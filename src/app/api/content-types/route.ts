import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { normalizeFormatSpec } from '@/lib/content-type-format-spec'
import type { ContentType, Profile, Channel } from '@/types/database'

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

// GET /api/content-types[?channel=linkedin&active=true]
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const channel = url.searchParams.get('channel') as Channel | null
  const activeOnly = url.searchParams.get('active') === 'true'
  const reqLimit = Number(url.searchParams.get('limit') ?? 200)
  const limit = Math.min(Math.max(Number.isFinite(reqLimit) ? reqLimit : 200, 1), 500)

  let query = admin.from('content_types').select('*').order('created_at', { ascending: true }).limit(limit)
  if (channel && CHANNELS.includes(channel)) query = query.eq('channel', channel)
  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query.returns<ContentType[]>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }
  return NextResponse.json(data ?? [])
}

// POST /api/content-types
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<ContentType>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const name = body.name?.trim()
  const channel = body.channel as Channel
  const description = body.description?.trim()
  const process = body.process?.trim()
  const style = body.style?.trim()

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  if (!channel || !CHANNELS.includes(channel)) return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'description_required' }, { status: 400 })
  if (!process) return NextResponse.json({ error: 'process_required' }, { status: 400 })
  if (!style) return NextResponse.json({ error: 'style_required' }, { status: 400 })

  const insertRow = {
    name, channel, description, process, style,
    active: body.active ?? true,
    format_spec: normalizeFormatSpec((body as { format_spec?: unknown }).format_spec),
    created_by: me.id,
  }
  const { data, error } = await admin
    .from('content_types')
    .insert(insertRow as never)
    .select('*')
    .single<ContentType>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json(data)
}
