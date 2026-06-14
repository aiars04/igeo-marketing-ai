import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt, detectForbiddenTerms } from '@/lib/market-rules'
import { buildFormatSpecPromptBlock } from '@/lib/content-type-format-spec'
import type { ContentItem, ContentType, BrandContext, Profile, Channel, Market } from '@/types/database'

const MARKET_LANG: Record<Market, string> = {
  spain:    'español (España, voseo/tuteo neutro)',
  latam:    'español neutro (LATAM)',
  // `uk` reetiquetado a "Internacional"; usamos inglés como idioma neutro global.
  uk:       'inglés internacional (neutro, sin regionalismos)',
  france:   'francés',
  italy:    'italiano',
  portugal: 'portugués (Portugal)',
  brasil:   'portugués (Brasil)',
  mexico:   'español (México, voseo/tuteo neutro mexicano)',
}

// Auto-router: canales cortos → Flash; canales largos → Pro
const FAST_CHANNELS: Channel[] = ['linkedin', 'instagram', 'x', 'facebook', 'email']
const PRO_CHANNELS: Channel[]  = ['blog', 'newsletter']

function modelForChannel(channel: Channel): string {
  if (PRO_CHANNELS.includes(channel)) return 'gemini-2.5-pro'
  if (FAST_CHANNELS.includes(channel)) return 'gemini-2.5-flash'
  return 'gemini-2.5-flash'
}

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_BASE = `Eres un copywriter B2B senior para iGEO, ERP especializado en empresas de servicios técnicos de sanidad ambiental, control de plagas y Legionella.
Tu trabajo es escribir contenido final listo para publicar.

REGLAS GENERALES IGEO:
- Tono profesional pero cercano. Evita buzzwords vacíos.
- Datos concretos del sector cuando aplique.
- CTA claro al final si tiene sentido para el formato.
- Devuelve SOLO el copy final, sin meta-comentarios, sin "Aquí tienes…", sin explicaciones tuyas.
- Markdown si el canal lo admite (LinkedIn, Blog, Newsletter), formato plano + emojis si no.`

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // 1) Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  // 2) Body (opcional regenerate flag — no usado por backend, solo info)
  let body: { regenerate?: boolean } = {}
  try { body = await req.json() } catch {}

  // 3) Cargar item
  const { data: item, error: itemErr } = await admin
    .from('content_items').select('*').eq('id', id)
    .single<ContentItem>()
  if (itemErr || !item) return NextResponse.json({ error: 'item_not_found' }, { status: 404 })

  // 4) Buscar content_type del canal — el más reciente activo
  const { data: ctRows } = await admin
    .from('content_types')
    .select('*')
    .eq('channel', item.channel)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<ContentType[]>()
  const ct = ctRows?.[0] ?? null

  // 4b) Cargar brand_context: bloques relevantes para canal + mercado del item.
  // spain y latam comparten bloque; el resto tiene el suyo (market_<slug>).
  const MARKET_BLOCK: Record<Market, string> = {
    spain:    'market_spain_latam',
    latam:    'market_spain_latam',
    uk:       'market_uk',
    france:   'market_france',
    italy:    'market_italy',
    portugal: 'market_portugal',
    brasil:   'market_brasil',
    mexico:   'market_mexico',
  }
  const marketBlockKey: string | null = MARKET_BLOCK[item.market as Market] ?? null

  const channelBlockKey = `channel_${item.channel}` // channel_linkedin, channel_instagram, ...

  const wantedKeys: string[] = [
    'brand_identity',
    'tone_of_voice',
    'approved_claims',
    'no_decir',
    channelBlockKey,
    ...(marketBlockKey ? [marketBlockKey] : []),
  ]

  const { data: brandRows } = await admin
    .from('brand_context')
    .select('*')
    .in('key', wantedKeys)
    .in('market', ['all', item.market])
    .returns<BrandContext[]>()

  // Ordenar siguiendo el orden de `wantedKeys` (en vez de orden alfabético/BD)
  const brandBlocks = (brandRows ?? []).slice().sort((a, b) =>
    wantedKeys.indexOf(a.key) - wantedKeys.indexOf(b.key),
  )

  const brandSection = brandBlocks.length > 0
    ? `\n\n════ CONTEXTO DE MARCA iGEO ════\n${brandBlocks.map(b => b.content).join('\n\n')}`
    : ''

  // 4c) Cargar market_rules estructuradas (keywords, terminología, no-decir, CTA)
  const marketRulesSection = await buildMarketRulesPrompt(
    admin, item.market as Market, item.channel as Channel,
  )

  // 4d) Bloque de estructura del formato (assets esperados, tamaños sugeridos)
  const formatSpecSection = ct ? buildFormatSpecPromptBlock(ct.format_spec) : ''

  // 5) Construir prompts
  const systemPrompt = ct
    ? `${SYSTEM_BASE}${brandSection}${marketRulesSection}${formatSpecSection}

════ INSTRUCCIONES ESPECÍFICAS PARA ESTE CONTENIDO (${ct.name}) ════
PROCESO: ${ct.process}
ESTILO: ${ct.style}`
    : `${SYSTEM_BASE}${brandSection}${marketRulesSection}

(No hay content_type configurado para canal ${item.channel}. Usa criterio general de marketing B2B.)`

  const userPromptParts = [
    `Genera el copy final para esta pieza de contenido:`,
    `TÍTULO: ${item.title}`,
    item.description ? `DESCRIPCIÓN/CONTEXTO: ${item.description}` : null,
    `CANAL: ${item.channel}`,
    `MERCADO: ${item.market} (escribe en ${MARKET_LANG[item.market] ?? 'español'})`,
    item.campaign ? `CAMPAÑA: ${item.campaign}` : null,
    body.regenerate ? '\nNota: es una regeneración, prueba un enfoque distinto al anterior.' : null,
  ].filter(Boolean).join('\n')

  const modelUsed = modelForChannel(item.channel as Channel)

  try {
    // 6) Llamar Gemini
    const res = await genai.models.generateContent({
      model: modelUsed,
      contents: [{ role: 'user', parts: [{ text: userPromptParts }] }],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: PRO_CHANNELS.includes(item.channel as Channel) ? 4000 : 1500,
      },
    })

    const text = (res.text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'empty_llm_response' }, { status: 502 })

    // 6b) Validador post-generación: detectar términos prohibidos
    const forbiddenMatches = await detectForbiddenTerms(admin, item.market as Market, text)
    const clarityPass = forbiddenMatches.length === 0
    const claritySummary = clarityPass
      ? null
      : `Detectados términos prohibidos por reglas de mercado (${item.market}): ${forbiddenMatches.map(m => `"${m}"`).join(', ')}. Revisa antes de aprobar.`

    // 7) Guardar en el item
    const { data: updated, error: upErr } = await admin
      .from('content_items')
      .update({
        content: text,
        ai_generated: true,
        clarity_pass: clarityPass,
        clarity_summary: claritySummary,
      } as never)
      .eq('id', id)
      .select('*')
      .single<ContentItem>()
    if (upErr) {
      console.error('[content-items/generate] db update failed:', upErr.message)
      return NextResponse.json({ error: 'db_failed' }, { status: 500 })
    }

    return NextResponse.json({
      item: updated,
      meta: {
        model: modelUsed,
        content_type_id: ct?.id ?? null,
        content_type_name: ct?.name ?? null,
        forbidden_matches: forbiddenMatches,
      },
    })
  } catch (err: unknown) {
    console.error('[content-items/generate] error:', err instanceof Error ? err.message : err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'generation_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
