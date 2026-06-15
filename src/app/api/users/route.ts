import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database'

export const runtime = 'nodejs'

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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
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
    console.error('[users] auth.createUser failed:', createErr?.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 400 })
  }

  // 2) El trigger ya crea la row en profiles; forzamos role + full_name por seguridad
  const { error: upErr } = await admin
    .from('profiles')
    .upsert(
      [{ id: created.user.id, email, full_name, role, active: true }] as never,
      { onConflict: 'id' },
    )
  if (upErr) {
    // Rollback: si profiles upsert falla, eliminamos el auth user para no dejar huérfanos
    await admin.auth.admin.deleteUser(created.user.id).catch(err =>
      console.error('[users] rollback deleteUser failed:', err),
    )
    console.error('[users] profile upsert failed:', upErr.message)
    return NextResponse.json({ error: 'profile_failed' }, { status: 400 })
  }

  // Devolvemos la password en claro UNA sola vez — el flujo que pidió el usuario
  // es: admin crea cuenta → ve email + password generada → la pasa al nuevo
  // usuario por canal seguro (preferible que un link de recovery, que muchos
  // usuarios pierden o no entienden). La password ya está hasheada en Supabase
  // antes de devolverla; el cliente solo recibe el texto plano una vez, no se
  // persiste en BD. El usuario puede cambiarla luego desde su perfil.
  return NextResponse.json({
    ok: true,
    user_id: created.user.id,
    email,
    full_name,
    role,
    temp_password: password,
  })
}

/**
 * Genera una contraseña automática legible y segura: tres palabras cortas de
 * un set base + 3 dígitos al azar + 1 símbolo (cumple cualquier policy estándar).
 * Ej: "agua-luna-roca-472!". Cae bien al copiar/dictar y no usa base64 raro.
 */
function randomPassword(): string {
  const words = [
    'agua', 'luna', 'roca', 'mar', 'sol', 'nube', 'rio', 'pico',
    'rayo', 'duna', 'isla', 'cima', 'ola', 'arce', 'pino', 'cedro',
    'flor', 'tigre', 'lobo', 'oro', 'plata', 'azul', 'verde', 'rosa',
    'norte', 'sur', 'este', 'oeste', 'foco', 'orbe', 'eco', 'reto',
  ]
  const pick = () => words[randomBytes(1)[0] % words.length]
  const digits = String(randomBytes(2).readUInt16BE(0) % 1000).padStart(3, '0')
  return `${pick()}-${pick()}-${pick()}-${digits}!`
}
