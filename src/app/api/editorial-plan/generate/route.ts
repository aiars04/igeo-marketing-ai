import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { instantiatePlaybook } from '@/lib/playbook-instantiate'
import type {
  Playbook, PlaybookType, Market, Profile,
  ContentItem, CampaignPackage,
} from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const PLAYBOOK_TYPES: PlaybookType[] = [
  'webinar', 'event_presential', 'event_online', 'release',
  'newsletter', 'campaign', 'alliance', 'workshop',
  'lead_magnet', 'reactivation', 'podcast',
]

export const runtime = 'nodejs'
export const maxDuration = 60

interface BacklogItem {
  type: PlaybookType
  title: string
  date: string           // ISO de la fecha ancla
  playbook_id?: string   // Si el usuario eligió uno concreto
  objective?: string
}

interface GenerateBody {
  month: string          // 'YYYY-MM'
  market: Market
  backlog: BacklogItem[]
  fill_gaps?: boolean    // Generar posts filler en semanas sin contenido
}

interface PlanReport {
  packages_created: CampaignPackage[]
  items_created: ContentItem[]
  filler_items: ContentItem[]
  warnings: string[]
  summary: {
    backlog_items: number
    packages_created: number
    total_pieces: number
    filler_pieces: number
    gaps_detected: number
    collisions: number
  }
}

function parseMonth(monthStr: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

function startOfWeek(d: Date): Date {
  const result = new Date(d)
  const day = result.getDay()
  const diff = result.getDate() - day + (day === 0 ? -6 : 1)  // lunes
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

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
 * POST /api/editorial-plan/generate
 *
 * Toma un backlog del mes y aplica playbooks en bucle para generar el calendario editorial.
 *
 * Body: { month: 'YYYY-MM', market, backlog: [{ type, title, date, playbook_id? }, ...], fill_gaps? }
 *
 * Por cada backlog item:
 *   1. Si especifica playbook_id → instancia ese
 *   2. Si no → busca primer playbook activo del mismo tipo (preferentemente market_scope = market o 'all')
 *   3. Si no encuentra ninguno → añade warning y salta
 *
 * Si fill_gaps:
 *   - Detecta semanas del mes sin ninguna pieza programada
 *   - Crea 1 post LinkedIn filler por semana vacía con título genérico
 *
 * Detecta colisiones: > 3 piezas el mismo día se reporta como warning
 *
 * Retorna PlanReport con packages, items, warnings y resumen.
 */
export async function POST(req: Request) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: GenerateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  // ── Validación ────────────────────────────────────────────────────────────
  const monthInfo = parseMonth(body.month)
  if (!monthInfo) return NextResponse.json({ error: 'invalid_month_format' }, { status: 400 })

  if (!MARKETS.includes(body.market)) {
    return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
  }
  if (!Array.isArray(body.backlog)) {
    return NextResponse.json({ error: 'backlog_required' }, { status: 400 })
  }
  if (body.backlog.length > 30) {
    return NextResponse.json({ error: 'backlog_too_large_max_30' }, { status: 400 })
  }

  const market = body.market
  const fillGaps = !!body.fill_gaps

  // ── Cargar playbooks activos para el matcher ──────────────────────────────
  const { data: playbooksData } = await admin
    .from('playbooks').select('*').eq('active', true)
    .returns<Playbook[]>()
  const playbooks: Playbook[] = playbooksData ?? []

  /** Selecciona el mejor playbook para un tipo + mercado dado. */
  const pickPlaybook = (type: PlaybookType): Playbook | null => {
    const candidates = playbooks.filter(p => p.type === type)
    if (candidates.length === 0) return null
    // Preferencia: market_scope === market > 'all' > resto
    const exact = candidates.find(p => p.market_scope === market)
    if (exact) return exact
    const all = candidates.find(p => p.market_scope === 'all')
    if (all) return all
    return candidates[0]
  }

  // ── Bucle de instanciación ────────────────────────────────────────────────
  const report: PlanReport = {
    packages_created: [],
    items_created: [],
    filler_items: [],
    warnings: [],
    summary: {
      backlog_items: body.backlog.length,
      packages_created: 0,
      total_pieces: 0,
      filler_pieces: 0,
      gaps_detected: 0,
      collisions: 0,
    },
  }

  for (let i = 0; i < body.backlog.length; i++) {
    const item = body.backlog[i]
    const title = (item.title ?? '').trim()
    if (!title) {
      report.warnings.push(`Backlog #${i + 1}: sin título — saltado`)
      continue
    }
    if (!PLAYBOOK_TYPES.includes(item.type)) {
      report.warnings.push(`Backlog "${title}": tipo "${item.type}" desconocido — saltado`)
      continue
    }
    if (!item.date) {
      report.warnings.push(`Backlog "${title}": sin fecha — saltado`)
      continue
    }
    const anchorDate = new Date(item.date)
    if (isNaN(anchorDate.getTime())) {
      report.warnings.push(`Backlog "${title}": fecha inválida — saltado`)
      continue
    }

    // Resolver playbook
    let playbookId = item.playbook_id
    if (!playbookId) {
      const matched = pickPlaybook(item.type)
      if (!matched) {
        report.warnings.push(`Backlog "${title}": no hay playbook activo para tipo "${item.type}"`)
        continue
      }
      playbookId = matched.id
    }

    try {
      const result = await instantiatePlaybook(admin, {
        playbookId,
        title,
        anchorDate,
        market,
        objective: item.objective ?? null,
        createdBy: me.id,
      })
      report.packages_created.push(result.package)
      report.items_created.push(...result.items)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      report.warnings.push(`Backlog "${title}": falló instanciación (${msg})`)
    }
  }

  // ── Detección de huecos (semanas vacías del mes) ──────────────────────────
  const monthStart = new Date(monthInfo.year, monthInfo.month - 1, 1)
  const monthEnd = new Date(monthInfo.year, monthInfo.month, 0, 23, 59, 59)

  const scheduledDates = report.items_created
    .map(i => i.scheduled_at ? new Date(i.scheduled_at) : null)
    .filter((d): d is Date => d !== null && d >= monthStart && d <= monthEnd)

  // Map semana (YYYY-MM-DD del lunes) → count
  const itemsPerWeek = new Map<string, number>()
  for (let d = startOfWeek(monthStart); d <= monthEnd; d.setDate(d.getDate() + 7)) {
    const key = d.toISOString().split('T')[0]
    itemsPerWeek.set(key, 0)
  }
  for (const d of scheduledDates) {
    const wk = startOfWeek(d).toISOString().split('T')[0]
    if (itemsPerWeek.has(wk)) {
      itemsPerWeek.set(wk, (itemsPerWeek.get(wk) ?? 0) + 1)
    }
  }

  const emptyWeeks: Date[] = []
  for (const [key, count] of itemsPerWeek) {
    if (count === 0) {
      const wkDate = new Date(key)
      // Solo si la semana entera está dentro del mes (al menos el martes)
      const wkTuesday = new Date(wkDate)
      wkTuesday.setDate(wkTuesday.getDate() + 1)
      if (wkTuesday >= monthStart && wkTuesday <= monthEnd) {
        emptyWeeks.push(wkDate)
      }
    }
  }
  report.summary.gaps_detected = emptyWeeks.length

  // ── Filler para huecos ────────────────────────────────────────────────────
  if (fillGaps && emptyWeeks.length > 0) {
    const fillerRows = emptyWeeks.map(wkStart => {
      // Programar el filler el miércoles a las 10:00
      const wed = new Date(wkStart)
      wed.setDate(wed.getDate() + 2)
      wed.setHours(10, 0, 0, 0)

      const monthLabel = wed.toLocaleDateString('es-ES', { month: 'long' })
      return {
        title: `Post LinkedIn — Semana del ${wkStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
        channel: 'linkedin',
        stage: 'ideas',
        market,
        status: 'pending',
        campaign: `Filler ${monthLabel}`,
        content: null,
        description: `Pieza filler generada por el orquestrador editorial. Sugerencia: post de visibilidad genérico sobre control de plagas / sanidad ambiental.`,
        ai_generated: false,
        clarity_pass: null,
        clarity_summary: null,
        human_approved: false,
        approved_by: null,
        approved_at: null,
        scheduled_at: wed.toISOString(),
        published_at: null,
        postiz_id: null,
        calendar_item_id: null,
        package_id: null,
        playbook_step_id: null,
        created_by: me.id,
      }
    })

    const { data: fillers, error: fillerErr } = await admin
      .from('content_items').insert(fillerRows as never).select('*')
      .returns<ContentItem[]>()
    if (fillerErr) {
      report.warnings.push(`Error creando fillers: ${fillerErr.message}`)
    } else {
      report.filler_items = fillers ?? []
      report.items_created.push(...(fillers ?? []))
    }
  }

  // ── Detección de colisiones (>3 piezas el mismo día) ──────────────────────
  const itemsPerDay = new Map<string, number>()
  for (const it of report.items_created) {
    if (!it.scheduled_at) continue
    const dayKey = new Date(it.scheduled_at).toISOString().split('T')[0]
    itemsPerDay.set(dayKey, (itemsPerDay.get(dayKey) ?? 0) + 1)
  }
  for (const [day, count] of itemsPerDay) {
    if (count > 3) {
      report.warnings.push(`Colisión: ${count} piezas programadas el ${day}`)
      report.summary.collisions++
    }
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  report.summary.packages_created = report.packages_created.length
  report.summary.total_pieces = report.items_created.length
  report.summary.filler_pieces = report.filler_items.length

  return NextResponse.json(report)
}
