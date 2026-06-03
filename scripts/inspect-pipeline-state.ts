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

  console.log('=== content_items en BD (todos los campos) ===')
  const { data, error } = await sb.from('content_items').select('*').order('created_at', { ascending: false }).limit(20)
  if (error) { console.error('Error:', error.message); return }
  console.log(`Total filas: ${data.length}\n`)
  data.forEach((r, i) => {
    console.log(`Fila ${i + 1}:`)
    console.log(`  id:             ${r.id}`)
    console.log(`  title:          ${r.title}`)
    console.log(`  stage:          ${r.stage}`)
    console.log(`  channel:        ${r.channel}`)
    console.log(`  created_by:     ${r.created_by}`)
    console.log(`  calendar_item_id: ${r.calendar_item_id}`)
    console.log(`  created_at:     ${r.created_at}`)
    console.log()
  })

  console.log('=== content_assets con content_item_id ===')
  const { data: assets } = await sb.from('content_assets').select('id, content_item_id, prompt').not('content_item_id', 'is', null)
  console.log(`Assets vinculados: ${assets?.length ?? 0}`)
  assets?.forEach(a => console.log(`  · ${a.id.slice(0,8)} → item ${a.content_item_id?.slice(0,8)} | ${a.prompt?.slice(0,40)}`))

  console.log('\n=== RLS policies content_items ===')
  // Intentar consultar pg_policies (read-only). Si Supabase no expone, skip.
  const { data: pol, error: polErr } = await sb.rpc('pg_policies_for_table', { tname: 'content_items' }).catch(() => ({ data: null, error: { message: 'rpc not available' } as { message: string } }))
  if (polErr) {
    console.log(`(no RPC pg_policies disponible — ${polErr.message})`)
  } else {
    console.log(pol)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
