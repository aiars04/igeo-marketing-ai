import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sanitizeHandles } from '@/lib/social-mentions'
import type { Profile, SocialMention } from '@/types/database'

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

function isPriv(role: string) { return role === 'admin' || role === 'manager' }

// ── PATCH /api/mentions/[id] ─────────────────────────────────────────────
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Partial<SocialMention> & { handles?: unknown; tags?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = body.name.toString().trim()
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
    if (name.length > 120) return NextResponse.json({ error: 'name_too_long' }, { status: 400 })
    patch.name = name
  }
  if (body.description !== undefined) {
    patch.description = body.description ? body.description.toString().trim() : null
  }
  if (body.handles !== undefined) patch.handles = sanitizeHandles(body.handles)
  if (body.tags !== undefined) {
    patch.tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, 20)
      : []
  }
  if (body.active !== undefined) patch.active = !!body.active

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('social_mentions')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single<SocialMention>()
  if (error) {
    console.error('[mentions/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json(data)
}

// ── DELETE /api/mentions/[id] ────────────────────────────────────────────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('social_mentions').delete().eq('id', id)
  if (error) {
    console.error('[mentions/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
