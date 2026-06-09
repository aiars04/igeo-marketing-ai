import { NextResponse } from 'next/server'
import { postizIsConnected } from '@/lib/postiz'

/**
 * GET /api/postiz/status
 * Health-check: comprueba que la API key de Postiz es válida.
 * No requiere autenticación — útil para diagnóstico desde el front.
 */
export async function GET() {
  const connected = await postizIsConnected()
  return NextResponse.json(
    { connected },
    { status: connected ? 200 : 502 },
  )
}
