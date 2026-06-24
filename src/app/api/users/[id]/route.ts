import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database'

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

// ── Permitir/no permitir actuar sobre `target` según rol del actor ─────────
function canActOn(
  me: Pick<Profile, 'id' | 'role'>,
  target: Pick<Profile, 'id' | 'role'>,
  // operation: 'update_role' | 'toggle_active' | 'delete'
): { ok: true } | { ok: false; reason: string } {
  if (me.id === target.id) {
    // Operaciones contra uno mismo: bloqueadas en API (la UI debería evitarlas)
    return { ok: false, reason: 'cannot_act_on_self' }
  }
  if (me.role === 'admin') return { ok: true }
  if (me.role === 'manager') {
    if (target.role !== 'user') return { ok: false, reason: 'manager_cannot_modify_admin_or_manager' }
    return { ok: true }
  }
  return { ok: false, reason: 'forbidden' }
}

// ── PATCH /api/users/[id] — actualizar role y/o active ─────────────────────
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: { role?: UserRole; active?: boolean; full_name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const { data: target } = await admin
    .from('profiles')
    .select('id, role, active, email, full_name')
    .eq('id', id)
    .single<Profile>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const check = canActOn(me, target)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 403 })

  // Validar role contra el enum (el POST ya lo hace; el PATCH no lo hacía →
  // un valor inválido daba 500 genérico de la BD en vez de 400 claro).
  if (body.role !== undefined && !['admin', 'manager', 'user'].includes(body.role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  // Manager: solo puede cambiar full_name + active de un user; rol siempre 'user'
  if (me.role === 'manager') {
    if (body.role && body.role !== 'user') {
      return NextResponse.json({ error: 'manager_cannot_assign_admin_or_manager' }, { status: 403 })
    }
  }

  const patch: Partial<Profile> = {}
  if (body.role !== undefined) patch.role = body.role
  if (body.active !== undefined) patch.active = body.active
  if (body.full_name !== undefined) patch.full_name = body.full_name

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { error } = await admin.from('profiles').update(patch as never).eq('id', id)
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'request_failed' }, { status: 400 }) }

  return NextResponse.json({ ok: true })
}

// ── DELETE /api/users/[id] — eliminar (solo admin, nunca a sí mismo) ──────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  if (id === me.id) return NextResponse.json({ error: 'cannot_delete_self' }, { status: 403 })

  const { data: target } = await admin.from('profiles').select('id, role').eq('id', id).single<Pick<Profile, 'id' | 'role'>>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Borrar de auth → cascade a profiles
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'request_failed' }, { status: 400 }) }

  return NextResponse.json({ ok: true })
}
