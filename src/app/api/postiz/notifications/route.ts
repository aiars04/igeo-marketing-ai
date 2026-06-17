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
 * Auth: usuario con perfil activo. No exigimos rol admin/manager porque
 * es solo lectura — pero podríamos endurecerlo si fuese sensible.
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

  const pageParam = req.nextUrl.searchParams.get('page')
  const page = Number.isFinite(Number(pageParam)) ? Math.max(0, parseInt(pageParam ?? '0', 10)) : 0

  try {
    const data = await postizGetNotifications(page)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[postiz/notifications] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }
}
