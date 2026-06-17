import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizCreatePost, postizUploadFromUrl, type PostizCreatePostBody } from '@/lib/postiz'
import { checkRateLimit, maybeCleanupRateLimits } from '@/lib/rate-limit'
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

  // Rate-limit: 10 publish por usuario / 60s. Evita ráfagas accidentales
  // (clics frenéticos, scripts mal hechos) y dispara ANTES de tocar Postiz.
  maybeCleanupRateLimits()
  const rl = checkRateLimit(`publish:${user.id}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    )
  }

  let body: {
    channelIds: string[]
    content: string
    imageUrl?: string                 // legacy: una sola imagen
    imageUrls?: string[]              // nuevo: hasta 10 imágenes (carrusel)
    channelContents?: Record<string, string>  // contenido distinto por canal
    scheduledAt?: string
    type?: 'schedule' | 'draft' | 'now'
    contentItemId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const { channelIds, content, imageUrl, imageUrls, channelContents, scheduledAt, contentItemId } = body

  if (!channelIds?.length) {
    return NextResponse.json({ error: 'channelIds_required' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content_required' }, { status: 400 })
  }

  // Lista normalizada de imágenes (URLs) — soporta legacy `imageUrl` y nuevo `imageUrls[]`.
  // Límite: 10 imágenes max (Postiz acepta más pero las redes sociales rara vez).
  const allImageUrls = [
    ...(imageUrls ?? []),
    ...(imageUrl ? [imageUrl] : []),
  ].filter(Boolean).slice(0, 10)

  // SSRF guard sobre todas las imágenes.
  for (const u of allImageUrls) {
    if (!isAllowedImageUrl(u)) {
      return NextResponse.json({ error: 'invalid_image_url' }, { status: 400 })
    }
  }

  // Si vienen contenidos personalizados, validar que las claves son channelIds válidos
  // y que ninguno está vacío.
  if (channelContents) {
    for (const cid of Object.keys(channelContents)) {
      if (!channelIds.includes(cid)) {
        return NextResponse.json({ error: 'channel_content_unknown_channel' }, { status: 400 })
      }
    }
  }

  // Determinar tipo de publicación
  const type = body.type ?? (scheduledAt ? 'schedule' : 'now')
  if (type === 'schedule' && !scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt_required_for_schedule' }, { status: 400 })
  }

  // Si el caller pasa contentItemId, validar que el item existe y que el
  // usuario tiene permiso para tocarlo.
  //
  // Regla de propiedad:
  //   - admin → puede publicar/vincular cualquier item.
  //   - manager → solo items que él creó (content_items.created_by = user.id).
  //
  // Esto deja la puerta abierta a multi-tenant sin tocar nada más.
  if (contentItemId) {
    const { data: targetItem, error: itemErr } = await admin
      .from('content_items')
      .select('id, created_by')
      .eq('id', contentItemId)
      .maybeSingle<{ id: string; created_by: string | null }>()
    if (itemErr || !targetItem) {
      return NextResponse.json({ error: 'content_item_not_found' }, { status: 404 })
    }
    if (profile.role !== 'admin' && targetItem.created_by && targetItem.created_by !== user.id) {
      return NextResponse.json({ error: 'forbidden_not_owner' }, { status: 403 })
    }
  }

  // Tracking del resultado del upload de imágenes.
  let imagesUploaded   = 0
  const imageUploadErrors: string[] = []

  try {
    // 1. Subir todas las imágenes a Postiz (en serie para no saturar).
    //    Cada fallo se loggea pero no bloquea — al final reportamos a la UI
    //    cuántas se subieron vs cuántas se pidieron.
    const postizImagePaths: string[] = []
    for (const url of allImageUrls) {
      try {
        const media = await postizUploadFromUrl(url)
        postizImagePaths.push(media.path)
        imagesUploaded++
      } catch (imgErr) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr)
        imageUploadErrors.push(msg.slice(0, 200))
        console.warn('[postiz/publish] upload-from-url falló:', msg)
      }
    }
    const imagesBlock = postizImagePaths.length > 0
      ? { image: postizImagePaths.map(p => ({ path: p })) }
      : {}

    // 2. Construir el body para Postiz — contenido por canal si viene custom.
    const postizBody: PostizCreatePostBody = {
      type,
      ...(type === 'schedule' && scheduledAt ? { date: scheduledAt } : {}),
      posts: channelIds.map((id) => ({
        integration: { id },
        value: [
          {
            content: channelContents?.[id]?.trim() || content,
            ...imagesBlock,
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
            // `as never` es el patrón usado en el resto del codebase porque
            // los tipos generados de Supabase no infieren bien el shape de
            // .update() para tablas con muchas columnas. Las claves de
            // `updates` son string literales acotadas (postiz_id,
            // published_at, scheduled_at), así que el cast es seguro.
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
      // Reportar conteo real de imágenes para que la UI lo refleje.
      imagesRequested: allImageUrls.length,
      imagesUploaded,
      imageUploaded: imagesUploaded > 0,
      imageUploadError: imageUploadErrors.length > 0 ? 'upload_failed' : null,
      result,
    })
  } catch (err) {
    // No exponemos el mensaje crudo de Postiz al cliente — puede filtrar URLs internas/tokens
    console.error('[postiz/publish] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }
}
