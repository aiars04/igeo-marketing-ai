import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log('Columnas content_items:')
  const cols = ['id', 'title', 'stage', 'channel', 'market', 'created_by', 'description', 'calendar_item_id', 'status', 'ai_generated']
  for (const c of cols) {
    const { error } = await sb.from('content_items').select(c).limit(0)
    console.log(`  ${c.padEnd(20)} ${error ? '❌ ' + error.message.slice(0, 50) : '✅'}`)
  }

  // Probar INSERT con admin client (bypasses RLS, igual que la API)
  console.log('\nIntento INSERT como admin (bypass RLS) — debería pasar:')
  const { data, error } = await sb.from('content_items').insert({
    title: 'TEST_PROBE_DELETE_ME',
    channel: 'linkedin',
    stage: 'ideas',
    market: 'spain',
    status: 'pending',
    ai_generated: false,
    description: null,
  }).select('id').single()
  if (error) {
    console.log(`❌ ${error.message}`)
    console.log(`   code: ${error.code} | details: ${error.details ?? '(none)'}`)
  } else {
    console.log(`✅ INSERT OK — id=${data.id}`)
    // Cleanup
    await sb.from('content_items').delete().eq('id', data.id)
    console.log(`✅ Cleanup OK`)
  }
}

main().catch(e => { console.error('💥', e); process.exit(1) })
