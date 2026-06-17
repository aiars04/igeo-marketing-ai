import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postizCheckConnection } from '@/lib/postiz'

/**
 * GET /api/postiz/status
 * Health-check: comprueba que la API key de Postiz es válida.
 * Requiere autenticación — no exponemos disponibilidad del backend
 * a visitantes sin login.
 *
 * Responde:
 *   { connected: boolean, status?: number, reason?: string }
 * El `reason` está sanitizado (sin secretos) para mostrarlo en la UI
 * de admin al diagnosticar problemas de conexión.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'unauthorized' }, { status: 401 })

  const diag = await postizCheckConnection()
  return NextResponse.json(
    { connected: diag.connected, status: diag.status, reason: diag.reason },
    { status: diag.connected ? 200 : 502 },
  )
}
