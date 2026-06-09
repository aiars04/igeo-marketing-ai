import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postizGetPosts } from '@/lib/postiz'

/**
 * GET /api/postiz/posts
 * Devuelve los posts programados / publicados en Postiz.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await postizGetPosts()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener posts de Postiz'
    console.error('[postiz/posts]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
