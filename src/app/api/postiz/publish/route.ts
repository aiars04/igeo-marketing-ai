import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizCreatePost, postizDeletePost, postizUploadFromUrl, postizGetChannels, type PostizCreatePostBody } from '@/lib/postiz'
import { checkRateLimit, maybeCleanupRateLimits } from '@/lib/rate-limit'
import type { Profile } from '@/types/database'

/**
 * Construye el objeto `settings` que Postiz exige por cada post, según la
 * red social. Como mínimo `__type` (el providerIdentifier del canal). Algunas
 * redes exigen campos extra: Instagram `post_type`, X `who_can_reply_post`,
 * TikTok un set de flags. El resto se contenta con solo `__type`.
 */
function buildPostizSettings(identifier: string): Record<string, unknown> {
  const id = (identifier || '').toLowerCase()
  // __type también va en lowercase — los providerIdentifier de Postiz son
  // siempre minúsculas estables ('instagram-standalone', 'linkedin', etc.)
  // pero normalizamos por si en algún plan/versión llegasen con mayúsculas.
  const base: Record<string, unknown> = { __type: id }
  if (id.startsWith('instagram')) return { ...base, post_type: 'post' }
  if (id === 'x' || id === 'twitter') return { ...base, who_can_reply_post: 'everyone', community: '' }
  if (id.startsWith('tiktok')) {
    return {
      ...base,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      duet: false, stitch: false, comment: false,
      autoAddMusic: false, brand_content_toggle: false,
      brand_organic_toggle: false, content_posting_method: 'DIRECT_POST',
    }
  }
  return base
}

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

  // Si el caller pasa contentItemId, validar SOLO que el item existe.
  //
  // Regla de propiedad: cualquier admin o manager puede publicar/cancelar
  // cualquier item del workspace. Es una app interna corporativa donde el
  // contenido es del equipo, no de cada usuario individual — Alvaro publica
  // lo que ha redactado Ramon, etc. Antes restringíamos a 'manager solo lo
  // suyo' como defensa multi-tenant, pero estorbaba el flujo real (bug
  // reportado 2026-06-24). El gate de rol admin/manager arriba se mantiene.
  if (contentItemId) {
    const { data: targetItem, error: itemErr } = await admin
      .from('content_items')
      .select('id, postiz_id, publish_state')
      .eq('id', contentItemId)
      .maybeSingle<{ id: string; postiz_id: string | null; publish_state: string | null }>()
    if (itemErr || !targetItem) {
      return NextResponse.json({ error: 'content_item_not_found' }, { status: 404 })
    }
    // Pre-check anti race de doble publicación: si el item ya tiene postiz_id
    // y el estado no es 'failed', está vivo en Postiz — republicar dejaría el
    // post viejo huérfano (no apuntable desde la UI) y crearía un duplicado.
    // El usuario debe Cancelar primero (limpia postiz_id) o Volver desde un
    // failed (también limpia postiz_id, ver content-items PATCH).
    if (targetItem.postiz_id && targetItem.publish_state !== 'failed') {
      return NextResponse.json(
        { error: 'already_published_or_in_flight', detail: 'Este item ya tiene un post en Postiz. Cancela la publicación antes de volver a publicar.' },
        { status: 409 },
      )
    }
    // Reintentar desde 'failed' SIN retroceder stage: el postiz_id viejo
    // (del intento fallido, ya muerto en Postiz) bloquearía el CAS posterior
    // con un 409 espurio. Lo limpiamos AHORA, de forma atómica condicionada al
    // postiz_id viejo concreto: si otro request ya lo cambió entre tanto, este
    // UPDATE no hace nada y el CAS de abajo decidirá quién gana.
    if (targetItem.postiz_id && targetItem.publish_state === 'failed') {
      const { error: clearErr } = await admin
        .from('content_items')
        .update({
          postiz_id: null,
          publish_state: null,
          publish_error: null,
          publish_synced_at: null,
          published_at: null,
        } as never)
        .eq('id', contentItemId)
        .eq('postiz_id', targetItem.postiz_id)
      if (clearErr) {
        // Si el cleanup falla, el postiz_id viejo sigue ahí y el CAS posterior
        // lo confundirá con una race ajena → rollback espurio del post nuevo.
        // Mejor abortar AQUÍ sin tocar Postiz que gastar una llamada gratis +
        // un delete-rollback engañando al usuario con un mensaje de race.
        console.error('[postiz/publish] cleanup de postiz_id viejo falló:', clearErr.message)
        return NextResponse.json({ error: 'precheck_cleanup_failed' }, { status: 500 })
      }
    }
  }

  // Tracking del resultado del upload de imágenes.
  let imagesUploaded   = 0
  const imageUploadErrors: string[] = []

  try {
    // 1. Subir todas las imágenes a Postiz (en serie para no saturar).
    //    Guardamos id + path: Postiz exige ambos en cada media.
    const postizImages: Array<{ id: string; path: string }> = []
    for (const url of allImageUrls) {
      try {
        const media = await postizUploadFromUrl(url)
        postizImages.push({ id: media.id, path: media.path })
        imagesUploaded++
      } catch (imgErr) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr)
        imageUploadErrors.push(msg.slice(0, 200))
        console.warn('[postiz/publish] upload-from-url falló:', msg)
      }
    }
    const imagesBlock = postizImages.length > 0 ? { image: postizImages } : {}

    // 2. Mapear channelId → providerIdentifier para construir `settings` por red.
    //    Postiz exige settings con __type específico (Instagram/X/TikTok tienen
    //    campos extra). Si no podemos saber qué red es cada canal, no podemos
    //    construir un settings válido y Postiz rechazará TODOS los posts con
    //    400. Hacemos hard fail aquí en vez de seguir y mostrar un error
    //    confuso al usuario después.
    let channelProviderById: Record<string, string>
    try {
      const channels = await postizGetChannels()
      channelProviderById = Object.fromEntries(channels.map(c => [c.id, c.identifier]))
    } catch (chErr) {
      const msg = chErr instanceof Error ? chErr.message : String(chErr)
      console.error('[postiz/publish] no se pudieron leer integraciones:', msg)
      return NextResponse.json(
        { error: 'postiz_integrations_unavailable', detail: msg.slice(0, 600) },
        { status: 502 },
      )
    }
    // Validar que todos los canales seleccionados existen en la lista de Postiz.
    // Un id desconocido casi siempre significa que el canal se desconectó entre
    // la carga del modal y el submit.
    const unknownChannelIds = channelIds.filter(id => !channelProviderById[id])
    if (unknownChannelIds.length > 0) {
      return NextResponse.json(
        { error: 'unknown_channel_ids', detail: `Canales no encontrados en Postiz: ${unknownChannelIds.join(', ')}` },
        { status: 400 },
      )
    }

    // 3. Construir el body completo con TODOS los campos que Postiz exige:
    //    date (siempre), shortLink, tags, y settings por post.
    const publishDate = (type === 'schedule' && scheduledAt) ? scheduledAt : new Date().toISOString()
    const postizBody: PostizCreatePostBody = {
      type,
      date: publishDate,
      shortLink: false,
      tags: [],
      posts: channelIds.map((id) => ({
        integration: { id },
        value: [
          {
            content: channelContents?.[id]?.trim() || content,
            ...imagesBlock,
          },
        ],
        settings: buildPostizSettings(channelProviderById[id] ?? ''),
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
          // Publicar ahora o programar mueve el item a la columna 'scheduled'
          // del pipeline para que su stage refleje que ya salió a Postiz
          // (antes el item se publicaba pero se quedaba en su columna previa,
          // p.ej. 'design', y la columna Programación no reflejaba la realidad).
          updates.stage = 'scheduled'
        } else if (type === 'schedule' && scheduledAt) {
          updates.scheduled_at = scheduledAt
          updates.stage = 'scheduled'
        }
        // type === 'draft' NO mueve el stage (es solo un borrador en Postiz).

        if (Object.keys(updates).length > 0) {
          // CAS contra race genuina: dos requests que pasaron el pre-check
          // simultáneamente competirán aquí. `.is('postiz_id', null)` solo
          // matchea filas que SIGUEN sin postiz_id — el segundo update afecta
          // 0 filas. Detectamos esa colisión y rollback del post huérfano en
          // Postiz (best-effort) para no dejar basura no apuntable.
          const { data: updated, error: updErr } = await admin
            .from('content_items')
            // `as never` es el patrón usado en el resto del codebase porque
            // los tipos generados de Supabase no infieren bien el shape de
            // .update() para tablas con muchas columnas.
            .update(updates as never)
            .eq('id', contentItemId)
            .is('postiz_id', null)
            .select('id')
          if (updErr) {
            // El UPDATE falló por razón NO relacionada con la race (error de
            // BD real, permisos, etc.). El post ya está en Postiz pero no
            // linkeado — huérfano igual que en la race. Rollback en Postiz.
            console.error('[postiz/publish] update BD falló, rollback en Postiz:', updErr.message)
            let rollbackOk = false
            if (postizId) {
              try {
                const rb = await postizDeletePost(postizId)
                rollbackOk = rb.ok
              } catch (rbErr) {
                console.error('[postiz/publish] rollback fallido — post huérfano en Postiz:', postizId, rbErr instanceof Error ? rbErr.message : rbErr)
              }
            }
            return NextResponse.json(
              {
                error: 'link_failed',
                detail: rollbackOk
                  ? 'Post creado pero no pudimos guardarlo en BD. Se ha cancelado en Postiz.'
                  : `Post creado pero no pudimos guardarlo en BD Y el rollback en Postiz falló. Post huérfano: ${postizId}. Contacta admin.`,
                postizId,
                rollbackOk,
              },
              { status: 500 },
            )
          } else if (!updated || updated.length === 0) {
            // Race detectada: otro request ya escribió postiz_id en el item.
            // Borramos el post recién creado en Postiz para no dejar huérfano.
            console.warn('[postiz/publish] race detectada — rollback del post huérfano:', postizId)
            let rollbackOk = false
            if (postizId) {
              try {
                const rb = await postizDeletePost(postizId)
                rollbackOk = rb.ok
              } catch (rbErr) {
                console.error('[postiz/publish] rollback fallido — post huérfano en Postiz:', postizId, rbErr instanceof Error ? rbErr.message : rbErr)
              }
            }
            return NextResponse.json(
              {
                error: 'race_conflict',
                detail: rollbackOk
                  ? 'Otro usuario publicó este item simultáneamente. El post duplicado se ha cancelado en Postiz.'
                  : `Otro usuario publicó este item simultáneamente. El duplicado NO se pudo cancelar en Postiz. Post huérfano: ${postizId}. Contacta admin.`,
                postizId,
                rollbackOk,
              },
              { status: 409 },
            )
          } else {
            linkedItemId = contentItemId
          }
        }
      } catch (linkErr) {
        console.warn('[postiz/publish] error vinculando item:', linkErr instanceof Error ? linkErr.message : String(linkErr))
      }
    }

    // success_level:
    //   'full'    → post creado + todas las imágenes subidas + link BD OK
    //   'partial' → post creado pero faltó alguna imagen (o ninguna)
    //   'link_failed' → post creado + imágenes OK pero content_item no linkeó
    //                   (contentItemId dado + linkedItemId null y no fue race).
    // La UI debería mostrar banner amarillo en 'partial' y rojo con contacto
    // admin si se quedó sin link.
    const requestedImages = allImageUrls.length
    const linkExpected    = !!contentItemId
    const successLevel: 'full' | 'partial' | 'link_failed' =
      (linkExpected && !linkedItemId) ? 'link_failed'
      : (requestedImages > 0 && imagesUploaded < requestedImages) ? 'partial'
      : 'full'
    // status HTTP: 200 en full, 207 (multi-status) en partial/link_failed para
    // que la UI pueda distinguir sin parsear el body.
    const httpStatus = successLevel === 'full' ? 200 : 207
    return NextResponse.json({
      ok: successLevel !== 'link_failed',
      successLevel,
      type,
      channelIds,
      linkedItemId,
      postizId,
      publishedAt,
      // Reportar conteo real de imágenes para que la UI lo refleje.
      imagesRequested: requestedImages,
      imagesUploaded,
      imageUploaded: imagesUploaded > 0,
      imageUploadError: imageUploadErrors.length > 0 ? 'upload_failed' : null,
      imageUploadErrors: imageUploadErrors.length > 0 ? imageUploadErrors : undefined,
      result,
    }, { status: httpStatus })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[postiz/publish] upstream error:', msg)
    // Solo admin/manager llegan hasta aquí (gate de rol más arriba), así que
    // podemos devolver el detalle del error de Postiz para diagnóstico. NO
    // contiene la API key (postizFetch nunca la mete en el mensaje), solo
    // método, path y el body de error de Postiz.
    return NextResponse.json(
      { error: 'postiz_upstream_failed', detail: msg.slice(0, 600) },
      { status: 502 },
    )
  }
}
