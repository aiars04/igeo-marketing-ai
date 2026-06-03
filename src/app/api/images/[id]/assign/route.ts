import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

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

// PATCH /api/images/[id]/assign  body: { content_item_id: string | null }
// Vincula (o desvincula con null) una imagen a un ítem del pipeline.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: { content_item_id?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const contentItemId: string | null = body.content_item_id ?? null

  // Permisos: dueño del asset o admin/manager
  const { data: target } = await admin
    .from('content_assets')
    .select('id, created_by')
    .eq('id', id)
    .single<{ id: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Si va a asignar, verificar que el ítem exista
  if (contentItemId) {
    const { data: item } = await admin
      .from('content_items')
      .select('id')
      .eq('id', contentItemId)
      .single<{ id: string }>()
    if (!item) return NextResponse.json({ error: 'content_item_not_found' }, { status: 404 })
  }

  const { error } = await admin
    .from('content_assets')
    .update({ content_item_id: contentItemId } as never)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, content_item_id: contentItemId })
}
