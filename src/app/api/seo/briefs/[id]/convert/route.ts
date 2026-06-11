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

  const { data: brief, error: bErr } = await admin
    .from('seo_briefs').select('*').eq('id', id)
    .single<SeoBrief>()
  if (bErr || !brief) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (brief.status === 'converted' && brief.related_content_item_id) {
    return NextResponse.json({ error: 'already_converted', content_item_id: brief.related_content_item_id }, { status: 409 })
  }

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
    return NextResponse.json({ error: 'item_create_failed' }, { status: 500 })
  }

  // Marcar el brief como converted
  const { error: upErr } = await admin
    .from('seo_briefs')
    .update({ status: 'converted', related_content_item_id: item.id } as never)
    .eq('id', id)
  if (upErr) {
    console.error('[seo/briefs/convert] brief update failed:', upErr.message)
    // No es bloqueante — el item ya existe
  }

  return NextResponse.json({ content_item: item, brief_id: brief.id })
}
