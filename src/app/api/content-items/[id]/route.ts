import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ContentItem, Profile, Stage } from '@/types/database'

const STAGES: Stage[] = ['ideas', 'copy', 'design', 'approval', 'scheduled', 'analyzed']
const STATUSES = ['pending', 'in_progress', 'approved', 'rejected'] as const

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

// ── PATCH /api/content-items/[id] ────────────────────────────────────
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  let body: Partial<ContentItem>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // Cargar el item primero para verificar permisos + estado actual de aprobación
  const { data: target } = await admin
    .from('content_items')
    .select('id, created_by, human_approved')
    .eq('id', id)
    .single<Pick<ContentItem, 'id' | 'human_approved'> & { created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isPriv = me.role === 'admin' || me.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Whitelist con tres tiers: ─────────────────────────────────────────────
  // 1. Libre (owner/priv): edición de contenido — stage, title, content, campaign, description, scheduled_at, status, human_approved
  // 2. Solo admin/manager: campos de auditoría — published_at, clarity_pass, clarity_summary
  // 3. Server-only: approved_by, approved_at — SIEMPRE seteados desde el servidor (no se aceptan del cliente)
  const patch: Record<string, unknown> = {}

  // Tier 1 — campos libres
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage as Stage)) {
      return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })
    }
    patch.stage = body.stage
  }
  if (body.title !== undefined && typeof body.title === 'string') patch.title = body.title.trim()
  if (body.content !== undefined) patch.content = body.content
  if (body.campaign !== undefined) patch.campaign = body.campaign
  if ((body as { description?: string }).description !== undefined) {
    patch.description = (body as { description?: string }).description
  }
  if (body.scheduled_at !== undefined) patch.scheduled_at = body.scheduled_at
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as typeof STATUSES[number])) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    }
    patch.status = body.status
  }
  if (body.human_approved !== undefined) {
    const wanted = !!body.human_approved
    patch.human_approved = wanted
    // CLAVE: approved_by/approved_at SIEMPRE desde el servidor — el cliente no
    // puede suplantar a otro usuario. Además: solo sobreescribimos los timestamps
    // si hay TRANSICIÓN real, así dos PATCH consecutivos no falsean el audit log.
    if (wanted && !target.human_approved) {
      patch.approved_by = me.id
      patch.approved_at = new Date().toISOString()
    } else if (!wanted && target.human_approved) {
      patch.approved_by = null
      patch.approved_at = null
    }
    // Si ya estaba en el estado pedido: no tocar approved_by/at (preserva auditoría)
  }

  // Tier 2 — solo admin/manager
  if (body.published_at !== undefined) {
    if (!isPriv) {
      return NextResponse.json({ error: 'forbidden_field:published_at' }, { status: 403 })
    }
    patch.published_at = body.published_at
  }
  if (body.clarity_pass !== undefined) {
    if (!isPriv) {
      return NextResponse.json({ error: 'forbidden_field:clarity_pass' }, { status: 403 })
    }
    patch.clarity_pass = body.clarity_pass
  }
  if (body.clarity_summary !== undefined) {
    if (!isPriv) {
      return NextResponse.json({ error: 'forbidden_field:clarity_summary' }, { status: 403 })
    }
    patch.clarity_summary = body.clarity_summary
  }

  // body.approved_by / body.approved_at del cliente son SIEMPRE ignorados —
  // se setean en el servidor cuando human_approved cambia.

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('content_items')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single<ContentItem>()
  if (error) {
    console.error('[content-items/PATCH] update failed:', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// ── DELETE /api/content-items/[id] ───────────────────────────────────
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  const { data: target } = await admin
    .from('content_items')
    .select('id, created_by')
    .eq('id', id)
    .single<Pick<ContentItem, 'id'> & { created_by: string | null }>()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = target.created_by === me.id
  const isAdmin = me.role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('content_items').delete().eq('id', id)
  if (error) {
    console.error('[content-items/DELETE] failed:', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
