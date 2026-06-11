import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, SeoBrief, SeoBriefStatus } from '@/types/database'

const STATUSES: SeoBriefStatus[] = ['draft', 'approved', 'converted', 'archived']

async function requireActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin }
}

// GET /api/seo/briefs/[id]
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth
  const { id } = await ctx.params

  const { data, error } = await admin
    .from('seo_briefs').select('*').eq('id', id)
    .single<SeoBrief>()
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/seo/briefs/[id]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('seo_briefs').select('id, created_by').eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: Partial<SeoBrief>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = String(body.title).trim()
  if (body.primary_keyword !== undefined) patch.primary_keyword = String(body.primary_keyword).trim()
  if (body.secondary_keywords !== undefined) {
    patch.secondary_keywords = Array.isArray(body.secondary_keywords)
      ? body.secondary_keywords.map(x => String(x).trim()).filter(Boolean) : []
  }
  if (body.intent !== undefined) patch.intent = body.intent
  if (body.target_length !== undefined) patch.target_length = body.target_length
  if (body.suggested_h2 !== undefined) {
    patch.suggested_h2 = Array.isArray(body.suggested_h2)
      ? body.suggested_h2.map(x => String(x).trim()).filter(Boolean) : []
  }
  if (body.cta !== undefined) patch.cta = body.cta
  if (body.content_outline !== undefined) patch.content_outline = body.content_outline
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as SeoBriefStatus)) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('seo_briefs').update(patch as never).eq('id', id)
    .select('*').single<SeoBrief>()
  if (error) {
    console.error('[seo/briefs/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/seo/briefs/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('seo_briefs').select('id, created_by').eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin.from('seo_briefs').delete().eq('id', id)
  if (error) {
    console.error('[seo/briefs/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
