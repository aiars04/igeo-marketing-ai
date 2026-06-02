/**
 * scripts/create-admin.ts
 *
 * Crea la cuenta Admin inicial en Supabase Auth + asegura su row en `profiles`
 * con role='admin'. Idempotente: si el user ya existe, solo actualiza el profile.
 *
 * Uso:  npx tsx scripts/create-admin.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'

// Cargar .env.local (sin sobreescribir vars ya definidas en el entorno)
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const ADMIN_EMAIL    = 'ai@igeoerp.com'
const ADMIN_PASSWORD = 'Admin123!'
const ADMIN_NAME     = 'Adrián Ruiz'

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('🔍 Comprobando si el usuario ya existe...')
  // listUsers paginado (página 1, 1000 max) — suficiente para nuestro tamaño
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) {
    console.error('❌ Error listando users:', listErr.message)
    process.exit(1)
  }

  const existing = list.users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())

  let userId: string
  if (existing) {
    userId = existing.id
    console.log(`ℹ️  Usuario ya existía → id=${userId}`)
  } else {
    console.log('➕ Creando user en auth.users...')
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: ADMIN_NAME,
        role: 'admin',
      },
    })
    if (error || !data.user) {
      console.error('❌ Error creando user:', error?.message ?? 'sin user')
      process.exit(1)
    }
    userId = data.user.id
    console.log(`✅ User creado → id=${userId}`)
  }

  // Asegurar profile con role='admin' (el trigger ya lo crea, pero forzamos por idempotencia)
  console.log('🔄 Asegurando profile con role=admin...')
  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: ADMIN_EMAIL,
        full_name: ADMIN_NAME,
        role: 'admin',
        active: true,
      },
      { onConflict: 'id' },
    )

  if (upsertErr) {
    console.error('❌ Error en upsert profile:', upsertErr.message)
    process.exit(1)
  }

  // Verificación final
  const { data: profile, error: selErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, active, created_at')
    .eq('id', userId)
    .single()

  if (selErr) {
    console.error('❌ Error verificando profile:', selErr.message)
    process.exit(1)
  }

  console.log('\n✅ ADMIN LISTO')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  id:        ${profile.id}`)
  console.log(`  email:     ${profile.email}`)
  console.log(`  name:      ${profile.full_name}`)
  console.log(`  role:      ${profile.role}`)
  console.log(`  active:    ${profile.active}`)
  console.log(`  created:   ${profile.created_at}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`\n🔑 Login:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
}

main().catch(err => {
  console.error('💥 Excepción:', err)
  process.exit(1)
})
