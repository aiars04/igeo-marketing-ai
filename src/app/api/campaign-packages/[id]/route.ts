import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  CampaignPackage, ContentItem, PackageStatus, Profile,
} from '@/types/database'

const STATUSES: PackageStatus[] = ['draft', 'active', 'completed', 'cancelled']

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

// GET /api/campaign-packages/[id] — paquete + sus content_items
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth
  const { id } = await ctx.params

  const { data: pkg, error: pErr } = await admin
    .from('campaign_packages')
    .select('*')
    .eq('id', id)
    .single<CampaignPackage>()
  if (pErr || !pkg) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: items } = await admin
    .from('content_items')
    .select('*')
    .eq('package_id', id)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .returns<ContentItem[]>()

  return NextResponse.json({ ...pkg, items: items ?? [] })
}

// PATCH /api/campaign-packages/[id]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('campaign_packages')
    .select('id, created_by')
    .eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: Partial<CampaignPackage>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) patch.title = String(body.title).trim()
  if (body.objective !== undefined) patch.objective = body.objective
  if (body.anchor_date !== undefined) patch.anchor_date = body.anchor_date
  if (body.start_date !== undefined) patch.start_date = body.start_date
  if (body.end_date !== undefined) patch.end_date = body.end_date
  if (body.market !== undefined) patch.market = body.market
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as PackageStatus)) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('campaign_packages')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single<CampaignPackage>()
  if (error) {
    console.error('[campaign-packages/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/campaign-packages/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('campaign_packages')
    .select('id, created_by')
    .eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Nota: los content_items asociados se quedan con package_id = null (ON DELETE SET NULL)
  const { error } = await admin.from('campaign_packages').delete().eq('id', id)
  if (error) {
    console.error('[campaign-packages/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
