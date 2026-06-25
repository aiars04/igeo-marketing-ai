import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const BUCKET = 'content-assets'
const MAX_BATCH = 100

/**
 * POST /api/images/batch-delete
 *
 * Borra múltiples content_assets en una sola llamada. Reemplaza el patrón
 * "N PATCH/DELETE individuales en serie" del cliente cuando el usuario
 * quiere limpiar varias imágenes a la vez.
 *
 * Body: { ids: string[] }  (hasta 100 ids)
 *
 * Respuesta:
 *   {
 *     ok: true,
 *     deleted: number,        // realmente borrados
 *     skipped: {              // breakdown del resto
 *       notFound: string[],   // ids inexistentes
 *       forbidden: string[],  // ids que el actor no puede borrar (no owner ni admin)
 *     }
 *   }
 *
 * Permisos por id: idéntico al DELETE individual — owner del asset O admin.
 * (manager NO puede borrar imágenes ajenas; mismo gate que /api/images/[id].)
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!me || !me.active) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { ids?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 })
  }
  // Dedup + tipo string + tope. Sin esto un cliente podría mandar 10k ids y
  // colgar el endpoint con un IN gigantesco.
  const idsRequested = Array.from(new Set(
    body.ids.filter((x): x is string => typeof x === 'string' && x.length > 0),
  )).slice(0, MAX_BATCH)
  if (idsRequested.length === 0) {
    return NextResponse.json({ error: 'no_valid_ids' }, { status: 400 })
  }

  // 1) Cargar metadatos de TODOS los ids pedidos. Filtraremos en código según
  //    ownership/rol.
  const { data: rows, error: selErr } = await admin
    .from('content_assets')
    .select('id, storage_path, created_by')
    .in('id', idsRequested)
    .returns<Array<{ id: string; storage_path: string; created_by: string | null }>>()
  if (selErr) {
    console.error('[images/batch-delete] select failed:', selErr.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  const foundIds = new Set((rows ?? []).map(r => r.id))
  const notFound = idsRequested.filter(id => !foundIds.has(id))

  const isAdmin = me.role === 'admin'
  const deletable: Array<{ id: string; storage_path: string }> = []
  const forbidden: string[] = []
  for (const r of rows ?? []) {
    const isOwner = r.created_by === me.id
    if (isOwner || isAdmin) {
      deletable.push({ id: r.id, storage_path: r.storage_path })
    } else {
      forbidden.push(r.id)
    }
  }

  // 2) Borrar de BD primero (mismo orden que el DELETE individual). Si falla,
  //    no tocamos Storage para que el cliente pueda reintentar.
  let deleted = 0
  if (deletable.length > 0) {
    const ids = deletable.map(d => d.id)
    const { error: delErr } = await admin
      .from('content_assets').delete().in('id', ids)
    if (delErr) {
      console.error('[images/batch-delete] db delete failed:', delErr.message)
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
    }
    deleted = ids.length

    // 3) Borrar archivos en Storage en una sola llamada (Supabase admite array).
    //    Si falla → log warning (huérfanos limpiables por cron), no abortamos.
    const paths = deletable.map(d => d.storage_path).filter(Boolean)
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths)
      if (rmErr) {
        console.warn('[images/batch-delete] storage warning (huérfanos):', rmErr.message)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    deleted,
    skipped: { notFound, forbidden },
  })
}
