import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const BUCKET = 'content-assets'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_assets')
    .select('id, storage_path, prompt, approved, created_at, aspect_ratio, width, height, channel, created_by')
    .order('created_at', { ascending: false })
    .limit(100)

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
    channel: string | null
    created_by: string | null
  }>

  const assets = rows.map(a => ({
    ...a,
    url: admin.storage.from(BUCKET).getPublicUrl(a.storage_path).data.publicUrl,
  }))

  return NextResponse.json(assets)
}
