import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postizGetChannels } from '@/lib/postiz'

/**
 * GET /api/postiz/channels
 * Devuelve los canales conectados en Postiz.
 * Solo accesible para usuarios autenticados.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const channels = await postizGetChannels()
    return NextResponse.json({ channels })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener canales de Postiz'
    console.error('[postiz/channels]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
