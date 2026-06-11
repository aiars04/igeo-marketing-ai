import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt } from '@/lib/market-rules'
import type { Idea, Profile, Channel, Market } from '@/types/database'

const ALLOWED_COUNT = [3, 5, 10] as const
const VALID_CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const VALID_MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil']

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un experto en marketing de contenido B2B para iGEO, un ERP especializado en empresas de servicios técnicos de sanidad ambiental, control de plagas y Legionella.
Genera ideas de contenido concretas, accionables y originales para redes sociales profesionales.
Tono: profesional pero cercano. Evitar buzzwords genéricos.
Devuelve SOLO un array JSON válido con este formato exacto, sin texto adicional, sin markdown, sin code fences:
[{"title": "...", "description": "...", "channel": "linkedin|instagram|newsletter|blog|x|facebook", "market": "spain|uk|latam|france|portugal"}]`

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

export async function POST(req: NextRequest) {
  // 1) Auth
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

  // 2) Validar body
  let body: { count?: number; channels?: string[]; market?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const count = (ALLOWED_COUNT as readonly number[]).includes(body.count ?? -1) ? body.count! : 3
  const requestedChannels = Array.isArray(body.channels)
    ? body.channels.filter((c): c is Channel => VALID_CHANNELS.includes(c as Channel))
    : []
  const market = (VALID_MARKETS.includes(body.market as Market) ? body.market : 'spain') as Market

  // 3) Construir user prompt con contexto
  const userPromptParts = [
    `Genera ${count} ideas de contenido distintas y originales.`,
    `Mercado objetivo: ${market}.`,
  ]
  if (requestedChannels.length > 0) {
    userPromptParts.push(`Canales objetivo (reparte entre ellos): ${requestedChannels.join(', ')}.`)
  } else {
    userPromptParts.push('Reparte entre canales relevantes: linkedin, instagram, blog, newsletter.')
  }

  // Inyectar market_rules en el system prompt
  const marketRulesSection = await buildMarketRulesPrompt(admin, market)
  const systemWithRules = SYSTEM_PROMPT + marketRulesSection

  try {
    // 4) Llamar Gemini 2.5 Flash
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPromptParts.join('\n') }] }],
      config: {
        systemInstruction: systemWithRules,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    })

    const raw = res.text?.trim() ?? ''
    if (!raw) return NextResponse.json({ error: 'empty_llm_response' }, { status: 502 })

    // 5) Parse JSON robusto (con fallback a strip de code fences)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      try {
        parsed = JSON.parse(stripCodeFences(raw))
      } catch {
        console.error('LLM returned unparseable JSON:', raw.slice(0, 500))
        return NextResponse.json({ error: 'llm_invalid_json' }, { status: 502 })
      }
    }
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'llm_not_array' }, { status: 502 })
    }

    // 6) Validar y normalizar cada idea
    const validRows: Array<{
      title: string
      description: string | null
      channel: Channel | null
      market: Market
      source: 'ai'
      status: 'pending'
      created_by: string
    }> = []

    for (const it of parsed) {
      if (!it || typeof it !== 'object') continue
      const rec = it as Record<string, unknown>
      const title = typeof rec.title === 'string' ? rec.title.trim() : null
      if (!title || title.length < 5) continue

      const ch = typeof rec.channel === 'string' ? rec.channel.toLowerCase() : ''
      const channel = (VALID_CHANNELS.includes(ch as Channel) ? ch : null) as Channel | null

      const mk = typeof rec.market === 'string' ? rec.market.toLowerCase() : market
      const itemMarket = (VALID_MARKETS.includes(mk as Market) ? mk : market) as Market

      validRows.push({
        title,
        description: typeof rec.description === 'string' ? rec.description.trim() : null,
        channel,
        market: itemMarket,
        source: 'ai',
        status: 'pending',
        created_by: user.id,
      })
    }

    if (validRows.length === 0) {
      // No devolvemos `raw` al cliente — puede filtrar prompts internos o system instructions del LLM
      console.error('[ideas/suggest] no valid ideas in response, raw:', raw.slice(0, 400))
      return NextResponse.json({ error: 'no_valid_ideas_in_response' }, { status: 502 })
    }

    // 7) Insertar todas en BD
    const { data: inserted, error: dbErr } = await admin
      .from('ideas')
      .insert(validRows as never)
      .select('*')
      .returns<Idea[]>()
    if (dbErr) {
      console.error('[ideas/suggest] insert failed:', dbErr.message)
      return NextResponse.json({ error: 'db_failed' }, { status: 500 })
    }

    return NextResponse.json({ ideas: inserted ?? [] })
  } catch (err: unknown) {
    console.error('[ideas/suggest]', err instanceof Error ? err.message : err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'suggest_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
