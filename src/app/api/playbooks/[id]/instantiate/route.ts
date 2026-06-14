import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { instantiatePlaybook } from '@/lib/playbook-instantiate'
import type { Market, Profile } from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']

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

/**
 * POST /api/playbooks/[id]/instantiate
 * Body: { title, anchor_date (ISO), market?, objective? }
 * Crea un campaign_package + N content_items aplicando el playbook al anchor_date.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id: playbookId } = await ctx.params

  let body: {
    title?: string
    anchor_date?: string
    market?: Market
    objective?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (!body.anchor_date) return NextResponse.json({ error: 'anchor_date_required' }, { status: 400 })

  const anchorDate = new Date(body.anchor_date)
  if (isNaN(anchorDate.getTime())) {
    return NextResponse.json({ error: 'invalid_anchor_date' }, { status: 400 })
  }

  const market: Market = (body.market && MARKETS.includes(body.market)) ? body.market : 'spain'

  try {
    const result = await instantiatePlaybook(admin, {
      playbookId, title, anchorDate, market,
      objective: body.objective ?? null,
      createdBy: me.id,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    const status = msg === 'playbook_not_found' ? 404
                 : msg === 'playbook_inactive' || msg === 'playbook_has_no_steps' ? 400
                 : 500
    console.error('[instantiate]', msg)
    return NextResponse.json({ error: msg }, { status })
  }
}
