import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizGetPosts, type PostizPost } from '@/lib/postiz'
import type { Profile, Channel } from '@/types/database'

/**
 * Mapea el providerIdentifier de Postiz a nuestro enum Channel.
 * content_items.channel SOLO permite: linkedin, instagram, facebook, x,
 * blog, email, newsletter. Cualquier red que Postiz soporte pero nosotros
 * no (mastodon, bluesky, threads, tiktok, youtube, pinterest, reddit…)
 * devuelve null → ese post se SALTA en la importación (no se mete basura
 * que viole el check constraint ni que el pipeline no sepa pintar).
 */
function mapProviderToChannel(provider: string | undefined | null): Channel | null {
  if (!provider) return null
  const p = provider.toLowerCase()
  if (p.startsWith('linkedin'))  return 'linkedin'
  if (p.startsWith('instagram')) return 'instagram'
  if (p.startsWith('facebook'))  return 'facebook'
  if (p === 'x' || p === 'twitter') return 'x'
  return null
}

/**
 * POST /api/postiz/import
 *
 * Importa los posts existentes en Postiz que NO están vinculados a ningún
 * content_item de iGEO. Crea un content_item nuevo por cada post huérfano,
 * con stage='scheduled' o 'analyzed' según el estado.
 *
 * One-shot: pensado para ejecutarse manualmente desde un botón en /settings
 * cuando se conecta Postiz por primera vez y ya hay histórico en la cuenta.
 *
 * Idempotente: si un post ya tiene content_item con ese postiz_id, lo salta.
 *
 * Solo admin (es una operación masiva que puede crear muchos items).
 */
export async function POST() {
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
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let postizPosts: PostizPost[]
  try {
    const { posts } = await postizGetPosts()
    postizPosts = Array.isArray(posts) ? posts : []
  } catch (err) {
    console.error('[postiz/import] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }

  if (postizPosts.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: 0, unsupported: 0 })
  }

  // 1) Buscar postiz_ids ya conocidos en BD para evitar duplicar.
  const ids = postizPosts.map(p => p.id).filter(Boolean)
  const { data: existing } = await admin
    .from('content_items')
    .select('postiz_id')
    .in('postiz_id', ids)
    .returns<Array<{ postiz_id: string }>>()
  const knownIds = new Set((existing ?? []).map(e => e.postiz_id))

  const candidates = postizPosts.filter(p => p.id && !knownIds.has(p.id))
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: postizPosts.length, unsupported: 0 })
  }

  // 2) Insertar como content_items con la info que Postiz nos da.
  //    - channel: mapeado de providerIdentifier → nuestro enum. Los posts de
  //      redes que no soportamos (mastodon, bluesky, tiktok…) se SALTAN.
  //    - market: Postiz no nos dice el mercado → default 'spain' (valor válido
  //      del enum Market). El admin puede reasignarlo desde el pipeline.
  //    - stage: analyzed si published, scheduled si futuro.
  const DEFAULT_MARKET = 'spain'  // válido en el enum Market
  const nowIso = new Date().toISOString()

  let unsupported = 0
  const rows = candidates.flatMap(p => {
    const channel = mapProviderToChannel(p.integration?.providerIdentifier)
    if (!channel) { unsupported++; return [] }  // red no soportada → skip
    const isPublished = (p.state ?? '').toUpperCase() === 'PUBLISHED'
    return [{
      title: (p.content ?? '').slice(0, 200) || 'Post importado desde Postiz',
      content: p.content ?? null,
      description: null,
      channel,
      market: DEFAULT_MARKET,
      stage: isPublished ? 'analyzed' : 'scheduled',
      status: 'approved',
      campaign: null,
      ai_generated: false,
      clarity_pass: null,
      clarity_summary: null,
      human_approved: true,
      approved_by: user.id,
      approved_at: nowIso,
      scheduled_at: p.publishDate ?? null,
      published_at: isPublished ? (p.publishDate ?? nowIso) : null,
      postiz_id: p.id,
      publish_state: isPublished ? 'published' : 'queued',
      publish_synced_at: nowIso,
      created_by: user.id,
    }]
  })

  if (rows.length === 0) {
    // Todos los candidatos eran de redes no soportadas.
    return NextResponse.json({ ok: true, imported: 0, skipped: postizPosts.length - candidates.length, unsupported })
  }

  const { data: inserted, error: insErr } = await admin
    .from('content_items')
    .insert(rows as never)
    .select('id')
  if (insErr) {
    console.error('[postiz/import] insert error:', insErr.message)
    return NextResponse.json({ error: 'db_insert_failed', detail: insErr.message }, { status: 500 })
  }

  const importedCount = inserted?.length ?? 0
  return NextResponse.json({
    ok: true,
    imported: importedCount,
    skipped: knownIds.size,          // ya existían en iGEO
    unsupported,                     // redes que no soportamos (mastodon, etc.)
  })
}
