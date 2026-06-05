import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'

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

// PATCH: toggle approved (o set explícito)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: { approved?: boolean; folder_id?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const { data: target } = await admin
    .from('content_assets')
    .select('id, approved, created_by')
    .eq('id', id)
    .single<{ id: string; approved: boolean; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}

  // toggle approved (sin body → toggle; body.approved boolean → set explícito)
  if (Object.prototype.hasOwnProperty.call(body, 'approved') || Object.keys(body).length === 0) {
    patch.approved = typeof body.approved === 'boolean' ? body.approved : !target.approved
  }

  // Cambiar folder_id (null = sin clasificar)
  if (Object.prototype.hasOwnProperty.call(body, 'folder_id')) {
    if (body.folder_id !== null && typeof body.folder_id === 'string') {
      const { data: f } = await admin.from('image_folders').select('id').eq('id', body.folder_id).single()
      if (!f) return NextResponse.json({ error: 'folder_not_found' }, { status: 404 })
    }
    patch.folder_id = body.folder_id
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { error } = await admin
    .from('content_assets')
    .update(patch as never)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...patch })
}

// DELETE: borrar de storage + tabla
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('content_assets')
    .select('id, storage_path, created_by')
    .eq('id', id)
    .single<{ id: string; storage_path: string; created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Borrar storage primero (idempotente — no falla si ya no existe)
  const { error: storageErr } = await admin.storage.from(BUCKET).remove([target.storage_path])
  if (storageErr) {
    console.warn('storage delete warning:', storageErr.message)
  }

  const { error } = await admin.from('content_assets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
