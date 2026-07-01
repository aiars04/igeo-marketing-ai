import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { postizGetPosts, type PostizPost } from '@/lib/postiz'

/**
 * GET /api/cron/postiz-sync
 *
 * Cron de sincronización (Vercel Cron, cada 15 min). Lee los posts de
 * Postiz y actualiza content_items con el estado real de publicación.
 *
 * Postiz NO ofrece webhooks → este cron es la única forma de enterarnos
 * de que un post programado se publicó realmente o falló en una red.
 *
 * Mapeo de estado Postiz → content_items.publish_state:
 *   PUBLISHED      → 'published'  + published_at = post.publishDate
 *   ERROR / FAILED → 'failed'     + publish_error = razón si la trae
 *   QUEUE / SCHEDULED → 'queued'
 *   DRAFT          → null (no nos interesa para sync)
 *
 * Autenticación: Vercel Cron envía el header `Authorization: Bearer ${CRON_SECRET}`.
 * Si el secret no coincide, devolvemos 401. NO permitimos esta ruta vía
 * sesión Supabase — es solo para schedulers internos.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron/postiz-sync] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1) Pedir todos los posts a Postiz (devuelve los recientes — paginación
  // no documentada en el endpoint público, asumimos N posts más recientes).
  let postizPosts: PostizPost[]
  try {
    const { posts } = await postizGetPosts()
    postizPosts = Array.isArray(posts) ? posts : []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/postiz-sync] error obteniendo posts Postiz:', msg)
    // El endpoint está protegido con CRON_SECRET, podemos devolver el
    // detalle al caller para diagnóstico.
    return NextResponse.json({ error: 'postiz_upstream_failed', detail: msg }, { status: 502 })
  }

  if (postizPosts.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, total: 0 })
  }

  // 2) Buscar nuestros content_items que tengan postiz_id matching
  const postizIds = postizPosts.map(p => p.id).filter(Boolean)
  const { data: items, error: itemsErr } = await admin
    .from('content_items')
    .select('id, postiz_id, publish_state, published_at')
    .in('postiz_id', postizIds)
    .returns<Array<{ id: string; postiz_id: string; publish_state: string | null; published_at: string | null }>>()

  if (itemsErr) {
    console.error('[cron/postiz-sync] error leyendo content_items:', itemsErr.message)
    return NextResponse.json({ error: 'db_read_failed' }, { status: 500 })
  }

  const itemsByPostizId = new Map(items?.map(i => [i.postiz_id, i]) ?? [])
  const now = new Date().toISOString()
  let synced = 0
  const errors: string[] = []

  // 3) Por cada post de Postiz que matchea un item nuestro, decidir update
  for (const post of postizPosts) {
    const item = itemsByPostizId.get(post.id)
    if (!item) continue

    const state = mapPostizStateToOurs(post.state)
    if (!state) {
      // Estado no mapeado: puede ser 'draft' esperable, o algo NUEVO que
      // Postiz añadió sin que nosotros lo cubramos. Loguear con nivel error
      // para que sea grep-able en Vercel logs y podamos actualizarlo.
      if (!['DRAFT', 'draft'].includes(post.state)) {
        console.error(`[cron/postiz-sync] estado Postiz no mapeado: "${post.state}" (post ${post.id})`)
      }
      continue
    }

    // No tocar si nada cambia (evita escrituras innecesarias)
    if (item.publish_state === state && state !== 'failed') {
      continue
    }

    const updates: Record<string, unknown> = {
      publish_state: state,
      publish_synced_at: now,
    }
    if (state === 'published') {
      updates.published_at = post.publishDate ?? now
      updates.publish_error = null
    } else if (state === 'failed') {
      updates.publish_error = extractFailureReason(post)
    }

    const { error: updErr } = await admin
      .from('content_items')
      .update(updates as never)
      .eq('id', item.id)

    if (updErr) {
      errors.push(`${item.id}: ${updErr.message}`)
    } else {
      synced++
    }
  }

  return NextResponse.json({
    ok: true,
    synced,
    total: postizPosts.length,
    matched: items?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
  })
}

/**
 * Mapea el `state` de un post Postiz a nuestro vocabulario.
 * Postiz devuelve strings tipo 'PUBLISHED', 'ERROR', 'QUEUE', 'DRAFT'.
 * Si llega algo desconocido, devolvemos null y no tocamos el item.
 */
function mapPostizStateToOurs(state: string | undefined | null): 'queued' | 'published' | 'failed' | null {
  if (!state) return null
  const s = state.toUpperCase()
  if (s === 'PUBLISHED' || s === 'SENT' || s === 'COMPLETED') return 'published'
  if (s === 'ERROR' || s === 'FAILED' || s === 'FAIL') return 'failed'
  if (s === 'QUEUE' || s === 'QUEUED' || s === 'SCHEDULED' || s === 'PENDING') return 'queued'
  return null
}

/**
 * Extrae texto de error del post — Postiz no documenta este campo, lo
 * tomamos en best-effort si viene como `error`, `message` o `failureReason`.
 */
function extractFailureReason(post: PostizPost): string | null {
  const p = post as unknown as Record<string, unknown>
  for (const key of ['error', 'failureReason', 'message', 'reason'] as const) {
    const v = p[key]
    if (typeof v === 'string' && v.trim().length > 0) return v.slice(0, 500)
  }
  return 'Postiz reportó error en la publicación.'
}
