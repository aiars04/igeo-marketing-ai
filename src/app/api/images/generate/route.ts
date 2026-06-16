import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { genai, ENHANCER_MODEL, IMAGEN_DIMENSIONS, type AspectRatio } from '@/lib/gemini'
import { generateWithNanoBanana, type NanoBananaReference } from '@/lib/nano-banana'
import type { Channel, ContentItem, CreativeTemplate } from '@/types/database'

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
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_RATIOS = Object.keys(IMAGEN_DIMENSIONS) as AspectRatio[]
const MAX_TEMPLATE_REFS = 5

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Busca plantillas maestras que apliquen a este content_item:
 *   - channel = item.channel (o fallback al `channel` recibido en el body si
 *     el item no se encuentra)
 *   - market = item.market O market IS NULL (las "para todos los mercados")
 *   - active = true
 *   - si el item tiene content_type activo del canal, prioriza plantillas
 *     vinculadas a ese content_type via pivote; si NO hay ninguna vinculada,
 *     incluye las que no tienen filas pivote (= "aplican a todos los tipos")
 *
 * Devuelve max MAX_TEMPLATE_REFS ordenadas por created_at desc + notas para el prompt.
 */
async function loadMatchingTemplates(
  admin: ReturnType<typeof createAdminClient>,
  contentItemId: string,
  bodyChannel: string,
): Promise<{ templates: CreativeTemplate[]; notes: string[] }> {
  // Cargar item para conocer channel + market + (opcional) content_type
  const { data: item } = await admin
    .from('content_items')
    .select('id, channel, market')
    .eq('id', contentItemId)
    .single<Pick<ContentItem, 'id' | 'channel' | 'market'>>()

  const channel = (item?.channel ?? bodyChannel) as Channel
  if (!channel) return { templates: [], notes: [] }
  const market = item?.market ?? null

  // Buscar content_type activo del canal (1)
  let activeContentTypeId: string | null = null
  if (item) {
    const { data: ctRows } = await admin
      .from('content_types')
      .select('id')
      .eq('channel', channel).eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (ctRows && ctRows.length > 0) activeContentTypeId = (ctRows[0] as { id: string }).id
  }

  // Query base: canal + activo + (mercado del item O global)
  let q = admin
    .from('creative_templates')
    .select('*')
    .eq('channel', channel)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(50)
  if (market) q = q.or(`market.eq.${market},market.is.null`)
  else q = q.is('market', null)

  const { data: candidates } = await q.returns<CreativeTemplate[]>()
  if (!candidates || candidates.length === 0) return { templates: [], notes: [] }

  // Filtrado por content_type via pivote
  const ids = candidates.map(c => c.id)
  const { data: pivotRows } = await admin
    .from('creative_template_content_types')
    .select('template_id, content_type_id')
    .in('template_id', ids)
    .returns<Array<{ template_id: string; content_type_id: string }>>()

  const pivoteByTemplate = new Map<string, string[]>()
  for (const p of pivotRows ?? []) {
    const arr = pivoteByTemplate.get(p.template_id) ?? []
    arr.push(p.content_type_id)
    pivoteByTemplate.set(p.template_id, arr)
  }

  // Contrato: si una plantilla no tiene filas pivote, aplica a TODOS los
  // content_types del canal. Si tiene, solo a los enlazados.
  const filtered = candidates.filter(t => {
    const linked = pivoteByTemplate.get(t.id)
    if (!linked || linked.length === 0) return true
    if (!activeContentTypeId) return false  // tiene pivote pero no sabemos el ct → fuera
    return linked.includes(activeContentTypeId)
  })

  const picked = filtered.slice(0, MAX_TEMPLATE_REFS)
  const notes = picked
    .map(t => {
      const role = t.asset_role ? `${t.asset_role}` : 'plantilla'
      const noteTxt = t.notes ? `: ${t.notes}` : ''
      return `[${role} — ${t.name}]${noteTxt}`
    })
  return { templates: picked, notes }
}

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

  // 2) Validar body
  let body: { prompt?: string; aspectRatio?: string; channel?: string; content_item_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const prompt = body.prompt?.trim()
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 })

  const aspectRatio: AspectRatio =
    (ALLOWED_RATIOS.includes(body.aspectRatio as AspectRatio) ? body.aspectRatio : '1:1') as AspectRatio
  const size = IMAGEN_DIMENSIONS[aspectRatio]

  // 2b) Si llega content_item_id, buscamos plantillas matching para usar como
  // referencias visuales con Nano Banana. La lógica es resiliente: cualquier
  // fallo aquí degrada en generación SIN refs (no rompe el flujo).
  let templateRefs: NanoBananaReference[] = []
  let usedTemplateIds: string[] = []
  let templatesPromptNotes: string[] = []
  const contentItemId = typeof body.content_item_id === 'string' && body.content_item_id.length > 0
    ? body.content_item_id : null

  if (contentItemId) {
    try {
      const { templates, notes } = await loadMatchingTemplates(admin, contentItemId, (body.channel ?? '').toLowerCase())
      if (templates.length > 0) {
        const refs = await downloadTemplatesAsRefs(admin, templates)
        templateRefs = refs.refs
        usedTemplateIds = refs.usedIds
        templatesPromptNotes = notes
      }
    } catch (e) {
      console.warn('[images/generate] template loading failed (no bloqueante):', e instanceof Error ? e.message : e)
    }
  }

  try {
    // 3a) Enriquecer el prompt con Gemini Flash (degradación silenciosa si falla)
    const enhancedPromptBase = await enhancePromptForChannel(prompt, aspectRatio)
    // Si hay plantillas, añadimos sus notas como guía de estilo final.
    const enhancedPrompt = templatesPromptNotes.length > 0
      ? `${enhancedPromptBase}\n\nBrand & template guidance:\n${templatesPromptNotes.map(n => `- ${n}`).join('\n')}`
      : enhancedPromptBase

    // 3b) Si hay refs visuales, vamos DIRECTO a Nano Banana (Imagen 4 no soporta
    // multi-image input). Si falla → error directo (no fallback ciego sin refs,
    // perdería el sentido del feature). Si no hay refs, cascada completa.
    const { imageBytes: imageBase64, modelUsed } = templateRefs.length > 0
      ? await generateWithNanoBanana(enhancedPrompt, aspectRatio, templateRefs)
      : await generateWithFallback(enhancedPrompt, aspectRatio)
    console.log(`Image generated with model: ${modelUsed} (refs=${templateRefs.length})`)

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
    const insertRow = {
      storage_path: filename,
      prompt,
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
