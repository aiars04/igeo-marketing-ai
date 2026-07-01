import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt } from '@/lib/market-rules'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeUserInput, wrapUserInput, USER_INPUT_GUARD } from '@/lib/prompt-safety'
import type {
  Profile, Market, Channel,
  SeoResearchSession, SeoKeyword, SeoIntent, SeoLevel,
} from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico']
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const VALID_INTENTS: SeoIntent[] = ['informational', 'commercial', 'transactional', 'navigational']
const VALID_LEVELS: SeoLevel[] = ['high', 'medium', 'low']

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un experto en SEO y marketing de contenido B2B para iGEO, un ERP especializado en empresas de servicios técnicos de sanidad ambiental, control de plagas y Legionella.

Cuando recibas un tema y un mercado, genera un keyword research completo y realista:
- Identifica el cluster de keywords más relevantes en ese mercado/idioma
- Considera intención de búsqueda (informacional, comercial, transaccional, navegacional)
- Estima el volumen y la dificultad de forma cualitativa (high/medium/low)
- Sugiere el formato de contenido más adecuado (blog, guide, comparison, landing, video, etc.)

Devuelve SOLO un array JSON válido, sin markdown ni code fences, con este formato exacto:
[
  {
    "keyword": "...",
    "intent": "informational|commercial|transactional|navigational",
    "estimated_volume": "high|medium|low",
    "difficulty": "high|medium|low",
    "suggested_format": "blog|guide|comparison|landing|video|...",
    "notes": "breve nota sobre por qué es relevante para iGEO o el tipo de buyer persona"
  }
]

Mínimo 8 keywords, máximo 20. Mezcla long-tail con head terms.`

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/**
 * POST /api/seo/research
 *
 * Body: { topic: string, market?: Market, channel?: Channel, notes?: string }
 *
 * Genera keyword research con Gemini y guarda:
 *  - Una nueva seo_research_sessions
 *  - N seo_keywords vinculadas
 *
 * Retorna: { session, keywords }
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
  // Generación con Gemini consume cuota API → solo admin/manager
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const rl = checkRateLimit(`seo-research:${user.id}`, 5, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', resetInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } },
    )
  }

  let body: { topic?: string; market?: Market; channel?: Channel; notes?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const topic = (body.topic ?? '').trim()
  if (!topic) return NextResponse.json({ error: 'topic_required' }, { status: 400 })
  if (topic.length > 200) return NextResponse.json({ error: 'topic_too_long' }, { status: 400 })

  const market: Market = (body.market && MARKETS.includes(body.market)) ? body.market : 'spain'
  const channel: Channel | null =
    body.channel && CHANNELS.includes(body.channel) ? body.channel : null

  // Inyectar market_rules para contextualizar el research al mercado
  const marketRulesSection = await buildMarketRulesPrompt(admin, market, channel ?? undefined)
  const systemWithRules = SYSTEM_PROMPT + marketRulesSection + USER_INPUT_GUARD

  const safeTopic = sanitizeUserInput(topic, { max: 200 })
  const safeNotes = sanitizeUserInput(body.notes, { max: 2000 })

  const userPrompt = [
    `Tema: ${wrapUserInput(safeTopic)}`,
    `Mercado: ${market}`,
    channel ? `Canal objetivo: ${channel}` : null,
    safeNotes ? `Contexto adicional: ${wrapUserInput(safeNotes)}` : null,
    `\nGenera el keyword research.`,
  ].filter(Boolean).join('\n')

  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemWithRules,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    })

    const raw = res.text?.trim() ?? ''
    if (!raw) return NextResponse.json({ error: 'empty_llm_response' }, { status: 502 })

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      try { parsed = JSON.parse(stripCodeFences(raw)) }
      catch {
        console.error('[seo/research] unparseable JSON:', raw.slice(0, 400))
        return NextResponse.json({ error: 'llm_invalid_json' }, { status: 502 })
      }
    }
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'llm_not_array' }, { status: 502 })
    }

    // Crear sesión
    const { data: session, error: sErr } = await admin
      .from('seo_research_sessions')
      .insert({
        topic, market, channel,
        notes: body.notes ?? null,
        created_by: user.id,
      } as never)
      .select('*').single<SeoResearchSession>()
    if (sErr || !session) {
      console.error('[seo/research] session create failed:', sErr?.message)
      return NextResponse.json({ error: 'session_create_failed' }, { status: 500 })
    }

    // Normalizar e insertar keywords
    type LlmKw = {
      keyword?: unknown
      intent?: unknown
      estimated_volume?: unknown
      difficulty?: unknown
      suggested_format?: unknown
      notes?: unknown
    }
    const keywordRows: Omit<SeoKeyword, 'id' | 'created_at'>[] = []
    for (const item of parsed as LlmKw[]) {
      if (!item || typeof item !== 'object') continue
      const kw = typeof item.keyword === 'string' ? item.keyword.trim() : ''
      if (!kw || kw.length < 2 || kw.length > 200) continue

      const intent = typeof item.intent === 'string' && VALID_INTENTS.includes(item.intent as SeoIntent)
        ? item.intent as SeoIntent : null
      const vol = typeof item.estimated_volume === 'string' && VALID_LEVELS.includes(item.estimated_volume as SeoLevel)
        ? item.estimated_volume as SeoLevel : null
      const diff = typeof item.difficulty === 'string' && VALID_LEVELS.includes(item.difficulty as SeoLevel)
        ? item.difficulty as SeoLevel : null
      const fmt = typeof item.suggested_format === 'string' ? item.suggested_format.trim().slice(0, 50) : null
      const notes = typeof item.notes === 'string' ? item.notes.trim().slice(0, 500) : null

      keywordRows.push({
        research_session_id: session.id,
        keyword: kw,
        intent,
        estimated_volume: vol,
        difficulty: diff,
        suggested_format: fmt,
        notes,
      })
    }

    if (keywordRows.length === 0) {
      // Rollback de la sesión vacía
      try { await admin.from('seo_research_sessions').delete().eq('id', session.id) } catch {}
      return NextResponse.json({ error: 'no_valid_keywords' }, { status: 502 })
    }

    const { data: keywords, error: kErr } = await admin
      .from('seo_keywords').insert(keywordRows as never).select('*')
      .returns<SeoKeyword[]>()
    if (kErr) {
      try { await admin.from('seo_research_sessions').delete().eq('id', session.id) } catch {}
      console.error('[seo/research] keywords insert failed:', kErr.message)
      return NextResponse.json({ error: 'keywords_create_failed' }, { status: 500 })
    }

    return NextResponse.json({ session, keywords: keywords ?? [] })
  } catch (err: unknown) {
    console.error('[seo/research] error:', err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'research_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
