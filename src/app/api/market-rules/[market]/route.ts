import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Market, MarketRules, Profile } from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil']

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

const isPriv = (role: string) => role === 'admin' || role === 'manager'

// GET /api/market-rules/[market]
export async function GET(_req: Request, ctx: { params: Promise<{ market: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth
  const { market } = await ctx.params

  if (!MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('market_rules')
    .select('*')
    .eq('market', market)
    .maybeSingle<MarketRules>()
  if (error) {
    console.error('[market-rules/GET/market]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/market-rules/[market]
export async function PATCH(req: Request, ctx: { params: Promise<{ market: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { market } = await ctx.params

  if (!isPriv(me.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!MARKETS.includes(market as Market)) {
    return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
  }

  let body: Partial<MarketRules>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.keyword_rules !== undefined) {
    if (typeof body.keyword_rules !== 'object' || body.keyword_rules === null) {
      return NextResponse.json({ error: 'invalid_keyword_rules' }, { status: 400 })
    }
    patch.keyword_rules = body.keyword_rules
  }
  if (body.terminology_rules !== undefined) {
    if (typeof body.terminology_rules !== 'object' || body.terminology_rules === null) {
      return NextResponse.json({ error: 'invalid_terminology_rules' }, { status: 400 })
    }
    patch.terminology_rules = body.terminology_rules
  }
  if (body.no_say_rules !== undefined) {
    if (!Array.isArray(body.no_say_rules)) {
      return NextResponse.json({ error: 'invalid_no_say_rules' }, { status: 400 })
    }
    patch.no_say_rules = body.no_say_rules.map(x => String(x).trim()).filter(Boolean)
  }
  if (body.cta_rules !== undefined) {
    if (typeof body.cta_rules !== 'object' || body.cta_rules === null) {
      return NextResponse.json({ error: 'invalid_cta_rules' }, { status: 400 })
    }
    patch.cta_rules = body.cta_rules
  }
  if (body.notes !== undefined) patch.notes = body.notes

  patch.updated_by = me.id

  if (Object.keys(patch).length === 1) {  // solo updated_by
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('market_rules')
    .update(patch as never)
    .eq('market', market)
    .select('*')
    .single<MarketRules>()
  if (error) {
    console.error('[market-rules/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
