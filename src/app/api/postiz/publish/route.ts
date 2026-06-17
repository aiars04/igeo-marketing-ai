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
    if (u.host !== supabaseHost) return false
    // El pathname DEBE EMPEZAR por la ruta de storage público — no basta con
    // includes() (que se puede burlar con query strings o path traversal).
    return /^\/storage\/v1\/object\/public\//.test(u.pathname)
  } catch {
    return false
  }
}

/**
 * Extrae el primer id de post devuelto por Postiz.
 *
 * Shape oficial documentado de POST /public/v1/posts:
 *   [ { postId: string, integration: string } ]
 *
 * Toleramos también `id` por si en algún plan/versión devuelven otro campo,
 * y los wrappers `{ posts: [...] }` por compatibilidad con respuestas
 * intermedias del cliente.
 */
function extractPostizId(result: unknown): string | null {
  if (!result) return null
  const pickId = (x: unknown): string | null => {
    if (!x || typeof x !== 'object') return null
    const obj = x as Record<string, unknown>
    // Orden de preferencia: postId (oficial), id (fallback).
    for (const key of ['postId', 'id'] as const) {
      const v = obj[key]
      if (typeof v === 'string' && v.length > 0) return v
    }
    return null
  }
  if (Array.isArray(result)) {
    for (const r of result) { const id = pickId(r); if (id) return id }
    return null
  }
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>
    if (Array.isArray(obj.posts)) {
      for (const r of obj.posts) { const id = pickId(r); if (id) return id }
    }
    const direct = pickId(obj)
    if (direct) return direct
  }
  return null
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
 *   contentItemId?: string        — Si viene, persistimos postiz_id + published_at en el item
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
    contentItemId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const { channelIds, content, imageUrl, scheduledAt, contentItemId } = body

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
        // No bloqueamos la publicación si falla la imagen — logamos solo el
        // mensaje (no el objeto completo, que podría arrastrar URLs/tokens internos).
        console.warn('[postiz/publish] No se pudo subir la imagen:', imgErr instanceof Error ? imgErr.message : String(imgErr))
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

    // 3. Vincular content_item con Postiz (best-effort, silencioso si falla).
    // Solo si el caller indicó contentItemId. No bloqueamos la respuesta si
    // el UPDATE falla — el post ya está en Postiz.
    const postizId = extractPostizId(result)
    let linkedItemId: string | null = null
    let publishedAt: string | null = null
    if (contentItemId) {
      try {
        const updates: Record<string, unknown> = {}
        if (postizId) updates.postiz_id = postizId
        if (type === 'now') {
          publishedAt = new Date().toISOString()
          updates.published_at = publishedAt
        } else if (type === 'schedule' && scheduledAt) {
          updates.scheduled_at = scheduledAt
        }

        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await admin
            .from('content_items')
            .update(updates as never)
            .eq('id', contentItemId)
          if (updErr) {
            console.warn('[postiz/publish] no se pudo actualizar content_item:', updErr.message)
          } else {
            linkedItemId = contentItemId
          }
        }
      } catch (linkErr) {
        console.warn('[postiz/publish] error vinculando item:', linkErr instanceof Error ? linkErr.message : String(linkErr))
      }
    }

    return NextResponse.json({
      ok: true,
      type,
      channelIds,
      linkedItemId,
      postizId,
      publishedAt,
      result,
    })
  } catch (err) {
    // No exponemos el mensaje crudo de Postiz al cliente — puede filtrar URLs internas/tokens
    console.error('[postiz/publish] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }
}
