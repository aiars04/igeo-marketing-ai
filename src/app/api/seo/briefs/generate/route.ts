import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt } from '@/lib/market-rules'
import type {
  Profile, Market, Channel,
  SeoBrief, SeoIntent,
} from '@/types/database'

const MARKETS: Market[] = ['spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil']
const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']
const VALID_INTENTS: SeoIntent[] = ['informational', 'commercial', 'transactional', 'navigational']

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un estratega SEO senior para iGEO (ERP B2B de sanidad ambiental, control de plagas y Legionella).

Cuando recibas un keyword principal + parámetros de mercado/canal, genera un BRIEF SEO completo y accionable que un copywriter pueda ejecutar directamente.

Devuelve SOLO un objeto JSON válido con esta estructura exacta:
{
  "title": "Título sugerido del artículo (con keyword principal, atractivo, < 70 caracteres)",
  "intent": "informational|commercial|transactional|navigational",
  "target_length": número de palabras objetivo (entre 600 y 2500 según canal),
  "suggested_h2": ["H2 sugerido 1", "H2 sugerido 2", "H2 sugerido 3", ...],
  "cta": "Texto del CTA final (acción concreta)",
  "content_outline": "Outline en markdown detallado: cada H2 con 2-3 bullets de qué cubrir, ideas para abrir y cerrar, datos/casos a incluir. Usa markdown."
}

Reglas:
- target_length proporcional al canal: blog 1200-2000, newsletter 600-900, landing 800-1200
- suggested_h2: mínimo 4, máximo 8 secciones
- content_outline debe ser práctico y específico al sector (no genérico)
- Sin code fences ni texto fuera del JSON`

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

/**
 * POST /api/seo/briefs/generate
 *
 * Body: {
 *   primary_keyword: string,
 *   secondary_keywords?: string[],
 *   market?: Market,
 *   channel?: Channel,
 *   research_session_id?: string,
 * }
 *
 * Genera el brief con Gemini y lo guarda con status='draft'.
 * Retorna el brief creado.
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

  let body: {
    primary_keyword?: string
    secondary_keywords?: string[]
    market?: Market
    channel?: Channel
    research_session_id?: string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const primaryKw = (body.primary_keyword ?? '').trim()
  if (!primaryKw) return NextResponse.json({ error: 'primary_keyword_required' }, { status: 400 })
  if (primaryKw.length > 200) return NextResponse.json({ error: 'keyword_too_long' }, { status: 400 })

  const market: Market = (body.market && MARKETS.includes(body.market)) ? body.market : 'spain'
  const channel: Channel | null = body.channel && CHANNELS.includes(body.channel) ? body.channel : null
  const secondaryKws = Array.isArray(body.secondary_keywords)
    ? body.secondary_keywords.map(k => String(k).trim()).filter(Boolean).slice(0, 20)
    : []

  // Inyectar market_rules
  const marketRulesSection = await buildMarketRulesPrompt(admin, market, channel ?? undefined)
  const systemWithRules = SYSTEM_PROMPT + marketRulesSection

  const userPrompt = [
    `Genera un brief SEO completo.`,
    `Keyword principal: ${primaryKw}`,
    secondaryKws.length > 0 ? `Keywords secundarias: ${secondaryKws.join(', ')}` : null,
    `Mercado: ${market}`,
    channel ? `Canal: ${channel}` : `Canal: blog (por defecto)`,
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

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw)
    } catch {
      try { parsed = JSON.parse(stripCodeFences(raw)) }
      catch {
        console.error('[seo/briefs/generate] unparseable JSON:', raw.slice(0, 400))
        return NextResponse.json({ error: 'llm_invalid_json' }, { status: 502 })
      }
    }

    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 200) : primaryKw
    const intent: SeoIntent | null = typeof parsed.intent === 'string' && VALID_INTENTS.includes(parsed.intent as SeoIntent)
      ? parsed.intent as SeoIntent : null
    const targetLength = typeof parsed.target_length === 'number'
      ? Math.max(200, Math.min(5000, Math.floor(parsed.target_length))) : null
    const suggestedH2 = Array.isArray(parsed.suggested_h2)
      ? parsed.suggested_h2.map(x => String(x).trim()).filter(Boolean).slice(0, 12)
      : []
    const cta = typeof parsed.cta === 'string' ? parsed.cta.trim().slice(0, 500) : null
    const outline = typeof parsed.content_outline === 'string' ? parsed.content_outline : null

    const { data: brief, error: bErr } = await admin
      .from('seo_briefs').insert({
        title,
        primary_keyword: primaryKw,
        secondary_keywords: secondaryKws,
        market,
        channel,
        intent,
        target_length: targetLength,
        suggested_h2: suggestedH2,
        cta,
        content_outline: outline,
        research_session_id: body.research_session_id ?? null,
        related_content_item_id: null,
        status: 'draft',
        created_by: user.id,
      } as never)
      .select('*').single<SeoBrief>()
    if (bErr) {
      console.error('[seo/briefs/generate] insert failed:', bErr.message)
      return NextResponse.json({ error: 'brief_create_failed' }, { status: 500 })
    }

    return NextResponse.json(brief)
  } catch (err: unknown) {
    console.error('[seo/briefs/generate] error:', err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'brief_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
