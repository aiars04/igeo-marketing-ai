import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sanitizeHandles } from '@/lib/social-mentions'
import type { Channel, Profile, SocialMention } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

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

function isPriv(role: string) { return role === 'admin' || role === 'manager' }

// ── GET /api/mentions[?channel=linkedin&search=foo&activeOnly=true] ─────────
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const channel = url.searchParams.get('channel') as Channel | null
  const search = (url.searchParams.get('search') ?? '').trim()
  const activeOnly = url.searchParams.get('activeOnly') === 'true'

  let query = admin
    .from('social_mentions')
    .select('*')
    .order('name', { ascending: true })
    .limit(500)

  if (activeOnly) query = query.eq('active', true)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query.returns<SocialMention[]>()
  if (error) {
    console.error('[mentions/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  // Filtrado por canal en memoria — los handles son JSONB, no podemos hacer
  // un índice fácil contra una clave dinámica sin GIN específico.
  let list = data ?? []
  if (channel && CHANNELS.includes(channel)) {
    list = list.filter(m => {
      const v = m.handles?.[channel]
      return typeof v === 'string' && v.trim().length > 0
    })
  }

  return NextResponse.json(list)
}

// ── POST /api/mentions ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Partial<SocialMention> & { handles?: unknown; tags?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const name = (body.name ?? '').toString().trim()
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  if (name.length > 120) return NextResponse.json({ error: 'name_too_long' }, { status: 400 })

  const description = body.description?.toString().trim() || null
  const handles = sanitizeHandles(body.handles)
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, 20)
    : []

  const { data, error } = await admin
    .from('social_mentions')
    .insert({
      name, description, handles, tags,
      active: body.active === false ? false : true,
      created_by: me.id,
    } as never)
    .select('*')
    .single<SocialMention>()
  if (error) {
    console.error('[mentions/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}
