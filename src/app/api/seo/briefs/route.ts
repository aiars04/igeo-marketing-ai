import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile, SeoBrief, SeoBriefStatus } from '@/types/database'

const STATUSES: SeoBriefStatus[] = ['draft', 'approved', 'converted', 'archived']

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

// GET /api/seo/briefs[?status=draft]
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const status = url.searchParams.get('status') as SeoBriefStatus | null

  let query = admin
    .from('seo_briefs').select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status && STATUSES.includes(status)) query = query.eq('status', status)

  const { data, error } = await query.returns<SeoBrief[]>()
  if (error) {
    console.error('[seo/briefs/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}
