import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

/**
 * GET /api/me
 *
 * Devuelve el perfil del usuario actual: id, email, role, active, full_name.
 * Usado por componentes cliente que necesitan conocer el rol para gate visual
 * (ej. ocultar botones de publicar/cancelar a usuarios sin admin/manager —
 * el backend ya rechaza con 403, pero la UX queda más limpia sin botones
 * que fallan al pulsarlos).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', user.id)
    .single<Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.json(profile)
}
