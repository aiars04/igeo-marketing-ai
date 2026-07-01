import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm'])

export const runtime = 'nodejs'

/**
 * POST /api/videos/register
 *
 * Registra en `content_assets` un vídeo que el navegador ya subió
 * directamente al bucket vía la URL firmada de /api/videos/sign-upload.
 * El cliente NO puede crear esta fila por sí solo (RLS lo impide), así que
 * pasa por este endpoint que valida y registra.
 *
 * Body:
 *   path:             string  (ruta del archivo en el bucket, ej. "uid/video-xxx.mp4")
 *   mime_type:        string  (debe coincidir con la whitelist)
 *   channel?:         string  (opcional, auto-asigna folder system del canal)
 *   content_item_id?: string  (opcional, vincula directo al item)
 *
 * Auth: usuario activo. El path debe empezar por el user.id (impide que un
 * usuario registre archivos subidos por otro).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { path?: string; mime_type?: string; channel?: string; content_item_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const path = (body.path ?? '').trim()
  const mime = (body.mime_type ?? '').toLowerCase()

  // Anti-suplantación: el path firmado SIEMPRE empieza por el user.id.
  // Un usuario malicioso no puede registrar archivos de otro pasando un path
  // ajeno — aquí lo rechazamos. Defensa en profundidad: además rechazamos
  // paths con `..` o `//` que en teoría podrían usarse para apuntar fuera
  // del directorio del usuario (Supabase ya normaliza, pero blindamos).
  if (!path || !path.startsWith(`${user.id}/`) || path.includes('..') || path.includes('//')) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: 'invalid_mime' }, { status: 400 })
  }

  // Verificamos que el archivo realmente exista en el bucket. Sin esto, un
  // cliente malicioso podría registrar paths fantasma. Usamos `search` con
  // MATCH EXACTO por nombre para evitar el problema del list() con
  // paginación 1000 (un user prolífico con 1000+ vídeos verá 404 espurios).
  const dir = path.substring(0, path.lastIndexOf('/'))
  const name = path.substring(path.lastIndexOf('/') + 1)
  const { data: files } = await admin.storage.from(BUCKET).list(dir, {
    limit: 100,
    search: name,   // ILIKE %name% — el name incluye timestamp, hits ~1
  })
  const exists = !!files?.find(f => f.name === name)
  if (!exists) {
    return NextResponse.json({ error: 'file_not_found_in_storage' }, { status: 404 })
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)

  // Auto-asignar folder system del canal si viene
  const rawChannel = (body.channel ?? '').toLowerCase()
  const validChannels = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
  const channelForRow = validChannels.includes(rawChannel) ? rawChannel : null
  let folderId: string | null = null
  if (channelForRow) {
    const { data: folder } = await admin
      .from('image_folders').select('id')
      .eq('system', true).eq('channel', channelForRow)
      .maybeSingle<{ id: string }>()
    folderId = folder?.id ?? null
  }

  // Permiso del item destino (mismo gate que images/[id]/assign)
  let contentItemId: string | null = null
  const rawItemId = (body.content_item_id ?? '').trim()
  if (rawItemId.length > 0) {
    const { data: ci } = await admin
      .from('content_items').select('id, created_by').eq('id', rawItemId)
      .maybeSingle<{ id: string; created_by: string | null }>()
    const isOwner = !!ci && ci.created_by === profile.id
    const isPriv  = profile.role === 'admin' || profile.role === 'manager'
    if (ci && (isOwner || isPriv)) {
      contentItemId = ci.id
    }
  }

  const insertRow = {
    storage_path: path,
    prompt: null,
    approved: false,
    created_by: user.id,
    aspect_ratio: null,
    width: null,
    height: null,
    mime_type: mime,
    asset_type: 'video',
    channel: channelForRow,
    folder_id: folderId,
    content_item_id: contentItemId,
  }
  const { data: asset, error: dbError } = await admin
    .from('content_assets')
    .insert(insertRow as never)
    .select('id, created_at')
    .single<{ id: string; created_at: string }>()
  if (dbError || !asset) {
    // Rollback: si el insert falla, borramos el archivo huérfano del bucket
    // (el cliente acaba de subirlo a través del signed URL).
    const { error: rbErr } = await admin.storage.from(BUCKET).remove([path])
    if (rbErr) console.error('[videos/register] storage rollback FALLÓ (archivo huérfano):', path, rbErr.message)
    console.error('[videos/register] db failed:', dbError?.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  return NextResponse.json({
    id: asset.id,
    url: urlData.publicUrl,
    mime_type: mime,
    asset_type: 'video',
    content_item_id: contentItemId,
    created_at: asset.created_at,
  })
}
