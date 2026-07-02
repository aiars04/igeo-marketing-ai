import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt, detectForbiddenTerms } from '@/lib/market-rules'
import { buildFormatSpecPromptBlock } from '@/lib/content-type-format-spec'
import { matchTemplatesForItem } from '@/lib/creative-templates-match'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeUserInput, wrapUserInput, USER_INPUT_GUARD } from '@/lib/prompt-safety'
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

// Auto-router: canales cortos → Flash; canales largos → Pro.
// Email vive aquí en LONG aunque visualmente sea más corto que un blog: una
// pieza típica de email (asunto + preheader + cuerpo + CTA) supera holgadamente
// los 1500 tokens del cap antiguo (bug 29-jun: emails truncados a media frase).
const FAST_CHANNELS: Channel[] = ['linkedin', 'instagram', 'x', 'facebook']
const PRO_CHANNELS: Channel[]  = ['blog', 'newsletter', 'email']

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

  // Rate-limit: 10 generaciones por minuto por usuario. Cada llamada invoca
  // Gemini Pro/Flash + matching de plantillas (lectura BD) — costoso si un
  // user martillea regenerar.
  const rl = checkRateLimit(`ci-generate:${user.id}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', resetInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } },
    )
  }

  const { id } = await ctx.params

  // 2) Body opcional: regenerate flag (informa al LLM que pruebe un enfoque
  // distinto) y extraInstructions (brief libre del usuario para guiar la
  // regeneración: "más conciso", "incluye dato X", "tono más casual", etc.)
  let body: { regenerate?: boolean; extraInstructions?: string } = {}
  try { body = await req.json() } catch {}
  // Sanitizar instrucciones extra: trim + tope de 1000 chars para evitar que
  // un usuario meta un prompt gigante que rompa el contexto del modelo o
  // intente jailbreaks largos. 1000 chars es suficiente para un brief.
  const extraInstructions = typeof body.extraInstructions === 'string'
    ? body.extraInstructions.trim().slice(0, 1000)
    : ''

  // 3) Cargar item
  const { data: item, error: itemErr } = await admin
    .from('content_items').select('*').eq('id', id)
    .single<ContentItem>()
  if (itemErr || !item) return NextResponse.json({ error: 'item_not_found' }, { status: 404 })

  // 3b) Autorización: generar/regenerar SOBREESCRIBE el content del item, así
  // que aplicamos el mismo gate que el PATCH de /api/content-items/[id]:
  // solo el dueño (created_by) o admin/manager pueden hacerlo. Sin esto, un
  // user cualquiera podía pisar el copy de un item de otro.
  const isOwner = item.created_by === user.id
  const isPriv  = profile.role === 'admin' || profile.role === 'manager'
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 4) Buscar content_type del item.
  //    Prioridad:
  //      1) item.content_type_id (elegido explícitamente por el usuario,
  //         migración 026). Si existe Y está activo, ese.
  //      2) Fallback heurístico: el más reciente activo del canal
  //         (compat con items históricos sin la columna).
  //    Antes ignorábamos siempre item.content_type_id y usábamos el
  //    fallback, lo que metía el format_spec EQUIVOCADO en el prompt
  //    si el item era 'Carrusel IG' pero el último creado era 'Post IG'.
  let ct: ContentType | null = null
  if (item.content_type_id) {
    const { data: exact } = await admin
      .from('content_types')
      .select('*')
      .eq('id', item.content_type_id)
      .eq('active', true)
      .maybeSingle<ContentType>()
    ct = exact ?? null
  }
  if (!ct) {
    const { data: ctRows } = await admin
      .from('content_types')
      .select('*')
      .eq('channel', item.channel)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .returns<ContentType[]>()
    ct = ctRows?.[0] ?? null
  }

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

  // 4e) Plantillas visuales que acompañarán a este copy. NO descargamos
  // archivos — solo los metadatos llegan al prompt de Gemini para que adapte
  // tono, longitud y CTA al saber qué pieza visual irá al lado. Cualquier
  // fallo aquí degrada silenciosamente (sigue sin contexto visual).
  let creativeTemplatesSection = ''
  try {
    const { promptNotes } = await matchTemplatesForItem(admin, item.id, item.channel, { cap: 5 })
    if (promptNotes.length > 0) {
      creativeTemplatesSection = `\n\n════ PLANTILLAS VISUALES QUE ACOMPAÑARÁN A ESTE COPY ════
La pieza visual que se generará para este contenido seguirá el estilo de las siguientes plantillas maestras de marca. Ajusta el copy en consecuencia:
- Si las plantillas YA llevan título o headline visible, NO repitas ese título en el copy.
- Tono coherente con el lenguaje visual descrito (editorial/cálido vs corporativo/limpio).
- Si las notas mencionan logo o paleta concretos, evita describirlos en el copy (ya están en la imagen).

${promptNotes.map(n => `  · ${n}`).join('\n')}`
    }
  } catch (e) {
    console.warn('[content-items/generate] template match failed (no bloqueante):', e instanceof Error ? e.message : e)
  }

  // 5) Construir prompts. Sanitizamos todos los inputs de usuario y los
  //    envolvemos en bloques <user_input> para que el modelo no los interprete
  //    como instrucciones (defensa contra prompt injection).
  const safeTitle = sanitizeUserInput(item.title, { max: 300 })
  const safeDesc  = sanitizeUserInput(item.description, { max: 2000 })
  const safeCampaign = sanitizeUserInput(item.campaign, { max: 200 })
  const safeExtraInstr = sanitizeUserInput(extraInstructions, { max: 1000 })
  // Los campos de content_type (process, style, name) también vienen de
  // usuarios internos y podrían contener frases que parezcan instrucciones —
  // sanitizamos por consistencia.
  const safeCtName    = ct ? sanitizeUserInput(ct.name, { max: 200 })    : ''
  const safeCtProcess = ct ? sanitizeUserInput(ct.process, { max: 3000 }) : ''
  const safeCtStyle   = ct ? sanitizeUserInput(ct.style, { max: 3000 })   : ''

  const systemPrompt = ct
    ? `${SYSTEM_BASE}${brandSection}${marketRulesSection}${formatSpecSection}${creativeTemplatesSection}${USER_INPUT_GUARD}

════ INSTRUCCIONES ESPECÍFICAS PARA ESTE CONTENIDO (${safeCtName}) ════
PROCESO:
${wrapUserInput(safeCtProcess)}
ESTILO:
${wrapUserInput(safeCtStyle)}`
    : `${SYSTEM_BASE}${brandSection}${marketRulesSection}${creativeTemplatesSection}${USER_INPUT_GUARD}

(No hay content_type configurado para canal ${item.channel}. Usa criterio general de marketing B2B.)`

  const userPromptParts = [
    `Genera el copy final para esta pieza de contenido:`,
    `TÍTULO: ${wrapUserInput(safeTitle)}`,
    safeDesc ? `DESCRIPCIÓN/CONTEXTO: ${wrapUserInput(safeDesc)}` : null,
    `CANAL: ${item.channel}`,
    `MERCADO: ${item.market} (escribe en ${MARKET_LANG[item.market] ?? 'español'})`,
    safeCampaign ? `CAMPAÑA: ${wrapUserInput(safeCampaign)}` : null,
    body.regenerate ? '\nNota: es una regeneración, prueba un enfoque distinto al anterior.' : null,
    // Las instrucciones del usuario van AL FINAL y en bloque marcado, para
    // que el modelo las trate como override prioritario sobre el resto —
    // pero siguen envueltas en <user_input> (nunca son instrucciones al sistema).
    safeExtraInstr
      ? `\n════ INSTRUCCIONES ADICIONALES DEL USUARIO (prioridad alta) ════\n${wrapUserInput(safeExtraInstr)}`
      : null,
  ].filter(Boolean).join('\n')

  const modelUsed = modelForChannel(item.channel as Channel)

  // Cap de tokens: PRO_CHANNELS (blog/newsletter/email) siempre necesitan cap
  // alto. Pero el canal NO es el único factor — un content_type con
  // needs_script (guion de vídeo con "Visual:"/"Voz en off"...) o carousel
  // (N slides + caption feed) genera un output largo AUNQUE el canal sea
  // Instagram/LinkedIn (FAST). El cap fijo de 1500 para FAST truncaba guiones
  // a media frase incluso pidiendo explícitamente "completa el guion" en
  // extraInstructions (bug Ramon 2-jul).
  const needsLongOutput = ct?.format_spec?.needs_script || !!ct?.format_spec?.carousel
  const maxOutputTokens = PRO_CHANNELS.includes(item.channel as Channel) || needsLongOutput
    ? 8000
    : 1500

  try {
    // 6) Llamar Gemini
    const res = await genai.models.generateContent({
      model: modelUsed,
      contents: [{ role: 'user', parts: [{ text: userPromptParts }] }],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens,
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
