import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizGetAnalytics } from '@/lib/postiz'
import type { Profile } from '@/types/database'

/**
 * GET /api/postiz/analytics/:integrationId?days=30
 *
 * Proxy del endpoint analytics de Postiz. Requiere admin/manager — las
 * métricas de redes corporativas no son públicas.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: integrationId } = await params

  if (!integrationId || typeof integrationId !== 'string' || integrationId.length > 200) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

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

  const daysParam = req.nextUrl.searchParams.get('days')
  const parsed = Number.isFinite(Number(daysParam)) ? parseInt(daysParam ?? '30', 10) : 30
  const days = Math.min(Math.max(1, parsed), 365)

  try {
    const series = await postizGetAnalytics(integrationId, days)
    return NextResponse.json({ series, days })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[postiz/analytics] upstream error:', msg)
    if (/→\s*404/.test(msg)) {
      return NextResponse.json({ error: 'channel_not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }
}
