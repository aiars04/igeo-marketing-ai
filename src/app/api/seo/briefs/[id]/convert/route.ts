import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Profile, SeoBrief, ContentItem, Channel,
} from '@/types/database'

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

/**
 * POST /api/seo/briefs/[id]/convert
 *
 * Convierte un brief SEO en un content_item en stage 'ideas'.
 * El brief queda marcado como status='converted' con related_content_item_id.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  // 1) Claim atómico: marca el brief como 'converted' SOLO si aún no lo está.
  //    Si dos POST entran a la vez, solo uno gana el UPDATE; el otro recibe 0 filas.
  //    Evita race condition de doble-conversión (2 content_items huérfanos).
  const { data: claimed, error: claimErr } = await admin
    .from('seo_briefs')
    .update({ status: 'converted' } as never)
    .eq('id', id)
    .neq('status', 'converted')
    .select('*')
    .maybeSingle<SeoBrief>()
  if (claimErr) {
    console.error('[seo/briefs/convert] claim failed:', claimErr.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  if (!claimed) {
    // Otro request ya lo convirtió antes (o el brief no existe). Devuelve el item ya creado.
    const { data: existing } = await admin
      .from('seo_briefs').select('related_content_item_id').eq('id', id)
      .maybeSingle<{ related_content_item_id: string | null }>()
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(
      { error: 'already_converted', content_item_id: existing.related_content_item_id },
      { status: 409 },
    )
  }
  const brief = claimed

  // Construir descripción enriquecida con el outline del brief
  const descriptionLines: string[] = []
  descriptionLines.push(`Keyword principal: ${brief.primary_keyword}`)
  if (brief.secondary_keywords.length > 0) {
    descriptionLines.push(`Secundarias: ${brief.secondary_keywords.join(', ')}`)
  }
  if (brief.intent) descriptionLines.push(`Intención: ${brief.intent}`)
  if (brief.target_length) descriptionLines.push(`Longitud objetivo: ${brief.target_length} palabras`)
  if (brief.suggested_h2.length > 0) {
    descriptionLines.push(`\nEstructura sugerida:\n${brief.suggested_h2.map(h => `- ${h}`).join('\n')}`)
  }
  if (brief.cta) descriptionLines.push(`\nCTA: ${brief.cta}`)
  if (brief.content_outline) descriptionLines.push(`\n--- Outline ---\n${brief.content_outline}`)

  const channel: Channel = (brief.channel ?? 'blog') as Channel

  const { data: item, error: iErr } = await admin
    .from('content_items').insert({
      title: brief.title,
      channel,
      stage: 'ideas',
      market: brief.market,
      status: 'pending',
      campaign: null,
      content: null,
      description: descriptionLines.join('\n'),
      ai_generated: false,
      clarity_pass: null,
      clarity_summary: null,
      human_approved: false,
      approved_by: null,
      approved_at: null,
      scheduled_at: null,
      published_at: null,
      postiz_id: null,
      calendar_item_id: null,
      package_id: null,
      playbook_step_id: null,
      created_by: me.id,
    } as never)
    .select('*').single<ContentItem>()
  if (iErr || !item) {
    console.error('[seo/briefs/convert] item create failed:', iErr?.message)
    // Rollback del claim para permitir reintentar
    try {
      await admin.from('seo_briefs')
        .update({ status: 'draft' } as never)
        .eq('id', id)
        .eq('status', 'converted')
    } catch (rErr) {
      // Si el rollback falla, el brief queda 'converted' sin item vinculado.
      // Lo registramos para poder detectar el estado inconsistente.
      console.error('[seo/briefs/convert] rollback failed:', rErr instanceof Error ? rErr.message : String(rErr))
    }
    return NextResponse.json({ error: 'item_create_failed' }, { status: 500 })
  }

  // Vincular el item creado al brief (status ya está 'converted' por el claim).
  const { error: upErr } = await admin
    .from('seo_briefs')
    .update({ related_content_item_id: item.id } as never)
    .eq('id', id)
  if (upErr) {
    console.error('[seo/briefs/convert] brief link failed:', upErr.message)
    // No es bloqueante — el item ya existe y el brief está marcado convertido
  }

  return NextResponse.json({ content_item: item, brief_id: brief.id })
}
