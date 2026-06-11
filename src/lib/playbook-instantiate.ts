/**
 * Lógica de instanciación de playbooks reutilizable.
 *
 * Usado por:
 *  - POST /api/playbooks/[id]/instantiate (manual, un playbook)
 *  - POST /api/editorial-plan/generate    (masivo, mes completo)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Playbook, PlaybookStep, CampaignPackage,
  ContentItem, Channel, Market,
} from '@/types/database'

/** Reemplaza placeholders {{var}} en un texto. */
export function applyTemplate(
  tpl: string | null | undefined,
  vars: Record<string, string>,
): string {
  if (!tpl) return ''
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export interface InstantiateInput {
  playbookId: string
  title: string
  anchorDate: Date
  market: Market
  objective: string | null
  createdBy: string
}

export interface InstantiateResult {
  package: CampaignPackage
  items: ContentItem[]
}

/**
 * Aplica un playbook con su fecha ancla y crea:
 *  - Un campaign_package
 *  - N content_items (uno por step) en stage 'ideas' con fechas calculadas
 *
 * Lanza error si:
 *  - Playbook no existe o inactivo
 *  - Playbook no tiene steps
 *  - Falla la creación (con rollback del package huérfano)
 */
export async function instantiatePlaybook(
  admin: SupabaseClient,
  input: InstantiateInput,
): Promise<InstantiateResult> {
  const { playbookId, title, anchorDate, market, objective, createdBy } = input

  // 1) Cargar playbook + steps
  const { data: playbook, error: pErr } = await admin
    .from('playbooks').select('*').eq('id', playbookId).single<Playbook>()
  if (pErr || !playbook) throw new Error('playbook_not_found')
  if (!playbook.active) throw new Error('playbook_inactive')

  const { data: stepsData } = await admin
    .from('playbook_steps').select('*').eq('playbook_id', playbookId)
    .order('step_order', { ascending: true })
    .returns<PlaybookStep[]>()
  const steps: PlaybookStep[] = stepsData ?? []
  if (steps.length === 0) throw new Error('playbook_has_no_steps')

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
      objective,
      anchor_date: anchorDate.toISOString(),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      playbook_id: playbook.id,
      status: 'draft',
      created_by: createdBy,
    } as never)
    .select('*').single<CampaignPackage>()
  if (pkgErr || !pkg) throw new Error('package_create_failed')

  // 3) Crear N content_items
  const fallbackChannel: Channel = (playbook.default_channels[0] ?? 'linkedin') as Channel
  const templateVars: Record<string, string> = {
    event_name: title,
    anchor_date: anchorDate.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
    market,
  }

  const itemRows = steps.map(step => {
    const scheduledAt = new Date(anchorDate.getTime() + step.relative_day_offset * 86400000)
    const itemTitle = applyTemplate(step.title_template, templateVars)
      || `${title} — paso ${step.step_order + 1}`
    const channel = (step.channel ?? fallbackChannel) as Channel

    return {
      title: itemTitle,
      channel, stage: 'ideas', market, status: 'pending',
      campaign: title,
      content: null, description: step.instructions ?? null,
      ai_generated: false,
      clarity_pass: null, clarity_summary: null,
      human_approved: false, approved_by: null, approved_at: null,
      scheduled_at: scheduledAt.toISOString(),
      published_at: null, postiz_id: null,
      calendar_item_id: null,
      package_id: pkg.id,
      playbook_step_id: step.id,
      created_by: createdBy,
    }
  })

  const { data: items, error: itemsErr } = await admin
    .from('content_items').insert(itemRows as never).select('*')
    .returns<ContentItem[]>()
  if (itemsErr) {
    // Rollback: borra el package huérfano
    try { await admin.from('campaign_packages').delete().eq('id', pkg.id) } catch {}
    throw new Error('items_create_failed')
  }

  return { package: pkg, items: items ?? [] }
}
