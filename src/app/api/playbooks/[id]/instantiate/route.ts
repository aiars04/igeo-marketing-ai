import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Playbook, PlaybookStep, CampaignPackage,
  ContentItem, Profile, Market, Channel,
} from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil']

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
 * Reemplaza placeholders {{var}} en un texto.
 * Variables soportadas: event_name, anchor_date, market
 */
function applyTemplate(
  tpl: string | null | undefined,
  vars: Record<string, string>,
): string {
  if (!tpl) return ''
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/**
 * POST /api/playbooks/[id]/instantiate
 *
 * Body:
 *   {
 *     title: string,         // título del campaign_package
 *     anchor_date: string,   // ISO, fecha del evento principal
 *     market?: Market,       // por defecto 'spain'
 *     objective?: string,
 *   }
 *
 * Crea:
 *   1) Un campaign_package con título y fecha ancla
 *   2) N content_items (uno por step del playbook), calculando:
 *      - scheduled_at = anchor_date + relative_day_offset días
 *      - title = applyTemplate(step.title_template, { event_name, anchor_date, market })
 *      - description = step.instructions
 *      - channel = step.channel (o primer canal del playbook si null)
 *      - playbook_step_id = step.id, package_id = package.id
 *
 * Retorna: { package, items }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id: playbookId } = await ctx.params

  let body: {
    title?: string
    anchor_date?: string
    market?: Market
    objective?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (!body.anchor_date) return NextResponse.json({ error: 'anchor_date_required' }, { status: 400 })

  const anchorDate = new Date(body.anchor_date)
  if (isNaN(anchorDate.getTime())) {
    return NextResponse.json({ error: 'invalid_anchor_date' }, { status: 400 })
  }

  const market: Market = (body.market && MARKETS.includes(body.market))
    ? body.market
    : 'spain'

  // 1) Cargar playbook + steps
  const { data: playbook, error: pErr } = await admin
    .from('playbooks')
    .select('*')
    .eq('id', playbookId)
    .single<Playbook>()
  if (pErr || !playbook) return NextResponse.json({ error: 'playbook_not_found' }, { status: 404 })
  if (!playbook.active) return NextResponse.json({ error: 'playbook_inactive' }, { status: 400 })

  const { data: steps } = await admin
    .from('playbook_steps')
    .select('*')
    .eq('playbook_id', playbookId)
    .order('step_order', { ascending: true })
    .returns<PlaybookStep[]>()

  if (!steps || steps.length === 0) {
    return NextResponse.json({ error: 'playbook_has_no_steps' }, { status: 400 })
  }

  // 2) Crear campaign_package
  const offsets = steps.map(s => s.relative_day_offset)
  const minOffset = Math.min(...offsets)
  const maxOffset = Math.max(...offsets)
  const startDate = new Date(anchorDate.getTime() + minOffset * 86400000)
  const endDate   = new Date(anchorDate.getTime() + maxOffset * 86400000)

  const { data: pkg, error: pkgErr } = await admin
    .from('campaign_packages')
    .insert({
      title,
      package_type: playbook.type,
      market,
      objective: body.objective ?? null,
      anchor_date: anchorDate.toISOString(),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      playbook_id: playbook.id,
      status: 'draft',
      created_by: me.id,
    } as never)
    .select('*')
    .single<CampaignPackage>()
  if (pkgErr || !pkg) {
    console.error('[instantiate] package creation failed:', pkgErr?.message)
    return NextResponse.json({ error: 'package_create_failed' }, { status: 500 })
  }

  // 3) Crear N content_items, uno por step
  const fallbackChannel: Channel = (playbook.default_channels[0] ?? 'linkedin') as Channel
  const templateVars: Record<string, string> = {
    event_name: title,
    anchor_date: anchorDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    market,
  }

  const itemRows = steps.map(step => {
    const scheduledAt = new Date(anchorDate.getTime() + step.relative_day_offset * 86400000)
    const itemTitle = applyTemplate(step.title_template, templateVars) || `${title} — paso ${step.step_order + 1}`
    const channel = (step.channel ?? fallbackChannel) as Channel

    return {
      title: itemTitle,
      channel,
      stage: 'ideas',
      market,
      status: 'pending',
      campaign: title,
      content: null,
      description: step.instructions ?? null,
      ai_generated: false,
      clarity_pass: null,
      clarity_summary: null,
      human_approved: false,
      approved_by: null,
      approved_at: null,
      scheduled_at: scheduledAt.toISOString(),
      published_at: null,
      postiz_id: null,
      calendar_item_id: null,
      package_id: pkg.id,
      playbook_step_id: step.id,
      created_by: me.id,
    }
  })

  const { data: items, error: itemsErr } = await admin
    .from('content_items')
    .insert(itemRows as never)
    .select('*')
    .returns<ContentItem[]>()
  if (itemsErr) {
    // Rollback: borra el package huérfano
    try { await admin.from('campaign_packages').delete().eq('id', pkg.id) } catch {}
    console.error('[instantiate] items creation failed:', itemsErr.message)
    return NextResponse.json({ error: 'items_create_failed' }, { status: 500 })
  }

  return NextResponse.json({ package: pkg, items: items ?? [] })
}
