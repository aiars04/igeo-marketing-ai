import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postizCreatePost, postizUploadFromUrl, type PostizCreatePostBody } from '@/lib/postiz'

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
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    channelIds: string[]
    content: string
    imageUrl?: string
    scheduledAt?: string
    type?: 'schedule' | 'draft' | 'now'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { channelIds, content, imageUrl, scheduledAt } = body

  if (!channelIds?.length) {
    return NextResponse.json({ error: 'Se requiere al menos un channelId' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'El contenido no puede estar vacío' }, { status: 400 })
  }

  // Determinar tipo de publicación
  const type = body.type ?? (scheduledAt ? 'schedule' : 'now')
  if (type === 'schedule' && !scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt es requerido para type=schedule' }, { status: 400 })
  }

  try {
    // 1. Si hay imagen, subirla a Postiz para obtener la ruta interna
    let postizImagePath: string | undefined
    if (imageUrl) {
      try {
        const media = await postizUploadFromUrl(imageUrl)
        postizImagePath = media.path
      } catch (imgErr) {
        // No bloqueamos la publicación si falla la imagen — lo logamos y continuamos sin ella
        console.warn('[postiz/publish] No se pudo subir la imagen:', imgErr)
      }
    }

    // 2. Construir el body para Postiz
    const postizBody: PostizCreatePostBody = {
      type,
      ...(type === 'schedule' && scheduledAt ? { date: scheduledAt } : {}),
      posts: channelIds.map((id) => ({
        integration: { id },
        value: [
          {
            content,
            ...(postizImagePath
              ? { image: [{ path: postizImagePath }] }
              : {}),
          },
        ],
      })),
    }

    const result = await postizCreatePost(postizBody)

    return NextResponse.json({
      ok: true,
      type,
      channelIds,
      result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al publicar en Postiz'
    console.error('[postiz/publish]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
