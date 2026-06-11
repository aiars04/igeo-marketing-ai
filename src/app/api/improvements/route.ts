import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Improvement, ImprovementPriority, ImprovementType, Profile,
} from '@/types/database'

const TYPES:      ImprovementType[]     = ['bug', 'mejora', 'idea']
const PRIORITIES: ImprovementPriority[] = ['baja', 'media', 'alta']

async function requireActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, email, full_name, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'email' | 'full_name' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin, user }
}

const isPriv = (role: string) => role === 'admin' || role === 'manager'

// GET /api/improvements — solo admin/manager
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  let query = admin
    .from('improvements')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query.returns<Improvement[]>()
  if (error) {
    console.error('[improvements/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/improvements — cualquier usuario activo
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<Improvement>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = (body.title ?? '').toString().trim()
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: 'title_too_long' }, { status: 400 })

  const attachmentUrl = (body.attachment_url ?? '').toString().trim()
  if (!attachmentUrl) {
    return NextResponse.json({ error: 'attachment_required' }, { status: 400 })
  }

  // Anti-SSRF: solo URLs del bucket improvements de Supabase
  try {
    const url = new URL(attachmentUrl)
    const expectedHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host
    if (url.host !== expectedHost || !url.pathname.includes('/improvements/')) {
      return NextResponse.json({ error: 'invalid_attachment_url' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'invalid_attachment_url' }, { status: 400 })
  }

  const type = (body.type ?? 'mejora') as ImprovementType
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  const priority = (body.priority ?? 'media') as ImprovementPriority
  if (!PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'invalid_priority' }, { status: 400 })
  }

  const description = (body.description ?? '').toString().trim().slice(0, 2000)

  const insertRow = {
    title,
    description,
    attachment_url: attachmentUrl,
    type,
    priority,
    status: 'pendiente',
    created_by: me.id,
    created_by_email: me.email,
    created_by_name: me.full_name,
  }

  const { data, error } = await admin
    .from('improvements')
    .insert(insertRow as never)
    .select('*')
    .single<Improvement>()
  if (error) {
    console.error('[improvements/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
