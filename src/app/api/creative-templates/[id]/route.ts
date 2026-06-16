import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Channel, Market, Profile, CreativeTemplate } from '@/types/database'

const BUCKET = 'content-assets'
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']

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

function isPriv(role: string): boolean {
  return role === 'admin' || role === 'manager'
}

// ── PATCH /api/creative-templates/[id] ───────────────────────────────────
// Cuerpo JSON: edita metadatos (no el archivo). Para sustituir el archivo,
// elimina y crea una nueva entrada (es lo más limpio en Fase 1).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Partial<CreativeTemplate> & { content_type_ids?: string[] }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // Cargar la fila para validaciones de coherencia (canal vs content_types)
  const { data: target } = await admin
    .from('creative_templates')
    .select('*')
    .eq('id', id)
    .single<CreativeTemplate>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Whitelist de campos editables
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const v = body.name.toString().trim()
    if (!v) return NextResponse.json({ error: 'name_required' }, { status: 400 })
    if (v.length > 140) return NextResponse.json({ error: 'name_too_long' }, { status: 400 })
    patch.name = v
  }
  if (body.description !== undefined) {
    patch.description = body.description ? body.description.toString().trim().slice(0, 1000) : null
  }
  if (body.asset_role !== undefined) {
    const v = body.asset_role.toString().trim().slice(0, 60)
    patch.asset_role = v || 'banner'
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes ? body.notes.toString().trim().slice(0, 2000) : null
  }
  if (body.market !== undefined) {
    const raw = body.market as unknown
    if (raw === null || raw === '' || raw === undefined) {
      patch.market = null
    } else if (typeof raw === 'string' && MARKETS.includes(raw as Market)) {
      patch.market = raw
    } else {
      return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
    }
  }
  if (body.active !== undefined) patch.active = !!body.active

  // Cambio de canal no permitido en PATCH: implicaría mover el archivo y
  // revalidar la pivote. Si se necesita, se borra y se crea de nuevo.
  if (body.channel !== undefined && body.channel !== target.channel) {
    return NextResponse.json({ error: 'channel_change_not_supported' }, { status: 400 })
  }

  // Actualiza la fila si hay cambios
  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await admin
      .from('creative_templates')
      .update(patch as never)
      .eq('id', id)
    if (upErr) {
      console.error('[creative-templates/PATCH] update failed:', upErr.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
  }

  // Actualiza pivote si vino content_type_ids — reemplazo total (delete + insert)
  if (Array.isArray(body.content_type_ids)) {
    const wanted = Array.from(new Set(body.content_type_ids.filter(v => typeof v === 'string')))

    // Coherencia: todos los content_types deben ser del mismo canal
    if (wanted.length > 0) {
      const { data: existing } = await admin
        .from('content_types')
        .select('id, channel')
        .in('id', wanted)
        .returns<Array<{ id: string; channel: Channel }>>()
      if ((existing ?? []).length !== wanted.length) {
        return NextResponse.json({ error: 'content_type_not_found' }, { status: 400 })
      }
      const mismatched = (existing ?? []).filter(c => c.channel !== target.channel)
      if (mismatched.length > 0) {
        return NextResponse.json({ error: 'content_type_channel_mismatch' }, { status: 400 })
      }
    }

    // Reemplazo: borrar todo y reinsertar
    await admin
      .from('creative_template_content_types')
      .delete()
      .eq('template_id', id)
    if (wanted.length > 0) {
      const rows = wanted.map(ctId => ({ template_id: id, content_type_id: ctId }))
      const { error: insErr } = await admin
        .from('creative_template_content_types')
        .insert(rows as never)
      if (insErr) {
        console.error('[creative-templates/PATCH] pivot insert failed:', insErr.message)
        return NextResponse.json({ error: 'pivot_failed' }, { status: 500 })
      }
    }
  }

  // Devuelve la fila actualizada
  const { data: updated } = await admin
    .from('creative_templates')
    .select('*')
    .eq('id', id)
    .single<CreativeTemplate>()
  return NextResponse.json(updated)
}

// ── DELETE /api/creative-templates/[id] ──────────────────────────────────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Recupera storage_path antes de borrar la fila
  const { data: target } = await admin
    .from('creative_templates')
    .select('id, storage_path')
    .eq('id', id)
    .single<Pick<CreativeTemplate, 'id' | 'storage_path'>>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Borra la fila (la pivote cae por ON DELETE CASCADE)
  const { error: delErr } = await admin
    .from('creative_templates')
    .delete()
    .eq('id', id)
  if (delErr) {
    console.error('[creative-templates/DELETE] db failed:', delErr.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  // Limpia el archivo del bucket — no es bloqueante si falla, queda en logs
  await admin.storage.from(BUCKET).remove([target.storage_path]).catch(err => {
    console.warn('[creative-templates/DELETE] storage cleanup failed:', err)
  })

  return NextResponse.json({ ok: true })
}
