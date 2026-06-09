import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizCreatePost, postizUploadFromUrl, type PostizCreatePostBody } from '@/lib/postiz'
import type { Profile } from '@/types/database'

/**
 * Valida que una URL de imagen pertenezca al storage de Supabase del proyecto.
 * Previene SSRF: rechazar URLs internas (localhost, 192.168.x, 10.x, etc.) y
 * dominios arbitrarios que el atacante pueda controlar.
 */
function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return false
    const supabaseHost = new URL(supabaseUrl).host
    // Solo aceptamos URLs de nuestro Supabase Storage público
    return u.host === supabaseHost && u.pathname.includes('/storage/v1/object/public/')
  } catch {
    return false
  }
}

/**
 * POST /api/postiz/publish
 *
 * Body:
 * {
 *   channelIds: string[]          — IDs de canales Postiz donde publicar
 *   content: string               — Texto del post
 *   imageUrl?: string             — URL pública de imagen (Supabase Storage)
 *   scheduledAt?: string          — ISO date para programar; si falta → publicar ahora
 *   type?: 'schedule'|'draft'|'now'  — Por defecto 'schedule' si hay fecha, 'now' si no
 * }
 *
 * Requiere: usuario autenticado, perfil activo, rol admin/manager.
 * Publicar en redes corporativas es una acción crítica — no la dejamos a users.
 */
export async function POST(req: NextRequest) {
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
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: {
    channelIds: string[]
    content: string
    imageUrl?: string
    scheduledAt?: string
    type?: 'schedule' | 'draft' | 'now'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const { channelIds, content, imageUrl, scheduledAt } = body

  if (!channelIds?.length) {
    return NextResponse.json({ error: 'channelIds_required' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content_required' }, { status: 400 })
  }
  // SSRF guard: si viene imagen, debe ser de NUESTRO Supabase Storage.
  if (imageUrl && !isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: 'invalid_image_url' }, { status: 400 })
  }

  // Determinar tipo de publicación
  const type = body.type ?? (scheduledAt ? 'schedule' : 'now')
  if (type === 'schedule' && !scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt_required_for_schedule' }, { status: 400 })
  }

  try {
    // 1. Si hay imagen, subirla a Postiz para obtener la ruta interna
    let postizImagePath: string | undefined
    if (imageUrl) {
      try {
        const media = await postizUploadFromUrl(imageUrl)
        postizImagePath = media.path
      } catch (imgErr) {
        // No bloqueamos la publicación si falla la imagen — lo logamos y continuamos sin ella
        console.warn('[postiz/publish] No se pudo subir la imagen:', imgErr)
      }
    }

    // 2. Construir el body para Postiz
    const postizBody: PostizCreatePostBody = {
      type,
      ...(type === 'schedule' && scheduledAt ? { date: scheduledAt } : {}),
      posts: channelIds.map((id) => ({
        integration: { id },
        value: [
          {
            content,
            ...(postizImagePath
              ? { image: [{ path: postizImagePath }] }
              : {}),
          },
        ],
      })),
    }

    const result = await postizCreatePost(postizBody)

    return NextResponse.json({
      ok: true,
      type,
      channelIds,
      result,
    })
  } catch (err) {
    // No exponemos el mensaje crudo de Postiz al cliente — puede filtrar URLs internas/tokens
    console.error('[postiz/publish] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }
}
