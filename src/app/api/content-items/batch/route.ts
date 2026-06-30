import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ALL_MARKETS, MARKET_CONFIG } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'
import type { ContentItem, Profile, Channel, Market } from '@/types/database'

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
// MARKETS y MARKET_LABEL ahora vienen de @/lib/utils (fuente única).
const MARKETS: Market[] = ALL_MARKETS

// Tope conservador para evitar inserts masivos accidentales por un slip de UI.
const MAX_BATCH_ITEMS = 50

const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  x: 'X', blog: 'Blog', email: 'Email', newsletter: 'Newsletter',
}
// Para títulos auto-generados usamos la abreviatura (ES, LATAM, INT, FR, …).
const MARKET_LABEL: Record<Market, string> = Object.fromEntries(
  ALL_MARKETS.map(m => [m, MARKET_CONFIG[m].abbr]),
) as Record<Market, string>

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

/**
 * POST /api/content-items/batch
 *
 * Crea N content_items en stage 'ideas' a partir de una matriz mercado × canal,
 * compartiendo el mismo prompt como `description`. El usuario luego dispara la
 * generación con IA (Gemini) item a item desde el modal del pipeline.
 *
 * Body:
 * {
 *   prompt: string,
 *   campaign?: string,
 *   matrix: Array<{ market: Market, channels: Channel[] }>
 * }
 *
 * Devuelve: { items: ContentItem[] }
 */
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  // Crear N items en bloque (hasta 50 inserts + chequeo de duplicados) — solo
  // admin/manager. Sin este gate cualquier active user podía generar matrices
  // gigantes accidentalmente o saturar el pipeline.
  if (me.role !== 'admin' && me.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  // Rate-limit: 3 batches/min — el caso real es 1 cada varios minutos.
  const rl = checkRateLimit(`ci-batch:${me.id}`, 3, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', resetInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } },
    )
  }

  let body: {
    prompt?: string
    campaign?: string | null
    matrix?: Array<{ market?: string; channels?: string[] }>
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const prompt = (body.prompt ?? '').trim()
  if (prompt.length < 3) return NextResponse.json({ error: 'prompt_too_short' }, { status: 400 })
  if (prompt.length > 2000) return NextResponse.json({ error: 'prompt_too_long' }, { status: 400 })

  if (!Array.isArray(body.matrix) || body.matrix.length === 0) {
    return NextResponse.json({ error: 'matrix_required' }, { status: 400 })
  }

  // Aplanamos la matriz a una lista de combos (market, channel) deduplicada por par.
  const seen = new Set<string>()
  const combos: Array<{ market: Market; channel: Channel }> = []
  for (const row of body.matrix) {
    const market = row.market as Market
    if (!MARKETS.includes(market)) {
      return NextResponse.json({ error: 'invalid_market' }, { status: 400 })
    }
    if (!Array.isArray(row.channels) || row.channels.length === 0) {
      return NextResponse.json({ error: 'channels_required_per_market' }, { status: 400 })
    }
    for (const raw of row.channels) {
      const channel = raw as Channel
      if (!CHANNELS.includes(channel)) {
        return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })
      }
      const key = `${market}:${channel}`
      if (seen.has(key)) continue
      seen.add(key)
      combos.push({ market, channel })
    }
  }

  if (combos.length === 0) return NextResponse.json({ error: 'empty_matrix' }, { status: 400 })
  if (combos.length > MAX_BATCH_ITEMS) {
    return NextResponse.json({ error: 'too_many_items', max: MAX_BATCH_ITEMS }, { status: 400 })
  }

  const campaign = body.campaign?.toString().trim() || null
  const promptSnippet = prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt

  // Construimos los rows respetando el contrato de POST single (NUNCA aceptamos
  // campos de auditoría/aprobación del cliente).
  const rows = combos.map(({ market, channel }) => ({
    title:           `${CHANNEL_LABEL[channel]} · ${MARKET_LABEL[market]} — ${promptSnippet}`,
    channel,
    stage:           'ideas' as const,
    market,
    status:          'pending' as const,
    campaign,
    content:         null,
    description:     prompt,
    ai_generated:    true,
    clarity_pass:    null,
    clarity_summary: null,
    human_approved:  false,
    approved_by:     null,
    approved_at:     null,
    scheduled_at:    null,
    published_at:    null,
    postiz_id:       null,
    calendar_item_id: null,
    created_by:      me.id,
  }))

  const { data, error } = await admin
    .from('content_items')
    .insert(rows as never)
    .select('*')
    .returns<ContentItem[]>()
  if (error) {
    console.error('[content-items/batch] insert failed:', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
