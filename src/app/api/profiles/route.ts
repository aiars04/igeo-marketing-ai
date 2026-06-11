import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

/**
 * GET /api/profiles
 *
 * Devuelve un directorio mínimo de perfiles ACTIVOS para resolver UUIDs
 * (created_by, approved_by, etc.) a nombre/email legibles en la UI.
 *
 * Sólo expone id + full_name + email. Cualquier usuario activo puede leerlo
 * (no es PII sensible — el email ya aparece en los listados de Admin/Users).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('profiles').select('id, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'active'>>()
  if (!me || !me.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('active', true)
    .order('full_name', { ascending: true })
    .returns<Pick<Profile, 'id' | 'full_name' | 'email'>[]>()
  if (error) {
    console.error('[profiles/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}
