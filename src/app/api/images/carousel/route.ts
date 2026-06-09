import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { genai, IMAGEN_BASE_MODEL, IMAGEN_DIMENSIONS, type AspectRatio } from '@/lib/gemini'
import { generateWithNanoBanana, generateNanoBananaVariants } from '@/lib/nano-banana'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const ALLOWED_RATIOS = Object.keys(IMAGEN_DIMENSIONS) as AspectRatio[]
const MIN_N = 2
const MAX_N = 4

export const runtime = 'nodejs'
export const maxDuration = 180 // hasta 3 min (curated 4× puede tardar)

// ── Fallback Nano Banana 2 → Imagen 4 Ultra → Imagen 4 Base ──────────────────
type ModelType = 'nano-banana' | 'imagen-ultra' | 'imagen-base'
const MODEL_CASCADE: Array<{ id: string; type: ModelType }> = [
  { id: 'gemini-3.1-flash-image',        type: 'nano-banana'  },
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

async function generateOneWithFallback(prompt: string, aspectRatio: AspectRatio): Promise<{ imageBytes: string; modelUsed: string }> {
  for (const { id, type } of MODEL_CASCADE) {
    try {
      if (type === 'nano-banana') {
        return await generateWithNanoBanana(prompt, aspectRatio)
      }
      const response = await genai.models.generateImages({
        model: id, prompt, config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio },
      })
      const bytes = response.generatedImages?.[0]?.image?.imageBytes
      if (bytes) return { imageBytes: bytes, modelUsed: id }
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

// ── Variantes: prueba Nano Banana primero (N llamadas paralelas), fallback a Imagen Base ─
async function generateVariants(prompt: string, n: number, aspectRatio: AspectRatio): Promise<string[]> {
  // Intento 1: Nano Banana 2 en paralelo — mucho más rápido
  try {
    const out = await generateNanoBananaVariants(prompt, n, aspectRatio)
    if (out.length > 0) return out
  } catch (err) {
    if (!shouldFallback(err)) throw err
    console.warn('Nano Banana variants failed, falling back to Imagen 4 Base...')
  }

  // Fallback: Imagen 4 Base con numberOfImages = N (1 sola llamada)
  const response = await genai.models.generateImages({
    model: IMAGEN_BASE_MODEL,
    prompt,
    config: { numberOfImages: n, outputMimeType: 'image/png', aspectRatio },
  })
  const out: string[] = []
  for (const g of response.generatedImages ?? []) {
    if (g.image?.imageBytes) out.push(g.image.imageBytes)
  }
  if (out.length === 0) throw new Error('no_images_returned')
  return out
}

export async function POST(req: NextRequest) {
  // 1) Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2) Validar body
  let body: { mode?: string; prompts?: string[]; aspectRatio?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const mode = body.mode === 'variants' || body.mode === 'curated' ? body.mode : null
  if (!mode) return NextResponse.json({ error: 'invalid_mode (variants|curated)' }, { status: 400 })

  const prompts = Array.isArray(body.prompts) ? body.prompts.map(p => (p ?? '').trim()).filter(Boolean) : []
  if (prompts.length === 0) return NextResponse.json({ error: 'prompts_required' }, { status: 400 })

  const aspectRatio: AspectRatio =
    (ALLOWED_RATIOS.includes(body.aspectRatio as AspectRatio) ? body.aspectRatio : '1:1') as AspectRatio
  const size = IMAGEN_DIMENSIONS[aspectRatio]

  // Validar N según modo
  if (mode === 'variants') {
    if (prompts.length !== 1) return NextResponse.json({ error: 'variants_mode_requires_exactly_1_prompt' }, { status: 400 })
  }
  // Para curated, prompts.length define N (2-4). Para variants, validamos un campo extra:
  let nImages: number
  if (mode === 'variants') {
    const reqN = Math.floor(Number((body as { count?: number }).count ?? 4))
    if (reqN < MIN_N || reqN > MAX_N) return NextResponse.json({ error: `count must be ${MIN_N}-${MAX_N}` }, { status: 400 })
    nImages = reqN
  } else {
    if (prompts.length < MIN_N || prompts.length > MAX_N) {
      return NextResponse.json({ error: `prompts length must be ${MIN_N}-${MAX_N}` }, { status: 400 })
    }
    nImages = prompts.length
  }

  try {
    // 3) Generación
    const imagesBase64: string[] = []
    const promptsForRow: string[] = [] // prompt asociado a cada imagen (mismo en variants, distinto en curated)

    if (mode === 'variants') {
      const bytes = await generateVariants(prompts[0], nImages, aspectRatio)
      for (let i = 0; i < bytes.length; i++) {
        imagesBase64.push(bytes[i])
        promptsForRow.push(prompts[0])
      }
      // Si el modelo devolvió menos de N (raro), reflejamos lo que vino
      if (imagesBase64.length === 0) {
        return NextResponse.json({ error: 'no_images_returned' }, { status: 502 })
      }
    } else {
      // curated: secuencial, 1 call por slide
      for (let i = 0; i < prompts.length; i++) {
        const { imageBytes, modelUsed } = await generateOneWithFallback(prompts[i], aspectRatio)
        console.log(`Carousel curated slide ${i + 1}/${prompts.length} → ${modelUsed}`)
        imagesBase64.push(imageBytes)
        promptsForRow.push(prompts[i])
      }
    }

    // 3b) Auto-asignar folder system del channel si viene en el body
    const channelRaw = ((body as { channel?: string }).channel ?? '').toLowerCase()
    const validChannelsList = ['linkedin','instagram','facebook','x','blog','email','newsletter']
    const channelForRow = validChannelsList.includes(channelRaw) ? channelRaw : null
    let folderId: string | null = null
    if (channelForRow) {
      const { data: folder } = await admin
        .from('image_folders').select('id')
        .eq('system', true).eq('channel', channelForRow)
        .maybeSingle<{ id: string }>()
      folderId = folder?.id ?? null
    }

    // 4) Subir cada imagen + insertar fila
    // Estrategia all-or-nothing: si algo falla en cualquier paso, rollback completo
    // (Storage.remove + DB.delete por carousel_id) para no dejar carruseles parciales.
    const carouselId = randomUUID()
    const ts = Date.now()
    const uploadedPaths: string[] = []
    const inserted: Array<{
      id: string; url: string; prompt: string; position: number;
      carousel_id: string; aspect_ratio: AspectRatio;
      approved: boolean; created_at: string; width: number; height: number;
    }> = []

    const rollback = async (reason: string, status: number) => {
      if (uploadedPaths.length > 0) {
        await admin.storage.from(BUCKET).remove(uploadedPaths).catch(err =>
          console.error('[carousel/rollback] storage cleanup failed:', err),
        )
      }
      if (inserted.length > 0) {
        try {
          await admin.from('content_assets').delete().eq('carousel_id', carouselId)
        } catch (e) {
          console.error('[carousel/rollback] db cleanup failed:', e instanceof Error ? e.message : e)
        }
      }
      console.error('[carousel] rollback triggered:', reason)
      // No exponemos el motivo crudo al cliente — puede contener nombres de columna/path
      return NextResponse.json({ error: 'carousel_failed', carousel_id: carouselId, rolled_back: true }, { status })
    }

    for (let i = 0; i < imagesBase64.length; i++) {
      const filename = `${user.id}/${ts}-c${carouselId.slice(0, 8)}-${i}-${aspectRatio.replace(':', 'x')}.png`
      const buffer = Buffer.from(imagesBase64[i], 'base64')

      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(filename, buffer, { contentType: 'image/png', upsert: false })
      if (upErr) {
        return await rollback(`storage: ${upErr.message}`, 500)
      }
      uploadedPaths.push(filename)

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(filename)

      const insertRow = {
        storage_path: filename,
        prompt: promptsForRow[i],
        approved: false,
        created_by: user.id,
        aspect_ratio: aspectRatio,
        width: size.width,
        height: size.height,
        mime_type: 'image/png',
        asset_type: 'image',
        carousel_id: carouselId,
        position: i,
        channel: channelForRow,
        folder_id: folderId,
      }
      const { data: asset, error: dbErr } = await admin
        .from('content_assets')
        .insert(insertRow as never)
        .select('id, created_at')
        .single<{ id: string; created_at: string }>()
      if (dbErr || !asset) {
        return await rollback(`db: ${dbErr?.message ?? 'no_asset'}`, 500)
      }

      inserted.push({
        id: asset.id,
        url: urlData.publicUrl,
        prompt: promptsForRow[i],
        position: i,
        carousel_id: carouselId,
        aspect_ratio: aspectRatio,
        approved: false,
        created_at: asset.created_at,
        width: size.width,
        height: size.height,
      })
    }

    return NextResponse.json({
      carousel_id: carouselId,
      mode,
      aspectRatio,
      assets: inserted,
    })
  } catch (err: unknown) {
    console.error('[images/carousel] error:', err instanceof Error ? err.message : err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'carousel_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
