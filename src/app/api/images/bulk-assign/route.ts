import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const MAX_BATCH = 20

export const runtime = 'nodejs'

/**
 * POST /api/images/bulk-assign
 *
 * Asigna N assets del banco a un mismo content_item como CARRUSEL. Resuelve
 * el bug Alvaro 30-jun: el ImageBankPicker solo permitía vincular UNA imagen
 * por click, así que era imposible armar un carrusel desde el banco.
 *
 * Genera un carousel_id común para todos los assets seleccionados, asigna
 * position 0..N-1 según el orden del array `ids` recibido, y reusa
 * carousel_id existente si todos los ids comparten uno (preserva agrupaciones
 * generadas por IA via /api/images/carousel).
 *
 * Body: { ids: string[], content_item_id: string }
 *
 * Auth: owner del item o admin/manager (mismo gate que /api/images/[id]/assign).
 *
 * IMPORTANTE: hay un UNIQUE INDEX (carousel_id, position). Como asignamos un
 * carousel_id NUEVO a todos a la vez (o reusamos uno existente), las posiciones
 * 0..N-1 NO chocan con otros assets — pero PUEDEN chocar con assets que YA
 * estaban en ese mismo carousel_id (si reusamos). Por simplicidad y para
 * evitar conflictos: SIEMPRE generamos un carousel_id NUEVO cuando bulk-assign
 * crea un grupo (los assets del banco quizá ya tenían carousel_id viejo de su
 * generación original).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!me || !me.active) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const isPriv = me.role === 'admin' || me.role === 'manager'

  let body: { ids?: unknown; content_item_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // Validar ids
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 })
  }
  const ids = Array.from(new Set(
    body.ids.filter((x): x is string => typeof x === 'string' && x.length > 0),
  )).slice(0, MAX_BATCH)
  if (ids.length === 0) {
    return NextResponse.json({ error: 'no_valid_ids' }, { status: 400 })
  }

  const contentItemId = (body.content_item_id ?? '').toString().trim()
  if (!contentItemId) {
    return NextResponse.json({ error: 'content_item_id_required' }, { status: 400 })
  }

  // Permiso sobre el item destino
  const { data: ci } = await admin
    .from('content_items').select('id, created_by').eq('id', contentItemId)
    .maybeSingle<{ id: string; created_by: string | null }>()
  if (!ci) return NextResponse.json({ error: 'content_item_not_found' }, { status: 404 })
  const isItemOwner = ci.created_by === me.id
  if (!isItemOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden_content_item' }, { status: 403 })
  }

  // Cargar los assets y verificar permiso por asset (mismo gate que /assign)
  const { data: rows, error: selErr } = await admin
    .from('content_assets')
    .select('id, created_by, content_item_id, carousel_id, position')
    .in('id', ids)
    .returns<Array<{ id: string; created_by: string | null; content_item_id: string | null; carousel_id: string | null; position: number | null }>>()
  if (selErr) {
    console.error('[images/bulk-assign] select failed:', selErr.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  const found = new Set((rows ?? []).map(r => r.id))
  const notFound = ids.filter(id => !found.has(id))
  if (notFound.length > 0) {
    return NextResponse.json({ error: 'asset_not_found', detail: `Assets no encontrados: ${notFound.length}` }, { status: 404 })
  }
  for (const r of rows ?? []) {
    const owner = r.created_by === me.id
    if (!owner && !isPriv) {
      return NextResponse.json({ error: 'forbidden_asset' }, { status: 403 })
    }
  }

  // Estrategia para evitar conflicto del UNIQUE INDEX (carousel_id, position)
  // Y para no dejar assets viejos huérfanos vinculados al item destino:
  //
  //   Fase 0: limpiar TODOS los assets que YA estaban vinculados al item
  //           destino y que NO están en los ids nuevos. Sin esto, un item
  //           que ya tenía A,B y recibe C,D,E acabaría con A,B,C,D,E (los
  //           viejos huérfanos). Esto sustituye la asignación previa por
  //           la nueva (semántica esperada del usuario).
  //   Fase 1: poner los N assets en un estado "limbo" — carousel_id=null,
  //           position=null. Sin esto, si reusamos un carousel_id de uno de
  //           los assets, los positions nuevos podrían chocar con los viejos.
  //   Fase 2: asignar el carousel_id final + position 0..N-1 + content_item_id.
  //
  // Generamos un carousel_id NUEVO en lugar de reusar uno existente: los
  // assets del banco probablemente tienen carousel_ids de su generación
  // anterior, y mezclarlos crearía ambigüedad. Un carrusel construido
  // manualmente debe tener identidad propia.
  const newCarouselId = randomUUID()

  // Fase 0: desvincular los assets que YA estaban en este item y que NO
  // forman parte del nuevo carrusel. Best-effort: si falla, log warning y
  // seguimos — el usuario verá los huérfanos pero la nueva asignación
  // funciona (mejor que abortar todo).
  const { error: clearPrevErr } = await admin
    .from('content_assets')
    .update({ content_item_id: null, carousel_id: null, position: null } as never)
    .eq('content_item_id', contentItemId)
    .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`)
  if (clearPrevErr) {
    console.warn('[images/bulk-assign] phase0 clearPrev failed:', clearPrevErr.message)
  }

  // Fase 1: limbo (libera carousel_id y position viejos de los ids nuevos)
  const { error: clearErr } = await admin
    .from('content_assets')
    .update({ carousel_id: null, position: null } as never)
    .in('id', ids)
  if (clearErr) {
    console.error('[images/bulk-assign] phase1 clear failed:', clearErr.message)
    return NextResponse.json({ error: 'phase1_failed' }, { status: 500 })
  }

  // Fase 2: asignar al item con el nuevo carrusel y position 0..N-1.
  // En serie para tener feedback granular si alguno falla.
  for (let i = 0; i < ids.length; i++) {
    const { error: updErr } = await admin
      .from('content_assets')
      .update({
        content_item_id: contentItemId,
        carousel_id: newCarouselId,
        position: i,
      } as never)
      .eq('id', ids[i])
    if (updErr) {
      // Best-effort rollback de los que ya cambiamos (vuelven a limbo). El
      // archivo en bucket queda intacto — solo deshacemos vínculos.
      console.error(`[images/bulk-assign] phase2 update[${i}] failed:`, updErr.message)
      try {
        await admin.from('content_assets')
          .update({ content_item_id: null, carousel_id: null, position: null } as never)
          .in('id', ids)
      } catch (rbErr) {
        console.error('[images/bulk-assign] rollback failed:', rbErr instanceof Error ? rbErr.message : rbErr)
      }
      return NextResponse.json({ error: 'phase2_failed', detail: `Fallo al asignar slide ${i}: ${updErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    carousel_id: newCarouselId,
    content_item_id: contentItemId,
    assigned: ids.length,
    ids,
  })
}
