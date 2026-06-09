import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ImageFolder, Profile, Channel } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

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

// GET /api/image-folders → carpetas + conteo de assets por carpeta + uncategorized
export async function GET() {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const { data: folders, error } = await admin
    .from('image_folders')
    .select('*')
    .order('system', { ascending: false })  // system primero
    .order('created_at', { ascending: true })
    .returns<ImageFolder[]>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  // Conteo de assets por folder + uncategorized + total
  const { data: assetRows } = await admin
    .from('content_assets')
    .select('folder_id')
    .returns<Array<{ folder_id: string | null }>>()

  const counts: Record<string, number> = {}
  let uncategorized = 0
  let total = 0
  for (const row of assetRows ?? []) {
    total++
    if (row.folder_id) counts[row.folder_id] = (counts[row.folder_id] ?? 0) + 1
    else uncategorized++
  }

  const enriched = (folders ?? []).map(f => ({ ...f, asset_count: counts[f.id] ?? 0 }))

  return NextResponse.json({
    folders: enriched,
    uncategorized_count: uncategorized,
    total_count: total,
  })
}

// POST /api/image-folders { name, channel?, color? }
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  // Solo admin/manager pueden crear carpetas (mismo criterio que admin sobre content_types)
  if (me.role !== 'admin' && me.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Partial<ImageFolder>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const name = body.name?.trim()
  if (!name || name.length < 2) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const channel = body.channel ?? null
  if (channel !== null && !CHANNELS.includes(channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  }

  const insertRow = {
    name,
    channel,
    color: body.color ?? null,
    icon: body.icon ?? null,
    system: false,
    created_by: me.id,
  }
  const { data, error } = await admin
    .from('image_folders')
    .insert(insertRow as never)
    .select('*')
    .single<ImageFolder>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json({ ...data, asset_count: 0 })
}
