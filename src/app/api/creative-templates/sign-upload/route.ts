import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Channel, Profile } from '@/types/database'

const BUCKET = 'content-assets'
const TEMPLATE_PREFIX = 'templates'
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

export const runtime = 'nodejs'

/**
 * POST /api/creative-templates/sign-upload
 *
 * Genera una URL firmada de Supabase Storage para que el navegador suba
 * la imagen de plantilla DIRECTAMENTE al bucket, SALTÁNDOSE el límite de
 * body de Vercel (~4.5 MB en serverless functions). Sin este patrón,
 * plantillas grandes (ej. 13504×5625 px del bug 30-jun) fallaban con
 * HTTP 413 antes de llegar al endpoint multipart.
 *
 * Tras el PUT del cliente al signedUrl, debe llamar a /api/creative-
 * templates/register para crear la fila en BD y vincular content_types.
 *
 * Body: { contentType: string, channel: Channel }
 *
 * Auth: admin o manager (mismo gate que el POST multipart legacy).
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
  if (me.role !== 'admin' && me.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { contentType?: string; channel?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const contentType = (body.contentType ?? '').toLowerCase()
  const channel = (body.channel ?? '').toLowerCase() as Channel

  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: 'mime_not_allowed', detail: `Formato no soportado (${contentType || 'desconocido'}). Usa PNG, JPG, WebP, GIF o SVG.` },
      { status: 400 },
    )
  }
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  }

  // Path único bajo templates/<channel>/<userId>/. Coherente con el POST
  // multipart legacy para que ambos flujos generen rutas equivalentes.
  const ext = contentType === 'image/png' ? 'png'
    : contentType === 'image/webp' ? 'webp'
    : contentType === 'image/gif' ? 'gif'
    : contentType === 'image/svg+xml' ? 'svg'
    : 'jpg'
  const path = `${TEMPLATE_PREFIX}/${channel}/${user.id}/${Date.now()}-template.${ext}`

  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[creative-templates/sign-upload] createSignedUploadUrl failed:', error?.message)
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  })
}
