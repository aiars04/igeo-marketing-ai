import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Channel } from '@/types/database'

const BUCKET = 'content-assets'
const VALID_CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const url = new URL(req.url)
  const folderId = url.searchParams.get('folder_id')
  const channel = url.searchParams.get('channel')

  let query = admin
    .from('content_assets')
    .select('id, storage_path, prompt, approved, created_at, aspect_ratio, width, height, created_by, content_item_id, carousel_id, position, channel, folder_id')
    .order('created_at', { ascending: false })
    .limit(200)

  // Filtros
  if (folderId === 'uncategorized') {
    query = query.is('folder_id', null)
  } else if (folderId) {
    query = query.eq('folder_id', folderId)
  }
  if (channel && VALID_CHANNELS.includes(channel as Channel)) {
    query = query.eq('channel', channel)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Array<{
    id: string
    storage_path: string
    prompt: string | null
    approved: boolean
    created_at: string
    aspect_ratio: string | null
    width: number | null
    height: number | null
    created_by: string | null
    content_item_id: string | null
    carousel_id: string | null
    position: number | null
    channel: string | null
    folder_id: string | null
  }>

  const assets = rows.map(a => ({
    ...a,
    url: admin.storage.from(BUCKET).getPublicUrl(a.storage_path).data.publicUrl,
  }))

  return NextResponse.json(assets)
}
