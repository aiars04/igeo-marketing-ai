import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Idea, Profile, Channel, Market } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const STATUSES: Idea['status'][] = ['pending', 'accepted', 'rejected', 'converted']

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

// ── GET /api/ideas[?status=pending] ───────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const status = url.searchParams.get('status') as Idea['status'] | null
  const reqLimit = Number(url.searchParams.get('limit') ?? 200)
  const limit = Math.min(Math.max(Number.isFinite(reqLimit) ? reqLimit : 200, 1), 500)
  const before = url.searchParams.get('before')

  let query = admin
    .from('ideas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && STATUSES.includes(status)) {
    query = query.eq('status', status)
  }
  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query.returns<Idea[]>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }
  return NextResponse.json(data ?? [])
}

// ── POST /api/ideas ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<Idea>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = body.title?.trim()
  const channel = (body.channel ?? null) as Channel | null
  const market = (body.market ?? 'spain') as Market
  const source = (body.source === 'ai' ? 'ai' : 'human') as Idea['source']

  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (channel && !CHANNELS.includes(channel)) return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  if (!MARKETS.includes(market)) return NextResponse.json({ error: 'invalid_market' }, { status: 400 })

  const insertRow = {
    title,
    description: body.description ?? null,
    channel,
    market,
    source,
    status: 'pending' as const,
    created_by: me.id,
  }

  const { data, error } = await admin
    .from('ideas')
    .insert(insertRow as never)
    .select('*')
    .single<Idea>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json(data)
}
