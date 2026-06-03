/**
 * scripts/setup-content-assets-bucket.ts
 * Crea (o verifica) el bucket Storage 'content-assets' en Supabase. Idempotente.
 * Uso: npx tsx scripts/setup-content-assets-bucket.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') })

const BUCKET = 'content-assets'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: existing } = await sb.storage.getBucket(BUCKET)
  if (existing) {
    console.log(`ℹ️  Bucket "${BUCKET}" ya existe.`)
    console.log(`   public:           ${existing.public}`)
    console.log(`   fileSizeLimit:    ${existing.file_size_limit}`)
    console.log(`   allowedMimeTypes: ${JSON.stringify(existing.allowed_mime_types)}`)
    // Asegurar configuración correcta
    const { error: upErr } = await sb.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    })
    if (upErr) {
      console.error('❌ Error actualizando bucket:', upErr.message)
      process.exit(1)
    }
    console.log('✅ Configuración del bucket actualizada (public, 10MB, png/jpeg/webp).')
    return
  }

  console.log(`➕ Creando bucket "${BUCKET}"...`)
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  })
  if (error) {
    console.error('❌ Error creando bucket:', error.message)
    process.exit(1)
  }
  console.log(`✅ Bucket "${BUCKET}" creado (public, 10MB, png/jpeg/webp).`)
}

main().catch(e => { console.error('💥', e); process.exit(1) })
