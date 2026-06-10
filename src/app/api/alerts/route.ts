import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Alert, AlertLevel, AlertType, Profile } from '@/types/database'

const LEVELS: AlertLevel[] = ['info', 'warning', 'critical']
const TYPES: AlertType[] = [
  'missing_copy', 'missing_image', 'missing_approval',
  'missing_cta', 'missing_landing', 'package_incomplete',
  'scheduled_no_material', 'dependency_not_met', 'market_inconsistency',
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

// GET /api/alerts[?resolved=false&level=critical]
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const resolvedParam = url.searchParams.get('resolved')
  const levelParam = url.searchParams.get('level') as AlertLevel | null
  const typeParam = url.searchParams.get('type') as AlertType | null

  let query = admin
    .from('alerts')
    .select('*')
    .order('level', { ascending: false }) // critical primero
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (resolvedParam !== null) {
    query = query.eq('resolved', resolvedParam === 'true')
  }
  if (levelParam && LEVELS.includes(levelParam)) query = query.eq('level', levelParam)
  if (typeParam && TYPES.includes(typeParam)) query = query.eq('type', typeParam)

  const { data, error } = await query.returns<Alert[]>()
  if (error) {
    console.error('[alerts/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/alerts — crear alerta manual (poco habitual; suele crearlas el scanner)
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  let body: Partial<Alert>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  if (!body.title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (!body.type || !TYPES.includes(body.type as AlertType)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  const level = body.level ?? 'warning'
  if (!LEVELS.includes(level as AlertLevel)) {
    return NextResponse.json({ error: 'invalid_level' }, { status: 400 })
  }

  const insertRow = {
    level,
    type: body.type,
    title: body.title,
    description: body.description ?? null,
    related_content_item_id: body.related_content_item_id ?? null,
    related_package_id: body.related_package_id ?? null,
    due_at: body.due_at ?? null,
    resolved: false,
  }
  const { data, error } = await admin
    .from('alerts').insert(insertRow as never).select('*').single<Alert>()
  if (error) {
    console.error('[alerts/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
