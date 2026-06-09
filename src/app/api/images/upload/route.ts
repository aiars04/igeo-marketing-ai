import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // 1) Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2) Parse multipart
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'bad_form_data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `mime_not_allowed: ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large_10mb_max' }, { status: 413 })
  }

  // 3) Subir a Storage
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filename = `${user.id}/upload-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error('[images/upload] storage failed:', uploadError.message)
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filename)

  // 3b) Auto-asignar folder system del channel si el formData lo trae
  const rawChannel = (formData.get('channel') ?? '').toString().toLowerCase()
  const validChannels = ['linkedin','instagram','facebook','x','blog','email','newsletter']
  const channelForRow = validChannels.includes(rawChannel) ? rawChannel : null
  let folderId: string | null = null
  if (channelForRow) {
    const { data: folder } = await admin
      .from('image_folders').select('id')
      .eq('system', true).eq('channel', channelForRow)
      .maybeSingle<{ id: string }>()
    folderId = folder?.id ?? null
  }

  // 4) Insertar en content_assets
  const insertRow = {
    storage_path: filename,
    prompt: null,
    approved: false,
    created_by: user.id,
    aspect_ratio: null,
    width: null,
    height: null,
    mime_type: file.type,
    asset_type: 'upload',
    channel: channelForRow,
    folder_id: folderId,
  }
  const { data: asset, error: dbError } = await admin
    .from('content_assets')
    .insert(insertRow as never)
    .select('*')
    .single()
  if (dbError) {
    // Rollback: limpia el archivo huérfano en Storage si el insert falla
    await admin.storage.from(BUCKET).remove([filename]).catch(() => {})
    console.error('[images/upload] db failed:', dbError.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  return NextResponse.json({
    id: (asset as { id: string }).id,
    url: urlData.publicUrl,
    prompt: null,
    aspectRatio: null,
    approved: false,
    created_at: (asset as { created_at: string }).created_at,
    width: null,
    height: null,
  })
}
