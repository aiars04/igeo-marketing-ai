import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Channel, Market, Profile, CreativeTemplate } from '@/types/database'

const BUCKET = 'content-assets'
const TEMPLATE_PREFIX = 'templates'
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const SIGNED_URL_TTL_SECONDS = 60 * 60

export const runtime = 'nodejs'

/** Calcula aspect ratio "1:1", "16:9", etc. desde W×H. Devuelve "free" si no encaja. */
function aspectRatioOf(w: number | null, h: number | null): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null
  const r = w / h
  if (Math.abs(r - 1)    < 0.04) return '1:1'
  if (Math.abs(r - 16/9) < 0.04) return '16:9'
  if (Math.abs(r - 9/16) < 0.04) return '9:16'
  if (Math.abs(r - 4/5)  < 0.04) return '4:5'
  if (Math.abs(r - 5/4)  < 0.04) return '5:4'
  if (Math.abs(r - 3/2)  < 0.04) return '3:2'
  if (Math.abs(r - 2/3)  < 0.04) return '2:3'
  return 'free'
}

/**
 * POST /api/creative-templates/register
 *
 * Registra una plantilla cuya imagen el navegador ya subió directamente
 * al bucket vía la URL firmada de /api/creative-templates/sign-upload.
 * Espejo del flujo de vídeos (/api/videos/register).
 *
 * Body (JSON):
 *   path:              string  (ruta del archivo en el bucket)
 *   mime_type:         string  (PNG/JPG/WebP/GIF/SVG)
 *   name:              string
 *   channel:           Channel
 *   description?:      string
 *   market?:           Market | null
 *   asset_role?:       string
 *   notes?:            string
 *   width?:            number
 *   height?:           number
 *   content_type_ids?: string[]
 *
 * Auth: cualquier usuario activo (antes admin/manager — se relajó para
 * permitir a `user` crear sus propias plantillas). El anti-suplantación
 * sigue firme: el path DEBE estar bajo templates/<channel>/<userId>/, así
 * que un user no puede registrar archivos ajenos. Edit/delete siguen siendo
 * admin/manager.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!me || !me.active) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: {
    path?: string
    mime_type?: string
    name?: string
    channel?: string
    description?: string
    market?: string
    asset_role?: string
    notes?: string
    width?: number
    height?: number
    content_type_ids?: string[]
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const path = (body.path ?? '').trim()
  const mime = (body.mime_type ?? '').toLowerCase()
  const name = (body.name ?? '').trim()
  const channel = (body.channel ?? '').toLowerCase() as Channel

  // Anti-suplantación: el path firmado SIEMPRE empieza por
  // templates/<channel>/<userId>/. Defensa en profundidad: rechazar `..` o `//`.
  const expectedPrefix = `${TEMPLATE_PREFIX}/${channel}/${user.id}/`
  if (!path || !path.startsWith(expectedPrefix) || path.includes('..') || path.includes('//')) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: 'invalid_mime' }, { status: 400 })
  }
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  if (name.length > 140) return NextResponse.json({ error: 'name_too_long' }, { status: 400 })
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  }

  // Comprobamos que el archivo realmente existe en el bucket (anti-fantasma).
  const dir = path.substring(0, path.lastIndexOf('/'))
  const filename = path.substring(path.lastIndexOf('/') + 1)
  const { data: files } = await admin.storage.from(BUCKET).list(dir, { limit: 1000 })
  if (!files?.find(f => f.name === filename)) {
    return NextResponse.json({ error: 'file_not_found_in_storage' }, { status: 404 })
  }

  const market: Market | null = body.market && MARKETS.includes(body.market as Market)
    ? (body.market as Market)
    : null
  const assetRole = (body.asset_role ?? 'banner').trim().slice(0, 60) || 'banner'
  const description = (body.description ?? '').trim().slice(0, 1000) || null
  const notes = (body.notes ?? '').trim().slice(0, 2000) || null

  // Width/height — autodetectados por el cliente del archivo. Tope 30000
  // para tolerar imágenes muy grandes (ej. carruseles LinkedIn 13504×5625).
  const width  = typeof body.width  === 'number' ? Math.max(1, Math.min(30000, Math.floor(body.width)))  || null : null
  const height = typeof body.height === 'number' ? Math.max(1, Math.min(30000, Math.floor(body.height))) || null : null
  const aspectRatio = aspectRatioOf(width, height)

  // Validar content_types
  const contentTypeIds = Array.from(new Set((body.content_type_ids ?? []).filter(x => typeof x === 'string'))).slice(0, 50)
  if (contentTypeIds.length > 0) {
    const { data: existing } = await admin
      .from('content_types').select('id, channel').in('id', contentTypeIds)
      .returns<Array<{ id: string; channel: Channel }>>()
    const validIds = new Set((existing ?? []).map(c => c.id))
    const mismatched = (existing ?? []).filter(c => c.channel !== channel)
    if (mismatched.length > 0) {
      return NextResponse.json({ error: 'content_type_channel_mismatch' }, { status: 400 })
    }
    if (validIds.size !== contentTypeIds.length) {
      return NextResponse.json({ error: 'content_type_not_found' }, { status: 400 })
    }
  }

  // Tamaño real del archivo desde Storage (no lo conoce el cliente fiable).
  const sizeFromList = files?.find(f => f.name === filename)?.metadata?.size as number | undefined
  const fileSize = typeof sizeFromList === 'number' ? sizeFromList : null

  const insertRow = {
    name,
    description,
    channel,
    market,
    asset_role: assetRole,
    storage_path: path,
    mime_type: mime,
    width,
    height,
    aspect_ratio: aspectRatio,
    file_size: fileSize,
    notes,
    active: true,
    created_by: me.id,
  }
  const { data: created, error: insertErr } = await admin
    .from('creative_templates').insert(insertRow as never)
    .select('*').single<CreativeTemplate>()
  if (insertErr || !created) {
    // Rollback del archivo si el insert falla
    await admin.storage.from(BUCKET).remove([path]).catch(() => {})
    console.error('[creative-templates/register] insert failed:', insertErr?.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  if (contentTypeIds.length > 0) {
    const pivot = contentTypeIds.map(id => ({ template_id: created.id, content_type_id: id }))
    const { error: pivotErr } = await admin
      .from('creative_template_content_types').insert(pivot as never)
    if (pivotErr) {
      console.error('[creative-templates/register] pivot insert failed:', pivotErr.message)
    }
  }

  // Devolver hidratada (igual que el POST legacy)
  const { data: signed } = await admin.storage.from(BUCKET)
    .createSignedUrl(created.storage_path, SIGNED_URL_TTL_SECONDS)

  return NextResponse.json({
    ...created,
    content_type_ids: contentTypeIds,
    signed_url: signed?.signedUrl ?? null,
  })
}
