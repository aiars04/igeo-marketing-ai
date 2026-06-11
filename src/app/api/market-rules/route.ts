import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { MarketRules, Profile } from '@/types/database'

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

// GET /api/market-rules — lista los 7 mercados
export async function GET() {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const { data, error } = await admin
    .from('market_rules')
    .select('*')
    .order('market', { ascending: true })
    .returns<MarketRules[]>()
  if (error) {
    console.error('[market-rules/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}
