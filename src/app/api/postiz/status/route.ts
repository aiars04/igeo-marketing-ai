import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postizIsConnected } from '@/lib/postiz'

/**
 * GET /api/postiz/status
 * Health-check: comprueba que la API key de Postiz es válida.
 * Requiere autenticación — no exponemos disponibilidad del backend
 * a visitantes sin login.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'unauthorized' }, { status: 401 })

  const connected = await postizIsConnected()
  return NextResponse.json(
    { connected },
    { status: connected ? 200 : 502 },
  )
}
