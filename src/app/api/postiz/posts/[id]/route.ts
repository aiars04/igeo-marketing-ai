import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postizDeletePost } from '@/lib/postiz'
import type { Profile } from '@/types/database'

/**
 * DELETE /api/postiz/posts/:id
 *
 * Cancela un post en Postiz (programados/borradores) y desvincula el
 * content_item asociado: limpia postiz_id, scheduled_at, published_at y
 * publish_state para que el item vuelva a poder publicarse desde 0.
 *
 * Requiere rol admin/manager — cualquiera de los dos puede cancelar
 * cualquier post del workspace (mismo criterio que /publish, app interna).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postizId } = await params

  if (!postizId || typeof postizId !== 'string' || postizId.length > 200) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, active')
    .eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Buscar el content_item asociado al post (puede no existir si el post fue
  // creado fuera de la app). Cualquier admin/manager puede cancelar — es una
  // app interna donde el contenido es del equipo (mismo criterio que /publish).
  const { data: targetItem } = await admin
    .from('content_items')
    .select('id')
    .eq('postiz_id', postizId)
    .maybeSingle<{ id: string }>()

  // 1) Cancelar en Postiz (idempotente — 404 también se considera éxito).
  try {
    await postizDeletePost(postizId)
  } catch (err) {
    console.error('[postiz/posts/delete] upstream error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'postiz_upstream_failed' }, { status: 502 })
  }

  // 2) Limpiar el item asociado (si existía en nuestra BD).
  if (targetItem) {
    const { error: updErr } = await admin
      .from('content_items')
      .update({
        postiz_id:        null,
        published_at:     null,
        publish_state:    null,
        publish_error:    null,
        publish_synced_at: null,
        // scheduled_at lo dejamos — puede que el user quiera reusar la fecha al republicar.
      } as never)
      .eq('id', targetItem.id)
    if (updErr) {
      console.warn('[postiz/posts/delete] no se pudo limpiar content_item:', updErr.message)
    }
  }

  return NextResponse.json({ ok: true, unlinkedItemId: targetItem?.id ?? null })
}
