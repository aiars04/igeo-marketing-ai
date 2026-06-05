import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { genai, ENHANCER_MODEL, IMAGEN_DIMENSIONS, type AspectRatio } from '@/lib/gemini'

// Cascada Ultra → Base; ante errores de capacidad probamos el siguiente
const MODELS_FALLBACK = [
  'imagen-4.0-ultra-generate-001',
  'imagen-4.0-generate-001',
]

async function generateWithFallback(prompt: string, aspectRatio: string): Promise<{ imageBytes: string; modelUsed: string }> {
  for (const model of MODELS_FALLBACK) {
    try {
      const response = await genai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio,
        },
      })
      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
      if (imageBytes) return { imageBytes, modelUsed: model }
      // Si no devolvió bytes pero tampoco lanzó, seguimos al siguiente modelo
      console.warn(`Model ${model} returned no image, trying next...`)
    } catch (err: unknown) {
      const e = err as { status?: string; code?: number; message?: string }
      const status = e.status ?? ''
      const code = e.code ?? 0
      const msg = (e.message ?? '').toLowerCase()
      // Solo hace fallback en errores de capacidad/disponibilidad
      if (
        status === 'RESOURCE_EXHAUSTED' ||
        code === 429 || code === 503 || code === 404 ||
        msg.includes('not found') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('unavailable')
      ) {
        console.warn(`Model ${model} unavailable (${status || code || 'unknown'}), trying next...`)
        continue
      }
      // Otros errores (prompt bloqueado, auth, etc.) los propaga
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

  try {
    const res = await genai.models.generateContent({
      model: ENHANCER_MODEL,
      contents: [{ role: 'user', parts: [{ text: `Original prompt: ${originalPrompt}` }] }],
      config: { systemInstruction: systemPrompt, maxOutputTokens: 300 },
    })
    const enhanced = res.text?.trim()
    return enhanced && enhanced.length > 10 ? enhanced : originalPrompt
  } catch (e) {
    console.warn('Prompt enhancer failed, falling back to original:', e instanceof Error ? e.message : e)
    return originalPrompt
  }
}
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_RATIOS = Object.keys(IMAGEN_DIMENSIONS) as AspectRatio[]

export const runtime = 'nodejs'
export const maxDuration = 60

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
  let body: { prompt?: string; aspectRatio?: string; channel?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const prompt = body.prompt?.trim()
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 })

  const aspectRatio: AspectRatio =
    (ALLOWED_RATIOS.includes(body.aspectRatio as AspectRatio) ? body.aspectRatio : '1:1') as AspectRatio
  const size = IMAGEN_DIMENSIONS[aspectRatio]

  try {
    // 3a) Enriquecer el prompt con Gemini Flash (degradación silenciosa si falla)
    const enhancedPrompt = await enhancePromptForChannel(prompt, aspectRatio)

    // 3b) Llamar Imagen 4 con cascada Ultra → Base
    const { imageBytes: imageBase64, modelUsed } = await generateWithFallback(enhancedPrompt, aspectRatio)
    console.log(`Image generated with model: ${modelUsed}`)

    // 4) Subir a Supabase Storage
    const filename = `${user.id}/${Date.now()}-${aspectRatio.replace(':', 'x')}.png`
    const buffer = Buffer.from(imageBase64, 'base64')

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: 'image/png', upsert: false })
    if (uploadError) {
      return NextResponse.json({ error: `storage: ${uploadError.message}` }, { status: 500 })
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

    // 5) Insertar en content_assets
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
    }
    const { data: asset, error: dbError } = await admin
      .from('content_assets')
      .insert(insertRow as never)
      .select('*')
      .single()
    if (dbError) {
      return NextResponse.json({ error: `db: ${dbError.message}` }, { status: 500 })
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
    })
  } catch (err: unknown) {
    console.error('Image generation error:', err)
    const message = err instanceof Error ? err.message : 'generation_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
