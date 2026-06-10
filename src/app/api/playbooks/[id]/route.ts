import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Playbook, PlaybookStep, PlaybookType, Profile } from '@/types/database'

const PLAYBOOK_TYPES: PlaybookType[] = [
  'webinar', 'event_presential', 'event_online', 'release',
  'newsletter', 'campaign', 'alliance', 'workshop',
  'lead_magnet', 'reactivation', 'podcast',
]

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

const isPriv = (role: string) => role === 'admin' || role === 'manager'

// GET /api/playbooks/[id] — playbook + sus steps ordenados
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth
  const { id } = await ctx.params

  const { data: playbook, error: pErr } = await admin
    .from('playbooks')
    .select('*')
    .eq('id', id)
    .single<Playbook>()
  if (pErr || !playbook) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: steps } = await admin
    .from('playbook_steps')
    .select('*')
    .eq('playbook_id', id)
    .order('step_order', { ascending: true })
    .returns<PlaybookStep[]>()

  return NextResponse.json({ ...playbook, steps: steps ?? [] })
}

// PATCH /api/playbooks/[id]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (!isPriv(me.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: Partial<Playbook>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.type !== undefined) {
    if (!PLAYBOOK_TYPES.includes(body.type as PlaybookType)) {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
    }
    patch.type = body.type
  }
  if (body.description !== undefined) patch.description = body.description
  if (body.market_scope !== undefined) patch.market_scope = body.market_scope
  if (body.default_channels !== undefined) patch.default_channels = body.default_channels
  if (body.required_assets !== undefined) patch.required_assets = body.required_assets
  if (body.required_copy_blocks !== undefined) patch.required_copy_blocks = body.required_copy_blocks
  if (body.approval_required !== undefined) patch.approval_required = !!body.approval_required
  if (body.active !== undefined) patch.active = !!body.active

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('playbooks')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single<Playbook>()
  if (error) {
    console.error('[playbooks/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/playbooks/[id] — solo admin
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin.from('playbooks').delete().eq('id', id)
  if (error) {
    console.error('[playbooks/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
