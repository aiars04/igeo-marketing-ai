import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ContentItem, Profile, Stage } from '@/types/database'

const STAGES: Stage[] = ['ideas', 'copy', 'design', 'scheduled', 'analyzed']

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

// ── PATCH /api/content-items/[id] ────────────────────────────────────
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: Partial<ContentItem>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // Sólo permitimos editar un subconjunto de campos
  const patch: Record<string, unknown> = {}
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage as Stage)) return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })
    patch.stage = body.stage
  }
  if (body.status !== undefined) patch.status = body.status
  if (body.title !== undefined) patch.title = body.title
  if (body.content !== undefined) patch.content = body.content
  if (body.campaign !== undefined) patch.campaign = body.campaign
  if ((body as { description?: string }).description !== undefined) patch.description = (body as { description?: string }).description
  if (body.human_approved !== undefined) patch.human_approved = body.human_approved
  if (body.approved_by !== undefined) patch.approved_by = body.approved_by
  if (body.approved_at !== undefined) patch.approved_at = body.approved_at
  if (body.scheduled_at !== undefined) patch.scheduled_at = body.scheduled_at
  if (body.published_at !== undefined) patch.published_at = body.published_at
  if (body.clarity_pass !== undefined) patch.clarity_pass = body.clarity_pass
  if (body.clarity_summary !== undefined) patch.clarity_summary = body.clarity_summary

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  // Verificar permisos: dueño, manager o admin
  const { data: target } = await admin
    .from('content_items')
    .select('id, created_by')
    .eq('id', id)
    .single<Pick<ContentItem, 'id'> & { created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('content_items')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single<ContentItem>()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// ── DELETE /api/content-items/[id] ───────────────────────────────────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('content_items')
    .select('id, created_by')
    .eq('id', id)
    .single<Pick<ContentItem, 'id'> & { created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('content_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
