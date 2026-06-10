import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Alert, Profile } from '@/types/database'

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

// PATCH /api/alerts/[id] — marcar resuelta / desresolver
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: { resolved?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  if (typeof body.resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved_required' }, { status: 400 })
  }

  const patch = body.resolved
    ? { resolved: true,  resolved_by: me.id, resolved_at: new Date().toISOString() }
    : { resolved: false, resolved_by: null,  resolved_at: null }

  const { data, error } = await admin
    .from('alerts').update(patch as never).eq('id', id).select('*').single<Alert>()
  if (error) {
    console.error('[alerts/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/alerts/[id] — solo admin/manager
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin' && me.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('alerts').delete().eq('id', id)
  if (error) {
    console.error('[alerts/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
