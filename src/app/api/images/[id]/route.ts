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

// GET: devuelve metadatos de un asset (incluye template_ids para el pill
// "generada con plantilla X" del ImageDrivePanel). Cualquier usuario activo.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth
  const { id } = await ctx.params

  const { data, error } = await admin
    .from('content_assets')
    .select('id, content_item_id, storage_path, prompt, approved, created_at, channel, folder_id, aspect_ratio, width, height, mime_type, asset_type, template_ids')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH: toggle approved (o set explícito)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: {
    approved?: boolean
    folder_id?: string | null
    content_item_id?: string | null
    position?: number   // para reordenar slides dentro de un carrusel
  }
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

  // Asignar / desasignar content_item (null = sin asignar)
  if (Object.prototype.hasOwnProperty.call(body, 'content_item_id')) {
    if (body.content_item_id === null) {
      patch.content_item_id = null
    } else if (typeof body.content_item_id === 'string') {
      // Verificar que el content_item existe y el actor tiene permiso sobre él
      const { data: ci } = await admin
        .from('content_items')
        .select('id, created_by')
        .eq('id', body.content_item_id)
        .maybeSingle<{ id: string; created_by: string | null }>()
      if (!ci) {
        return NextResponse.json({ error: 'content_item_not_found' }, { status: 404 })
      }
      const ciOwner = ci.created_by === me.id
      const ciPriv = me.role === 'admin' || me.role === 'manager'
      if (!ciOwner && !ciPriv) {
        return NextResponse.json({ error: 'forbidden_content_item' }, { status: 403 })
      }
      patch.content_item_id = body.content_item_id
    } else {
      return NextResponse.json({ error: 'invalid_content_item_id' }, { status: 400 })
    }
  }

  // Reordenar slide dentro de un carrusel: el cliente envia el nuevo
  // `position` (entero >=0). Tope 9999 — necesitamos margen alto porque el
  // cliente usa un valor sentinela (~9999) durante el patron 3-step de swap,
  // y el UNIQUE INDEX (carousel_id, position) impide reasignar directamente.
  if (Object.prototype.hasOwnProperty.call(body, 'position')) {
    if (typeof body.position !== 'number' || !Number.isInteger(body.position) || body.position < 0 || body.position > 9999) {
      return NextResponse.json({ error: 'invalid_position' }, { status: 400 })
    }
    patch.position = body.position
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { error } = await admin
    .from('content_assets')
    .update(patch as never)
    .eq('id', id)
  if (error) {
    console.error('[images/PATCH] update failed:', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

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

  // ORDEN CORRECTO: primero DB, luego storage.
  // Si DB falla → no tocamos storage (asset sigue listable y reintenta-ble).
  // Si DB OK pero storage falla → log warning (archivo huérfano, limpiable por cron).
  const { error } = await admin.from('content_assets').delete().eq('id', id)
  if (error) {
    console.error('[images/DELETE] db delete failed:', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  const { error: storageErr } = await admin.storage.from(BUCKET).remove([target.storage_path])
  if (storageErr) {
    console.warn('[images/DELETE] storage warning (huérfano):', storageErr.message)
  }

  return NextResponse.json({ ok: true })
}
