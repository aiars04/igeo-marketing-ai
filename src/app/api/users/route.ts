import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database'

// ── Helper: verifica caller y devuelve su profile (o response 401/403) ─────
async function requireActor(needRole: UserRole[]): Promise<
  | { profile: Pick<Profile, 'id' | 'role' | 'active'>; admin: ReturnType<typeof createAdminClient> }
  | { response: NextResponse }
> {
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
  if (!needRole.includes(profile.role)) {
    return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { profile, admin }
}

// ── POST /api/users — invitar (crear) un usuario nuevo ────────────────────
export async function POST(req: Request) {
  const auth = await requireActor(['admin', 'manager'])
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: { email?: string; full_name?: string; role?: UserRole; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const email = body.email?.trim().toLowerCase()
  const full_name = body.full_name?.trim() || null
  const role = body.role ?? 'user'
  const password = body.password?.trim() || randomPassword()

  if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 })
  if (!['admin', 'manager', 'user'].includes(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  // Manager NO puede crear admin ni otro manager
  if (me.role === 'manager' && role !== 'user') {
    return NextResponse.json({ error: 'manager_can_only_create_user' }, { status: 403 })
  }

  // 1) Crear en auth.users
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  })
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? 'create_failed' }, { status: 400 })
  }

  // 2) El trigger ya crea la row en profiles; forzamos role + full_name por seguridad
  const { error: upErr } = await admin
    .from('profiles')
    .upsert(
      [{ id: created.user.id, email, full_name, role, active: true }] as never,
      { onConflict: 'id' },
    )
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    user_id: created.user.id,
    email,
    password, // devolvemos pwd inicial al invitador
    full_name,
    role,
  })
}

function randomPassword(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 14; i++) s += c[Math.floor(Math.random() * c.length)]
  return s + '!'
}
