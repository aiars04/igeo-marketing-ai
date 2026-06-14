import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Idea, Profile, Channel, Market } from '@/types/database'

const STATUSES: Idea['status'][] = ['pending', 'accepted', 'rejected', 'converted']
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']

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

// PATCH /api/ideas/[id] — cambiar status / title / description / channel
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: Partial<Idea>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    patch.status = body.status
  }
  if (body.title !== undefined) patch.title = body.title
  if (body.description !== undefined) patch.description = body.description
  if (body.channel !== undefined) {
    if (body.channel !== null && !CHANNELS.includes(body.channel)) {
      return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
    }
    patch.channel = body.channel
  }
  if (body.market !== undefined) {
    if (!MARKETS.includes(body.market)) {
      return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
    }
    patch.market = body.market
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data: target } = await admin
    .from('ideas').select('id, created_by').eq('id', id)
    .single<Pick<Idea, 'id'> & { created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('ideas').update(patch as never).eq('id', id).select('*').single<Idea>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json(data)
}

// DELETE /api/ideas/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('ideas').select('id, created_by').eq('id', id)
    .single<Pick<Idea, 'id'> & { created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin.from('ideas').delete().eq('id', id)
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
