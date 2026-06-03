import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { genai, IMAGEN_MODEL, IMAGEN_DIMENSIONS, type AspectRatio } from '@/lib/gemini'
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
    // 3) Llamar a Imagen 4
    const response = await genai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio,
      },
    })

    const imageBase64 = response.generatedImages?.[0]?.image?.imageBytes
    if (!imageBase64) {
      return NextResponse.json({ error: 'no_image_returned' }, { status: 502 })
    }

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

    // 5) Insertar en content_assets (solo columnas existentes en la tabla)
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
