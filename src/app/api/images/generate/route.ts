import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { genai, ENHANCER_MODEL, IMAGEN_DIMENSIONS, type AspectRatio } from '@/lib/gemini'
import { generateWithNanoBanana, type NanoBananaReference } from '@/lib/nano-banana'
import { matchTemplatesForItem } from '@/lib/creative-templates-match'
import type { CreativeTemplate } from '@/types/database'

// Cascada: Nano Banana 2 → Imagen 4 Ultra → Imagen 4 Base
// Nano Banana 2 es ~5x más rápido y tiene cuota mucho mayor.
// Imagen 4 queda como fallback si Nano Banana falla o no está disponible.
type ModelType = 'nano-banana' | 'imagen-ultra' | 'imagen-base'

const MODEL_CASCADE: Array<{ id: string; type: ModelType }> = [
  { id: 'gemini-3.1-flash-image',       type: 'nano-banana'  },
  { id: 'imagen-4.0-ultra-generate-001', type: 'imagen-ultra' },
  { id: 'imagen-4.0-generate-001',       type: 'imagen-base'  },
]

function shouldFallback(err: unknown): boolean {
  const e = err as { status?: string; code?: number; message?: string }
  const status = e.status ?? ''
  const code = e.code ?? 0
  const msg = (e.message ?? '').toLowerCase()
  return (
    status === 'RESOURCE_EXHAUSTED' ||
    code === 429 || code === 503 || code === 404 ||
    msg.includes('not found') || msg.includes('quota') || msg.includes('exhausted') ||
    msg.includes('unavailable') || msg.includes('no_image_returned')
  )
}

async function generateWithFallback(prompt: string, aspectRatio: string): Promise<{ imageBytes: string; modelUsed: string }> {
  for (const { id, type } of MODEL_CASCADE) {
    try {
      if (type === 'nano-banana') {
        const result = await generateWithNanoBanana(prompt, aspectRatio)
        return result
      }
      // Imagen 4 Ultra / Base
      const response = await genai.models.generateImages({
        model: id,
        prompt,
        config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio },
      })
      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
      if (imageBytes) return { imageBytes, modelUsed: id }
      console.warn(`Model ${id} returned no image, trying next...`)
    } catch (err: unknown) {
      const e = err as { status?: string; code?: number; message?: string }
      if (shouldFallback(err)) {
        console.warn(`Model ${id} unavailable (${e.status || e.code || e.message}), trying next...`)
        continue
      }
      throw err
    }
  }
  throw new Error('All image generation models are currently unavailable')
}

// ── Enhancer: enriquece el prompt usando Gemini Flash antes de Imagen 4 Ultra ─
async function enhancePromptForChannel(originalPrompt: string, aspectRatio: string): Promise<string> {
  const contextMap: Record<string, string> = {
    '1:1':  'Instagram feed post or LinkedIn square image',
    '16:9': 'LinkedIn banner, blog hero image or YouTube thumbnail',
    '9:16': 'Instagram Stories or Reels vertical format',
    '4:5':  'Instagram feed portrait post',
  }
  const context = contextMap[aspectRatio] ?? 'professional social media content'

  const systemPrompt = `You are a professional prompt engineer for AI image generation.
Enhance the following image prompt to produce high-quality, professional commercial photography.
Add relevant technical photography terms, lighting descriptions, composition details, and style keywords.
Keep the original intent but make it more detailed and technically precise.
Output ONLY the enhanced prompt, nothing else. Maximum 200 words.
Context: This image will be used for ${context}.`

  // Limitar a 3s — si Gemini Flash se demora, usamos el prompt original
  // para no agotar el presupuesto de tiempo del endpoint
  const ENHANCER_TIMEOUT_MS = 3000
  try {
    const enhancerPromise = genai.models.generateContent({
      model: ENHANCER_MODEL,
      contents: [{ role: 'user', parts: [{ text: `Original prompt: ${originalPrompt}` }] }],
      config: { systemInstruction: systemPrompt, maxOutputTokens: 300 },
    })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('enhancer_timeout')), ENHANCER_TIMEOUT_MS),
    )
    const res = await Promise.race([enhancerPromise, timeoutPromise])
    const enhanced = res.text?.trim()
    return enhanced && enhanced.length > 10 ? enhanced : originalPrompt
  } catch (e) {
    console.warn('Prompt enhancer failed/timeout, falling back to original:', e instanceof Error ? e.message : e)
    return originalPrompt
  }
}
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, maybeCleanupRateLimits } from '@/lib/rate-limit'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_RATIOS = Object.keys(IMAGEN_DIMENSIONS) as AspectRatio[]
const MAX_TEMPLATE_REFS = 5

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Descarga las plantillas del bucket como base64 y las prepara para
 * pasarlas al modelo. Si alguna falla, la descarta silenciosamente (mejor
 * generar con 3 refs que abortar todo por una rota).
 */
async function downloadTemplatesAsRefs(
  admin: ReturnType<typeof createAdminClient>,
  templates: CreativeTemplate[],
): Promise<{ refs: NanoBananaReference[]; usedIds: string[] }> {
  const results = await Promise.all(
    templates.map(async t => {
      try {
        const { data, error } = await admin.storage.from(BUCKET).download(t.storage_path)
        if (error || !data) return null
        const arrBuf = await data.arrayBuffer()
        const base64 = Buffer.from(arrBuf).toString('base64')
        return {
          ref: { imageBase64: base64, mimeType: t.mime_type } as NanoBananaReference,
          id:  t.id,
        }
      } catch {
        return null
      }
    }),
  )
  const ok = results.filter((r): r is NonNullable<typeof r> => r !== null)
  return {
    refs:    ok.map(r => r.ref),
    usedIds: ok.map(r => r.id),
  }
}

export async function POST(req: NextRequest) {
  // 1) Auth
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

  // Rate-limit IA best-effort (consistente con carousel): frena bucles/dobles
  // clicks que dispararían coste/cuota de Gemini.
  maybeCleanupRateLimits()
  const rl = checkRateLimit(`ai-image:${user.id}`, 15, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    )
  }

  // 2) Validar body
  let body: { prompt?: string; aspectRatio?: string; channel?: string; content_item_id?: string; baseImageUrl?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const prompt = body.prompt?.trim()
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 })

  const aspectRatio: AspectRatio =
    (ALLOWED_RATIOS.includes(body.aspectRatio as AspectRatio) ? body.aspectRatio : '1:1') as AspectRatio
  const size = IMAGEN_DIMENSIONS[aspectRatio]

  // baseImageUrl: foto del usuario sobre la que Nano Banana hará EDICIÓN
  // (image-to-image, no text-to-image). Se acepta solo si apunta al Storage
  // de Supabase del proyecto — evitamos SSRF y URLs arbitrarias del exterior.
  // Si la URL no pasa el guard la rechazamos antes de descargar nada.
  const baseImageUrl = typeof body.baseImageUrl === 'string' && body.baseImageUrl.length > 0
    ? body.baseImageUrl
    : null
  if (baseImageUrl) {
    try {
      const u = new URL(baseImageUrl)
      if (u.protocol !== 'https:') {
        return NextResponse.json({ error: 'invalid_base_image_url' }, { status: 400 })
      }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
      }
      const supabaseHost = new URL(supabaseUrl).host
      if (u.host !== supabaseHost) {
        return NextResponse.json({ error: 'invalid_base_image_url' }, { status: 400 })
      }
      if (!/^\/storage\/v1\/object\/public\//.test(u.pathname)) {
        return NextResponse.json({ error: 'invalid_base_image_url' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'invalid_base_image_url' }, { status: 400 })
    }
  }

  // 2b) Si llega content_item_id, validamos que el usuario tenga permiso sobre
  // ese item ANTES de vincular el asset y de buscar plantillas. Mismo gate que
  // PATCH /api/images/[id]: el actor debe ser owner del item O admin/manager.
  // Si no pasa el gate, NO vinculamos pero seguimos generando sin refs.
  let templateRefs: NanoBananaReference[] = []
  let usedTemplateIds: string[] = []
  let templatesPromptNotes: string[] = []
  let contentItemId: string | null = typeof body.content_item_id === 'string' && body.content_item_id.length > 0
    ? body.content_item_id : null

  if (contentItemId) {
    const { data: ci } = await admin
      .from('content_items')
      .select('id, created_by')
      .eq('id', contentItemId)
      .maybeSingle<{ id: string; created_by: string | null }>()
    const ciOwner = !!ci && ci.created_by === profile.id
    const ciPriv  = profile.role === 'admin' || profile.role === 'manager'
    if (!ci || (!ciOwner && !ciPriv)) {
      // Sin permiso → degradar: el asset se crea sin vinculación ni refs.
      console.warn('[images/generate] content_item_id sin permiso, generando sin vínculo')
      contentItemId = null
    }
  }

  if (contentItemId) {
    try {
      const { templates, promptNotes } = await matchTemplatesForItem(
        admin, contentItemId, (body.channel ?? '').toLowerCase() || null, { cap: MAX_TEMPLATE_REFS },
      )
      if (templates.length > 0) {
        const refs = await downloadTemplatesAsRefs(admin, templates)
        templateRefs = refs.refs
        usedTemplateIds = refs.usedIds
        templatesPromptNotes = promptNotes
      }
    } catch (e) {
      console.warn('[images/generate] template loading failed (no bloqueante):', e instanceof Error ? e.message : e)
    }
  }

  // 2c) Si hay baseImageUrl, descargarla del Storage. Va PRIMERO en el array
  // de refs (la foto del usuario es la BASE a editar; las plantillas son guía
  // de estilo secundaria). Si la descarga falla, ABORTAMOS con 502 — el
  // usuario subió la foto explícitamente y espera image-to-image; degradar
  // silenciosamente a text-to-image violaría esa expectativa.
  // Whitelist de mime types aceptados por Nano Banana (mismos que upload).
  const BASE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp'])
  const BASE_IMAGE_MAX_BYTES = 10 * 1024 * 1024 // 10 MB (consistente con upload)
  let baseImageRef: NanoBananaReference | null = null
  if (baseImageUrl) {
    let respStatus: number | string = '?'
    let respMime = ''
    try {
      const resp = await fetch(baseImageUrl)
      respStatus = resp.status
      if (!resp.ok) {
        return NextResponse.json(
          { error: 'base_image_unavailable', detail: `No se pudo descargar la foto base (HTTP ${resp.status}). Reintenta o sube la foto de nuevo.` },
          { status: 502 },
        )
      }
      const rawMime = (resp.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      respMime = rawMime
      if (!BASE_IMAGE_MIMES.has(rawMime)) {
        return NextResponse.json(
          { error: 'base_image_invalid_mime', detail: `Formato no soportado para foto base: ${rawMime || 'desconocido'}. Usa PNG, JPG o WebP.` },
          { status: 400 },
        )
      }
      const arrBuf = await resp.arrayBuffer()
      if (arrBuf.byteLength > BASE_IMAGE_MAX_BYTES) {
        return NextResponse.json(
          { error: 'base_image_too_large', detail: 'La foto base supera los 10 MB.' },
          { status: 413 },
        )
      }
      baseImageRef = {
        imageBase64: Buffer.from(arrBuf).toString('base64'),
        mimeType: rawMime,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[images/generate] baseImageUrl fetch error:', { status: respStatus, mime: respMime, msg })
      return NextResponse.json(
        { error: 'base_image_unavailable', detail: 'Error de red al descargar la foto base.' },
        { status: 502 },
      )
    }
  }

  try {
    // 3a) Enriquecer el prompt con Gemini Flash (degradación silenciosa si falla)
    const enhancedPromptBase = await enhancePromptForChannel(prompt, aspectRatio)
    // Si hay foto base, dejamos claro al modelo que es image-to-image: usar
    // la PRIMERA imagen adjunta como punto de partida y EDITARLA siguiendo
    // el prompt y las plantillas. Sin esto, el modelo a veces ignora la
    // base y genera desde cero.
    const baseDirective = baseImageRef
      ? `IMPORTANT — image editing task: the FIRST attached image is the base photo provided by the user. PRESERVE its main subject, framing and lighting; apply the edits described in the prompt (overlays, logos, brand elements) and match the style suggested by the remaining reference images.\n\n`
      : ''
    const enhancedPrompt = templatesPromptNotes.length > 0
      ? `${baseDirective}${enhancedPromptBase}\n\nBrand & template guidance:\n${templatesPromptNotes.map(n => `- ${n}`).join('\n')}`
      : `${baseDirective}${enhancedPromptBase}`

    // 3b) Refs combinados: foto base PRIMERO (si la hay), luego plantillas.
    // Nano Banana es image-to-image friendly cuando recibe una imagen
    // marcada como "base" en el prompt. Si NO hay refs en absoluto,
    // caemos a la cascada normal (Imagen 4) que NO soporta multi-image.
    const allRefs: NanoBananaReference[] = baseImageRef
      ? [baseImageRef, ...templateRefs]
      : templateRefs
    const { imageBytes: imageBase64, modelUsed } = allRefs.length > 0
      ? await generateWithNanoBanana(enhancedPrompt, aspectRatio, allRefs, { editingMode: !!baseImageRef })
      : await generateWithFallback(enhancedPrompt, aspectRatio)
    console.log(`Image generated with model: ${modelUsed} (base=${baseImageRef ? 1 : 0}, templateRefs=${templateRefs.length})`)

    // 4) Subir a Supabase Storage
    const filename = `${user.id}/${Date.now()}-${aspectRatio.replace(':', 'x')}.png`
    const buffer = Buffer.from(imageBase64, 'base64')

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: 'image/png', upsert: false })
    if (uploadError) {
      console.error('[images/generate] storage upload failed:', uploadError.message)
      return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filename)

    // 4b) Auto-asignar folder system del channel si viene en el body
    const channel = (body.channel ?? '').toLowerCase()
    const validChannels = ['linkedin','instagram','facebook','x','blog','email','newsletter']
    const channelForRow = validChannels.includes(channel) ? channel : null
    let folderId: string | null = null
    if (channelForRow) {
      const { data: folder } = await admin
        .from('image_folders').select('id')
        .eq('system', true).eq('channel', channelForRow)
        .maybeSingle<{ id: string }>()
      folderId = folder?.id ?? null
    }

    // 5) Insertar en content_assets — incluye template_ids[] para trazabilidad
    //    y content_item_id si vino (lo vincula directo al item del pipeline).
    //    Si hubo foto base (image-to-image), anotamos su URL al prompt para
    //    poder auditar más tarde "qué foto se editó" sin necesitar tabla nueva.
    const persistedPrompt = baseImageUrl
      ? `${prompt}\n\n[base_image: ${baseImageUrl}]`
      : prompt
    const insertRow = {
      storage_path: filename,
      prompt: persistedPrompt,
      approved: false,
      created_by: user.id,
      aspect_ratio: aspectRatio,
      width: size.width,
      height: size.height,
      mime_type: 'image/png',
      asset_type: 'image',
      channel: channelForRow,
      folder_id: folderId,
      template_ids: usedTemplateIds,
      content_item_id: contentItemId,
    }
    const { data: asset, error: dbError } = await admin
      .from('content_assets')
      .insert(insertRow as never)
      .select('*')
      .single()
    if (dbError) {
      // Rollback: limpia el archivo huérfano en Storage si el insert falla
      await admin.storage.from(BUCKET).remove([filename]).catch(() => {})
      console.error('[images/generate] db insert failed:', dbError.message)
      return NextResponse.json({ error: 'db_failed' }, { status: 500 })
    }

    return NextResponse.json({
      id: (asset as { id: string }).id,
      url: urlData.publicUrl,
      prompt,
      aspectRatio,
      approved: false,
      created_at: (asset as { created_at: string }).created_at,
      width: size.width,
      height: size.height,
      template_ids: usedTemplateIds,
      content_item_id: contentItemId,
    })
  } catch (err: unknown) {
    console.error('[images/generate] error:', err instanceof Error ? err.message : err)
    // Detectamos casos transitorios y devolvemos status apropiado para que el cliente reintente
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'generation_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
