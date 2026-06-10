import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Playbook, PlaybookType, Profile } from '@/types/database'

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
    .from('profiles')
    .select('id, role, active')
    .eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin }
}

function requirePriv(role: string) {
  return role === 'admin' || role === 'manager'
}

// GET /api/playbooks[?active=true&type=webinar]
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const activeOnly = url.searchParams.get('active') === 'true'
  const type = url.searchParams.get('type') as PlaybookType | null

  let query = admin
    .from('playbooks')
    .select('*')
    .order('created_at', { ascending: true })

  if (activeOnly) query = query.eq('active', true)
  if (type && PLAYBOOK_TYPES.includes(type)) query = query.eq('type', type)

  const { data, error } = await query.returns<Playbook[]>()
  if (error) {
    console.error('[playbooks/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/playbooks
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  if (!requirePriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Partial<Playbook>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const name = (body.name ?? '').toString().trim()
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const type = body.type as PlaybookType
  if (!type || !PLAYBOOK_TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  const insertRow = {
    name,
    type,
    description: body.description ?? null,
    market_scope: body.market_scope ?? 'all',
    default_channels: Array.isArray(body.default_channels) ? body.default_channels : [],
    required_assets: Array.isArray(body.required_assets) ? body.required_assets : [],
    required_copy_blocks: Array.isArray(body.required_copy_blocks) ? body.required_copy_blocks : [],
    approval_required: body.approval_required ?? true,
    active: body.active ?? true,
    created_by: me.id,
  }

  const { data, error } = await admin
    .from('playbooks')
    .insert(insertRow as never)
    .select('*')
    .single<Playbook>()
  if (error) {
    console.error('[playbooks/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
