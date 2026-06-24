import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  CampaignPackage, PackageStatus,
  PlaybookType, Market, Profile,
} from '@/types/database'

const STATUSES: PackageStatus[] = ['draft', 'active', 'completed', 'cancelled']
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const PLAYBOOK_TYPES: PlaybookType[] = [
  'webinar', 'event_presential', 'event_online', 'release',
  'newsletter', 'campaign', 'alliance', 'workshop',
  'lead_magnet', 'reactivation', 'podcast',
]

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

export interface PackageWithStats extends CampaignPackage {
  stats: {
    total: number
    approved: number
    pending: number
    scheduled: number
    published: number
  }
}

// GET /api/campaign-packages[?status=active&market=spain]
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status') as PackageStatus | null
  const marketFilter = url.searchParams.get('market') as Market | null

  let query = admin
    .from('campaign_packages')
    .select('*')
    .order('anchor_date', { ascending: true, nullsFirst: false })

  if (statusFilter && STATUSES.includes(statusFilter)) query = query.eq('status', statusFilter)
  if (marketFilter && MARKETS.includes(marketFilter)) query = query.eq('market', marketFilter)

  const { data: pkgs, error } = await query.returns<CampaignPackage[]>()
  if (error) {
    console.error('[campaign-packages/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  // Cargar TODOS los items vinculados a estos packages para calcular stats en una sola query
  const packageIds = (pkgs ?? []).map(p => p.id)
  let itemsByPkg = new Map<string, { stage: string; human_approved: boolean; published_at: string | null }[]>()

  if (packageIds.length > 0) {
    const { data: items } = await admin
      .from('content_items')
      .select('package_id, stage, human_approved, published_at')
      .in('package_id', packageIds)
      .returns<{ package_id: string; stage: string; human_approved: boolean; published_at: string | null }[]>()

    itemsByPkg = (items ?? []).reduce((map, it) => {
      const arr = map.get(it.package_id) ?? []
      arr.push(it)
      map.set(it.package_id, arr)
      return map
    }, new Map<string, { stage: string; human_approved: boolean; published_at: string | null }[]>())
  }

  const withStats: PackageWithStats[] = (pkgs ?? []).map(pkg => {
    const items = itemsByPkg.get(pkg.id) ?? []
    return {
      ...pkg,
      stats: {
        total:     items.length,
        approved:  items.filter(i => i.human_approved).length,
        pending:   items.filter(i => !i.human_approved).length,
        scheduled: items.filter(i => i.stage === 'scheduled').length,
        published: items.filter(i => !!i.published_at).length,
      },
    }
  })

  return NextResponse.json(withStats)
}

// POST /api/campaign-packages — crear sin playbook (paquete manual)
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<CampaignPackage>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = (body.title ?? '').toString().trim()
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })

  const packageType = body.package_type as PlaybookType
  if (!packageType) return NextResponse.json({ error: 'package_type_required' }, { status: 400 })
  if (!PLAYBOOK_TYPES.includes(packageType)) {
    return NextResponse.json({ error: 'invalid_package_type' }, { status: 400 })
  }

  // Rechazar market inválido explícitamente (antes hacía fallback silencioso a 'spain')
  if (body.market && !MARKETS.includes(body.market)) {
    return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
  }
  const market: Market = body.market ?? 'spain'

  // Validar status: la columna campaign_packages.status NO tiene CHECK en BD,
  // así que un valor arbitrario se persistiría y rompería los filtros. El PATCH
  // ya valida; el POST también debe.
  if (body.status !== undefined && !STATUSES.includes(body.status as PackageStatus)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const insertRow = {
    title,
    package_type: packageType,
    market,
    objective: body.objective ?? null,
    anchor_date: body.anchor_date ?? null,
    start_date: body.start_date ?? null,
    end_date: body.end_date ?? null,
    playbook_id: body.playbook_id ?? null,
    status: body.status ?? 'draft',
    created_by: me.id,
  }

  const { data, error } = await admin
    .from('campaign_packages')
    .insert(insertRow as never)
    .select('*')
    .single<CampaignPackage>()
  if (error) {
    console.error('[campaign-packages/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
