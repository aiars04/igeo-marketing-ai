import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm'])

export const runtime = 'nodejs'

/**
 * POST /api/videos/sign-upload
 *
 * Genera una URL firmada de Supabase Storage para que el navegador suba
 * directamente el vídeo al bucket, SALTÁNDOSE el límite de body de Vercel
 * (~4.5 MB en serverless functions). Sin este patrón los vídeos reales
 * (>5 MB) fallaban con un 413 opaco antes de llegar al endpoint.
 *
 * Body: { filename: string, contentType: string }
 *
 * Respuesta:
 *   {
 *     path:      string  // ruta del archivo dentro del bucket
 *     token:     string  // token para PUT (NO es la URL, es el header X-Upsert)
 *     signedUrl: string  // URL completa a la que hacer PUT con el archivo
 *   }
 *
 * Tras el PUT exitoso, el cliente debe llamar a /api/videos/register para
 * crear la fila en `content_assets` y vincularla al item.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { filename?: string; contentType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const contentType = (body.contentType ?? '').toLowerCase()
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: 'mime_not_allowed', detail: `Formato no soportado (${contentType || 'desconocido'}). Usa MP4, MOV o WebM.` },
      { status: 400 },
    )
  }

  // Path único por usuario. Ignoramos el filename del cliente (podría tener
  // characters raros o intentos de path traversal) y generamos uno limpio.
  const ext = contentType === 'video/mp4' ? 'mp4' : contentType === 'video/webm' ? 'webm' : 'mov'
  const path = `${user.id}/video-${Date.now()}.${ext}`

  // createSignedUploadUrl genera un token único para esta ruta exacta. El
  // navegador hará PUT a `signedUrl` con el contenido del archivo. Si alguien
  // intercepta el token, solo puede escribir en ESA ruta concreta.
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[videos/sign-upload] createSignedUploadUrl failed:', error?.message)
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  })
}
