import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Profile, SeoResearchSession, SeoKeyword,
} from '@/types/database'

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

// GET /api/seo/sessions/[id] — sesión + sus keywords
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth
  const { id } = await ctx.params

  const { data: session, error: sErr } = await admin
    .from('seo_research_sessions').select('*').eq('id', id)
    .single<SeoResearchSession>()
  if (sErr || !session) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: keywords } = await admin
    .from('seo_keywords').select('*').eq('research_session_id', id)
    .order('created_at', { ascending: true })
    .returns<SeoKeyword[]>()

  return NextResponse.json({ ...session, keywords: keywords ?? [] })
}

// DELETE /api/seo/sessions/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('seo_research_sessions').select('id, created_by').eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin.from('seo_research_sessions').delete().eq('id', id)
  if (error) {
    console.error('[seo/sessions/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
