import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateWithNanoBanana, type NanoBananaReference } from '@/lib/nano-banana'
import { checkRateLimit, maybeCleanupRateLimits } from '@/lib/rate-limit'
import type { ContentItem, Profile, Market } from '@/types/database'

const BUCKET = 'content-assets'
export const runtime = 'nodejs'
export const maxDuration = 60

const MARKET_LANG: Record<Market, string> = {
  spain:    'Spanish (Spain)',
  latam:    'neutral Latin American Spanish',
  uk:       'international English (neutral, no regionalisms)',
  france:   'French',
  italy:    'Italian',
  portugal: 'European Portuguese (Portugal)',
  brasil:   'Brazilian Portuguese',
  mexico:   'Mexican Spanish',
}

/**
 * POST /api/content-items/:id/translate-image
 *
 * Genera una imagen idéntica a la del item origen pero con TODO el texto
 * visible traducido al idioma del item destino. Usa Nano Banana 2 con la
 * imagen original como referencia (image-to-image preservando layout/marca).
 *
 * Flujo:
 *   1. Item destino debe ser una réplica (replicated_from != null) o el
 *      caller debe pasar source_item_id en el body.
 *   2. Tomamos la imagen primaria del item origen (content_asset más reciente
 *      vinculado a source.id).
 *   3. Construimos el prompt con instrucciones de "replica exactamente, solo
 *      traduce el texto a X idioma" + el copy del item destino como referencia
 *      del texto que debe aparecer en la imagen.
 *   4. Llamamos Nano Banana con la imagen original como ref visual.
 *   5. Subimos el resultado, creamos content_asset vinculado al item destino.
 *
 * Body opcional:
 *   - source_item_id?: string   — override del replicated_from (raro).
 *   - extraInstructions?: string — brief libre del usuario (max 1000 chars).
 *
 * Auth: owner del item destino o admin/manager (mismo gate que generate).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // 1) Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Rate-limit: misma franja que generate de imagen (15/min). Cada llamada
  // hace 1 download + 1 generación Nano Banana + 1 upload.
  maybeCleanupRateLimits()
  const rl = checkRateLimit(`ai-image:${user.id}`, 15, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    )
  }

  const { id } = await ctx.params

  // 2) Body
  let body: { source_item_id?: string; extraInstructions?: string } = {}
  try { body = await req.json() } catch {}
  const extraInstructions = typeof body.extraInstructions === 'string'
    ? body.extraInstructions.trim().slice(0, 1000)
    : ''

  // 3) Item destino
  const { data: target, error: tgtErr } = await admin
    .from('content_items').select('*').eq('id', id)
    .single<ContentItem>()
  if (tgtErr || !target) return NextResponse.json({ error: 'item_not_found' }, { status: 404 })

  // Autorización: owner o admin/manager (mismo gate que /generate).
  const isOwner = target.created_by === user.id
  const isPriv  = profile.role === 'admin' || profile.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 4) Determinar item origen
  const sourceId = (typeof body.source_item_id === 'string' && body.source_item_id.length > 0)
    ? body.source_item_id
    : target.replicated_from
  if (!sourceId) {
    return NextResponse.json(
      { error: 'no_source_item', detail: 'Este item no es una réplica. Indica source_item_id en el body o usa este endpoint sobre un item replicado.' },
      { status: 400 },
    )
  }
  if (sourceId === target.id) {
    return NextResponse.json({ error: 'source_equals_target' }, { status: 400 })
  }

  const { data: source } = await admin
    .from('content_items').select('id, market, content')
    .eq('id', sourceId)
    .maybeSingle<Pick<ContentItem, 'id' | 'market' | 'content'>>()
  if (!source) return NextResponse.json({ error: 'source_not_found' }, { status: 404 })

  // Si los mercados coinciden no hay traducción que hacer — ahorra cuota
  // Gemini y evita confundir al modelo con "translate from X to X".
  if (source.market === target.market) {
    return NextResponse.json(
      { error: 'same_market', detail: 'El item origen y el destino están en el mismo mercado — no hay nada que traducir.' },
      { status: 400 },
    )
  }

  // 5) Imagen primaria del origen — el asset más reciente vinculado.
  // Prioridad: aprobado primero (asignación explícita del usuario), luego el
  // más reciente. Solo type='image' (no documentos).
  const { data: srcAsset } = await admin
    .from('content_assets')
    .select('id, storage_path, mime_type, aspect_ratio, prompt')
    .eq('content_item_id', source.id)
    .eq('asset_type', 'image')
    .order('approved', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string
      storage_path: string
      mime_type: string | null
      aspect_ratio: string | null
      prompt: string | null
    }>()
  if (!srcAsset) {
    return NextResponse.json(
      { error: 'source_has_no_image', detail: 'El item original no tiene imagen asignada que poder traducir.' },
      { status: 400 },
    )
  }

  // 6) Descargar bytes
  const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(srcAsset.storage_path)
  if (dlErr || !file) {
    console.error('[translate-image] storage download failed:', dlErr?.message)
    return NextResponse.json({ error: 'source_image_download_failed' }, { status: 502 })
  }
  const arrBuf = await file.arrayBuffer()
  const refBase64 = Buffer.from(arrBuf).toString('base64')
  const refMime = srcAsset.mime_type || 'image/png'

  // 7) Construir prompt de traducción visual
  const sourceLang = MARKET_LANG[source.market as Market] ?? 'the original language'
  const targetLang = MARKET_LANG[target.market as Market] ?? 'the target language'

  // El copy traducido sirve al modelo como "qué decir" pero NO debe usarse
  // tal cual: la imagen tiene espacio limitado y solo cabe un titular corto.
  // Le pasamos el copy como CONTEXTO, no como texto literal a meter.
  const targetCopySnippet = (target.content ?? '').trim().slice(0, 400)

  const prompt = [
    `Recreate the attached reference image EXACTLY.`,
    `Keep IDENTICAL: layout, composition, background, brand colors, typography style, all visual elements, logos, icons, decorative elements, and proportions.`,
    `ONLY change one thing: translate ALL visible text on the image from ${sourceLang} into ${targetLang}.`,
    `Translation rules:`,
    `- Keep the meaning, marketing intent, and tone of the original text.`,
    `- Preserve text formatting: line breaks, capitalization, emphasis, font weight.`,
    `- If the original text is short and punchy, the translation must also be short — never overflow the original text box.`,
    `- Translate brand names ONLY if they are translated in the brand's official communication; otherwise keep them as-is.`,
    `- Do NOT add, remove, or rearrange any text. Keep the same number of text blocks in the same positions.`,
    targetCopySnippet
      ? `\nReference for tone/terminology of the translated copy in ${targetLang} (DO NOT paste this text literally onto the image — it is only a hint for translation style and vocabulary):\n"""\n${targetCopySnippet}\n"""`
      : null,
    extraInstructions
      ? `\nAdditional user instructions (high priority):\n${extraInstructions}`
      : null,
  ].filter(Boolean).join('\n')

  const aspectRatio = srcAsset.aspect_ratio || '1:1'

  // 8) Generar con Nano Banana usando la imagen original como ref
  const refs: NanoBananaReference[] = [{ imageBase64: refBase64, mimeType: refMime }]
  let imageBytes: string
  try {
    const out = await generateWithNanoBanana(prompt, aspectRatio, refs)
    imageBytes = out.imageBytes
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[translate-image] nano-banana failed:', msg)
    const lower = msg.toLowerCase()
    const transient = lower.includes('quota') || lower.includes('exhausted') || lower.includes('unavailable')
    return NextResponse.json(
      { error: transient ? 'models_unavailable' : 'generation_failed', detail: msg.slice(0, 600) },
      { status: transient ? 503 : 500 },
    )
  }

  // 9) Subir a Storage
  const filename = `${user.id}/${Date.now()}-translated-${aspectRatio.replace(':', 'x')}.png`
  const buffer = Buffer.from(imageBytes, 'base64')
  const { error: upErr } = await admin.storage.from(BUCKET).upload(filename, buffer, {
    contentType: 'image/png',
    upsert: false,
  })
  if (upErr) {
    console.error('[translate-image] storage upload failed:', upErr.message)
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
  }
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filename)

  // 10) Desvincular assets previos del item destino (atómico server-side).
  // Sin esto, tras varias traducciones quedarían N assets con el mismo
  // content_item_id, contaminando el banco filtrado y dependiendo del ORDER BY
  // para mostrar el "correcto". El cliente NO puede garantizar esto
  // (translate-image se llama directo, saltando assignAsset). NO borramos
  // las filas: solo las desvinculamos — el asset queda en el banco como
  // imagen suelta utilizable.
  const { error: clearErr } = await admin
    .from('content_assets')
    .update({ content_item_id: null } as never)
    .eq('content_item_id', target.id)
    .eq('asset_type', 'image')
  if (clearErr) {
    console.warn('[translate-image] no se pudieron desvincular assets previos:', clearErr.message)
    // No bloqueamos — el insert siguiente igual funciona, peor caso quedan 2
    // vinculados (situación pre-fix). Mejor degradación que abortar.
  }

  // 11) Insertar asset vinculado al item destino. channel = canal del item
  // destino para que aparezca en filtros del banco por canal.
  const insertRow = {
    storage_path:   filename,
    prompt:         `[Traducción de imagen del item ${source.id}] ${srcAsset.prompt ?? ''}`.slice(0, 2000),
    approved:       false,
    created_by:     user.id,
    aspect_ratio:   aspectRatio,
    mime_type:      'image/png',
    asset_type:     'image',
    channel:        target.channel,
    content_item_id: target.id,
  }
  const { data: asset, error: insErr } = await admin
    .from('content_assets').insert(insertRow as never)
    .select('id, created_at').single<{ id: string; created_at: string }>()
  if (insErr || !asset) {
    // Rollback del archivo huérfano. Si la limpieza falla, LOGUEAR (no
    // silenciar) — el archivo queda huérfano pero al menos hay rastro para
    // auditoría/limpieza manual.
    const { error: rmErr } = await admin.storage.from(BUCKET).remove([filename])
    if (rmErr) {
      console.error('[translate-image] db insert failed Y storage rollback FALLÓ (archivo huérfano):', filename, rmErr.message)
    } else {
      console.error('[translate-image] db insert failed:', insErr?.message)
    }
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: asset.id,
    url: urlData.publicUrl,
    aspect_ratio: aspectRatio,
    source_item_id: source.id,
    source_asset_id: srcAsset.id,
    created_at: asset.created_at,
  })
}
