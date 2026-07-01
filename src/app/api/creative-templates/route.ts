import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Channel, Market, Profile, CreativeTemplate, CreativeTemplateWithRefs } from '@/types/database'

const BUCKET = 'content-assets'
const TEMPLATE_PREFIX = 'templates'
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1h — suficiente para que el admin trabaje

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']

export const runtime = 'nodejs'
export const maxDuration = 60

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

/** Calcula aspect ratio "1:1", "16:9", etc. desde W×H. Devuelve "free" si no encaja. */
function aspectRatioOf(w: number | null, h: number | null): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null
  const r = w / h
  if (Math.abs(r - 1)    < 0.04) return '1:1'
  if (Math.abs(r - 16/9) < 0.04) return '16:9'
  if (Math.abs(r - 9/16) < 0.04) return '9:16'
  if (Math.abs(r - 4/5)  < 0.04) return '4:5'
  if (Math.abs(r - 5/4)  < 0.04) return '5:4'
  if (Math.abs(r - 3/2)  < 0.04) return '3:2'
  if (Math.abs(r - 2/3)  < 0.04) return '2:3'
  return 'free'
}

/**
 * Hidrata una lista de plantillas con:
 *   - content_type_ids (vía join contra la pivote)
 *   - signed_url (TTL corto para preview en admin)
 */
async function hydrate(
  admin: ReturnType<typeof createAdminClient>,
  rows: CreativeTemplate[],
): Promise<CreativeTemplateWithRefs[]> {
  if (rows.length === 0) return []

  // Trae pivote en una sola query
  const ids = rows.map(r => r.id)
  const { data: pivotRows } = await admin
    .from('creative_template_content_types')
    .select('template_id, content_type_id')
    .in('template_id', ids)
    .returns<Array<{ template_id: string; content_type_id: string }>>()

  const byTemplate = new Map<string, string[]>()
  for (const p of pivotRows ?? []) {
    const arr = byTemplate.get(p.template_id) ?? []
    arr.push(p.content_type_id)
    byTemplate.set(p.template_id, arr)
  }

  // Signed URLs en paralelo (1h cada una)
  const urls = await Promise.all(
    rows.map(r =>
      admin.storage.from(BUCKET)
        .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS)
        .then(({ data, error }) => error ? null : data.signedUrl)
        .catch(() => null),
    ),
  )

  return rows.map((r, idx) => ({
    ...r,
    content_type_ids: byTemplate.get(r.id) ?? [],
    signed_url: urls[idx],
  }))
}

// ── GET /api/creative-templates[?channel=X&market=Y&content_type_id=Z&activeOnly=true]
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { admin } = auth

  const url = new URL(req.url)
  const channelParam = url.searchParams.get('channel') as Channel | null
  const marketParam  = url.searchParams.get('market')  as Market  | null
  const contentTypeIdParam = url.searchParams.get('content_type_id')
  const activeOnly = url.searchParams.get('activeOnly') === 'true'
  // ?ids=a,b,c — usado por el ImageDrivePanel para hidratar nombres de las
  // plantillas que se usaron al generar un asset (pill de trazabilidad).
  const idsParam = url.searchParams.get('ids')
  const idsFilter = idsParam
    ? idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50)
    : null

  let query = admin
    .from('creative_templates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (idsFilter && idsFilter.length > 0) query = query.in('id', idsFilter)
  if (channelParam && CHANNELS.includes(channelParam)) query = query.eq('channel', channelParam)
  if (marketParam  && MARKETS.includes(marketParam))   query = query.eq('market', marketParam)
  if (activeOnly) query = query.eq('active', true)

  const { data, error } = await query.returns<CreativeTemplate[]>()
  if (error) {
    console.error('[creative-templates/GET] db failed:', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  let rows = data ?? []

  // Filtro por content_type a posteriori (necesita pivote)
  if (contentTypeIdParam) {
    const { data: pivotRows } = await admin
      .from('creative_template_content_types')
      .select('template_id')
      .eq('content_type_id', contentTypeIdParam)
      .returns<Array<{ template_id: string }>>()
    const allowed = new Set((pivotRows ?? []).map(p => p.template_id))
    // Por contrato: si una plantilla NO tiene filas pivote, aplica a TODOS los
    // content_types del canal. Las que sí tienen, solo a los enlazados.
    const idsWithPivot = new Set<string>()
    if (rows.length > 0) {
      const { data: anyPivotRows } = await admin
        .from('creative_template_content_types')
        .select('template_id')
        .in('template_id', rows.map(r => r.id))
        .returns<Array<{ template_id: string }>>()
      for (const p of anyPivotRows ?? []) idsWithPivot.add(p.template_id)
    }
    rows = rows.filter(r => !idsWithPivot.has(r.id) || allowed.has(r.id))
  }

  const hydrated = await hydrate(admin, rows)
  return NextResponse.json(hydrated)
}

// ── POST /api/creative-templates (multipart) ─────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  // Antes exigía admin/manager. Se relajó para permitir a rol `user` crear
  // sus propias plantillas (bug Ramon 1-jul: "forbidden" al subir carrusel).
  // PATCH/DELETE en /[id] mantienen el gate admin/manager para no permitir
  // editar plantillas ajenas.

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'bad_form_data' }, { status: 400 }) }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: `mime_not_allowed:${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large_10mb_max' }, { status: 413 })
  }

  const name = (formData.get('name') ?? '').toString().trim()
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  if (name.length > 140) return NextResponse.json({ error: 'name_too_long' }, { status: 400 })

  const channel = (formData.get('channel') ?? '').toString().toLowerCase() as Channel
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
  }

  const rawMarket = (formData.get('market') ?? '').toString().toLowerCase()
  const market: Market | null = rawMarket && MARKETS.includes(rawMarket as Market)
    ? (rawMarket as Market) : null

  const assetRole = (formData.get('asset_role') ?? 'banner').toString().trim().slice(0, 60) || 'banner'
  const description = (formData.get('description') ?? '').toString().trim().slice(0, 1000) || null
  const notes = (formData.get('notes') ?? '').toString().trim().slice(0, 2000) || null

  // Width/height — el cliente los autodetecta del archivo y los manda; si no llegan, null.
  const widthRaw  = formData.get('width')
  const heightRaw = formData.get('height')
  const width  = widthRaw  ? Math.max(1, Math.min(8192, parseInt(widthRaw.toString(),  10) || 0))  || null : null
  const height = heightRaw ? Math.max(1, Math.min(8192, parseInt(heightRaw.toString(), 10) || 0))  || null : null
  const aspectRatio = aspectRatioOf(width, height)

  // Content types asociados (CSV o repetidos en el FormData)
  const ctRaw = formData.getAll('content_type_id').map(v => v.toString()).filter(Boolean)
  // Validamos que existan en BD y queremos sus IDs únicos
  const contentTypeIds = Array.from(new Set(ctRaw)).slice(0, 50)
  if (contentTypeIds.length > 0) {
    const { data: existing } = await admin
      .from('content_types')
      .select('id, channel')
      .in('id', contentTypeIds)
      .returns<Array<{ id: string; channel: Channel }>>()
    const validIds = new Set((existing ?? []).map(c => c.id))
    // Coherencia: el content_type debe ser del mismo canal que la plantilla
    const mismatched = (existing ?? []).filter(c => c.channel !== channel)
    if (mismatched.length > 0) {
      return NextResponse.json({ error: 'content_type_channel_mismatch' }, { status: 400 })
    }
    if (validIds.size !== contentTypeIds.length) {
      return NextResponse.json({ error: 'content_type_not_found' }, { status: 400 })
    }
  }

  // Sube el archivo a Storage — ruta: templates/<channel>/<userId>/<timestamp>-<safeName>
  const ext = (() => {
    if (file.type === 'image/png')  return 'png'
    if (file.type === 'image/webp') return 'webp'
    if (file.type === 'image/gif')  return 'gif'
    if (file.type === 'image/svg+xml') return 'svg'
    return 'jpg'
  })()
  const safeBase = name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'template'
  const storagePath = `${TEMPLATE_PREFIX}/${channel}/${me.id}/${Date.now()}-${safeBase}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error('[creative-templates/POST] storage failed:', uploadError.message)
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 })
  }

  // Inserta la fila — campos de auditoría server-only
  const insertRow = {
    name,
    description,
    channel,
    market,
    asset_role: assetRole,
    storage_path: storagePath,
    mime_type: file.type,
    width,
    height,
    aspect_ratio: aspectRatio,
    file_size: file.size,
    notes,
    active: true,
    created_by: me.id,
  }
  const { data: created, error: insertErr } = await admin
    .from('creative_templates')
    .insert(insertRow as never)
    .select('*')
    .single<CreativeTemplate>()
  if (insertErr || !created) {
    // Rollback del archivo subido si la inserción falla
    await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
    console.error('[creative-templates/POST] insert failed:', insertErr?.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  // Asociaciones con content_types — bulk insert si llegaron
  if (contentTypeIds.length > 0) {
    const pivot = contentTypeIds.map(id => ({ template_id: created.id, content_type_id: id }))
    const { error: pivotErr } = await admin
      .from('creative_template_content_types')
      .insert(pivot as never)
    if (pivotErr) {
      // No es bloqueante para devolver la plantilla, pero lo logamos
      console.error('[creative-templates/POST] pivot insert failed:', pivotErr.message)
    }
  }

  const [hydrated] = await hydrate(admin, [created])
  return NextResponse.json(hydrated)
}
