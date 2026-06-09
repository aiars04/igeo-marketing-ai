import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ImageFolder, Profile, Channel } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin' && me.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Partial<ImageFolder>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // No tocar system folders
  const { data: target } = await admin
    .from('image_folders').select('id, system').eq('id', id)
    .single<Pick<ImageFolder, 'id' | 'system'>>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (target.system) return NextResponse.json({ error: 'cannot_modify_system_folder' }, { status: 403 })

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const n = body.name.trim()
    if (n.length < 2) return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    patch.name = n
  }
  if (body.channel !== undefined) {
    if (body.channel !== null && !CHANNELS.includes(body.channel)) {
      return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
    }
    patch.channel = body.channel
  }
  if (body.color !== undefined) patch.color = body.color
  if (body.icon !== undefined) patch.icon = body.icon

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('image_folders').update(patch as never).eq('id', id)
    .select('*').single<ImageFolder>()
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  }

  const { data: target } = await admin
    .from('image_folders').select('id, system').eq('id', id)
    .single<Pick<ImageFolder, 'id' | 'system'>>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (target.system) return NextResponse.json({ error: 'cannot_delete_system_folder' }, { status: 403 })

  // FK content_assets.folder_id es ON DELETE SET NULL → los assets quedan huérfanos
  const { error } = await admin.from('image_folders').delete().eq('id', id)
  if (error) { console.error('[api]', error.message); return NextResponse.json({ error: 'db_failed' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
