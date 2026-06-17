import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizGetNotifications } from '@/lib/postiz'
import type { Profile } from '@/types/database'

/**
 * GET /api/postiz/notifications?page=0
 * Proxy de las notificaciones de la organización en Postiz Web.
 * Útil para mostrar histórico de publicaciones reales y fallos sin
 * tener que abrir el dashboard de Postiz.
 *
 * Auth: admin/manager. Las notificaciones revelan canales activos y
 * fallos de publicación de redes corporativas → solo roles con permiso
 * sobre marketing.
 */
export async function GET(req: NextRequest) {
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
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const pageParam = req.nextUrl.searchParams.get('page')
  // Limitar rango razonable para evitar consultas absurdas al upstream.
  const parsed = Number.isFinite(Number(pageParam)) ? parseInt(pageParam ?? '0', 10) : 0
  const page = Math.min(Math.max(0, parsed), 1000)

  try {
    const data = await postizGetNotifications(page)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[postiz/notifications] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }
}
