import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, SeoResearchSession } from '@/types/database'

async function requireActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin }
}

// GET /api/seo/sessions
export async function GET() {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const { data, error } = await admin
    .from('seo_research_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<SeoResearchSession[]>()
  if (error) {
    console.error('[seo/sessions/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}
