import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt } from '@/lib/market-rules'
import { checkRateLimit } from '@/lib/rate-limit'
import type {
  Profile, Market, Channel, ContentItem,
} from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un estratega SEO senior para iGEO (ERP B2B de sanidad ambiental, control de plagas, Legionella).

Recibirás un listado del contenido ya publicado/planificado y un mercado. Tu trabajo es identificar GAPS — temas relevantes para el buyer persona del sector que NO están cubiertos.

Devuelve SOLO un objeto JSON válido (sin markdown ni code fences) con esta estructura:
{
  "gaps": [
    {
      "topic": "tema/keyword del gap",
      "intent": "informational|commercial|transactional|navigational",
      "priority": "high|medium|low",
      "rationale": "por qué es un gap relevante (1-2 frases)",
      "suggested_format": "blog|guide|comparison|landing|video|case_study",
      "buyer_persona": "técnico|directivo|gestor|compliance"
    }
  ],
  "summary": "1-2 frases con el patrón general detectado en los gaps"
}

Reglas:
- Mínimo 5 gaps, máximo 15
- Sé específico al sector iGEO (no genérico)
- Considera el funnel completo (top, middle, bottom)
- Considera diferentes buyer personas del sector`

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

interface GapAnalysisResult {
  gaps: Array<{
    topic: string
    intent: string | null
    priority: 'high' | 'medium' | 'low' | null
    rationale: string | null
    suggested_format: string | null
    buyer_persona: string | null
  }>
  summary: string | null
  context: {
    market: Market
    channel: Channel | null
    items_analyzed: number
  }
}

/**
 * POST /api/seo/gap-analysis
 *
 * Body: { market?: Market, channel?: Channel }
 *
 * Carga el contenido existente (content_items con content) del mercado/canal
 * indicado y le pide a Gemini que identifique gaps. NO persiste — los gaps
 * se muestran en el cliente para que el usuario decida cuáles convertir
 * en sesiones de research o briefs.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // Gemini Pro (modelo costoso) → solo admin/manager
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Gemini Pro + lectura masiva BD — limitar a 3/min por usuario
  const rl = checkRateLimit(`seo-gap:${user.id}`, 3, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', resetInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } },
    )
  }

  let body: { market?: Market; channel?: Channel }
  try { body = await req.json() } catch { body = {} }

  const market: Market = (body.market && MARKETS.includes(body.market)) ? body.market : 'spain'
  const channel: Channel | null = body.channel && CHANNELS.includes(body.channel) ? body.channel : null

  // Cargar últimos 200 items con content del mercado/canal
  let query = admin
    .from('content_items').select('title, channel, market')
    .eq('market', market)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (channel) query = query.eq('channel', channel)

  const existingResult = await query
    .returns<Pick<ContentItem, 'title' | 'channel' | 'market'>[]>()
  const existingItems: Pick<ContentItem, 'title' | 'channel' | 'market'>[] = existingResult.data ?? []

  // Construir resumen del contenido existente para el prompt
  const existingSummary = existingItems.length === 0
    ? '(No hay contenido publicado todavía para este mercado/canal)'
    : existingItems.map((it, i) => `${i + 1}. [${it.channel}] ${it.title}`).join('\n')

  const marketRulesSection = await buildMarketRulesPrompt(admin, market, channel ?? undefined)
  const systemWithRules = SYSTEM_PROMPT + marketRulesSection

  const userPrompt = [
    `Analiza los gaps de contenido para iGEO.`,
    `Mercado: ${market}`,
    channel ? `Canal: ${channel}` : `Canal: todos`,
    `\nContenido actual (${existingItems.length} piezas):`,
    existingSummary,
  ].join('\n')

  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-pro',  // Pro para análisis estratégico más profundo
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemWithRules,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    })

    const raw = res.text?.trim() ?? ''
    if (!raw) return NextResponse.json({ error: 'empty_llm_response' }, { status: 502 })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw)
    } catch {
      try { parsed = JSON.parse(stripCodeFences(raw)) }
      catch {
        console.error('[seo/gap-analysis] unparseable JSON:', raw.slice(0, 400))
        return NextResponse.json({ error: 'llm_invalid_json' }, { status: 502 })
      }
    }

    const gapsRaw = Array.isArray(parsed.gaps) ? parsed.gaps : []
    const VALID_PRIORITY = ['high', 'medium', 'low']
    const gaps = gapsRaw
      .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
      .map(g => ({
        topic: typeof g.topic === 'string' ? g.topic.trim().slice(0, 200) : '',
        intent: typeof g.intent === 'string' ? g.intent : null,
        priority: typeof g.priority === 'string' && VALID_PRIORITY.includes(g.priority)
          ? (g.priority as 'high' | 'medium' | 'low') : null,
        rationale: typeof g.rationale === 'string' ? g.rationale.trim().slice(0, 500) : null,
        suggested_format: typeof g.suggested_format === 'string' ? g.suggested_format.trim().slice(0, 50) : null,
        buyer_persona: typeof g.buyer_persona === 'string' ? g.buyer_persona.trim().slice(0, 100) : null,
      }))
      .filter(g => g.topic.length > 0)

    const result: GapAnalysisResult = {
      gaps,
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : null,
      context: {
        market,
        channel,
        items_analyzed: existingItems.length,
      },
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[seo/gap-analysis] error:', err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'gap_analysis_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
