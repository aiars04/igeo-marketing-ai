import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Improvement, ImprovementPriority, ImprovementStatus, ImprovementType, Profile,
} from '@/types/database'

const TYPES:      ImprovementType[]     = ['bug', 'mejora', 'idea']
const PRIORITIES: ImprovementPriority[] = ['baja', 'media', 'alta']
const STATUSES:   ImprovementStatus[]   = ['pendiente', 'revisada', 'completada', 'descartada']

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
// Genera signed URLs frescas (1h) sobre el bucket privado 'improvements'.
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status') as ImprovementStatus | null

  let query = admin
    .from('improvements')
    .select('*')
    .order('created_at', { ascending: false })

  if (status && STATUSES.includes(status)) query = query.eq('status', status)

  const { data, error } = await query.returns<Improvement[]>()
  if (error) {
    console.error('[improvements/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  // attachment_url en BD guarda el PATH interno → traducir a signed URL temporal (1h).
  // Si la generación de signed URL falla, devolvemos el item con url vacía
  // (el componente muestra fallback) pero no rompemos el listado.
  const items = data ?? []
  const enriched = await Promise.all(items.map(async (it) => {
    const path = it.attachment_url
    if (!path) return it
    const { data: signed } = await admin.storage
      .from('improvements').createSignedUrl(path, 3600)
    return { ...it, attachment_url: signed?.signedUrl ?? '' }
  }))

  return NextResponse.json(enriched)
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

  // Path interno del bucket privado 'improvements'. El cliente NUNCA nos
  // envía una URL pública — solo el path resultante del upload directo a
  // Storage. Validamos que sea un path razonable y dentro de la carpeta
  // del propio usuario.
  const attachmentPath = ((body as { attachment_path?: string }).attachment_path ?? '').toString().trim()
  if (!attachmentPath) {
    return NextResponse.json({ error: 'attachment_required' }, { status: 400 })
  }
  if (
    attachmentPath.length > 300 ||
    attachmentPath.includes('..') ||
    attachmentPath.startsWith('/') ||
    !/^[A-Za-z0-9_\-./]+$/.test(attachmentPath)
  ) {
    return NextResponse.json({ error: 'invalid_attachment_path' }, { status: 400 })
  }
  // Forzar que el path arranque con el id del usuario que sube (anti-suplantación).
  // El cliente usa `${userId}/...` al subir; rechazamos cualquier otro prefijo.
  if (!attachmentPath.startsWith(`${me.id}/`)) {
    return NextResponse.json({ error: 'invalid_attachment_path' }, { status: 400 })
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
    // attachment_url guarda el PATH interno del bucket (el campo se mantiene
    // con ese nombre por compatibilidad con la migración 016 ya aplicada).
    attachment_url: attachmentPath,
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
