import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildMarketRulesPrompt, detectForbiddenTerms } from '@/lib/market-rules'
import { buildFormatSpecPromptBlock } from '@/lib/content-type-format-spec'
import { matchTemplatesForItem } from '@/lib/creative-templates-match'
import { checkRateLimit, maybeCleanupRateLimits } from '@/lib/rate-limit'
import { ALL_MARKETS } from '@/lib/utils'
import type { ContentItem, ContentType, BrandContext, Profile, Channel, Market, Stage } from '@/types/database'

/**
 * POST /api/content-items/:id/replicate
 *
 * Crea N copias del item original, una por cada mercado destino, y genera
 * el copy adaptado al idioma + reglas de cada mercado usando Gemini.
 *
 * Body: { target_markets: Market[] }
 *
 * - El mercado del item original se EXCLUYE automáticamente (no se replica
 *   sobre sí mismo).
 * - Cada réplica se crea con stage='ideas', ai_generated=true, content_type_id
 *   y channel del original. NO copia postiz_id, published_at, calendar_item_id,
 *   ni package_id (esos son específicos del item original).
 * - El copy se ADAPTA, no se traduce literal: las market_rules y brand_context
 *   del mercado destino influyen en tono, terminología, CTAs.
 * - Devuelve cada mercado con su estado: { market, ok, item?, error? }.
 *
 * Auth: usuario activo con rol admin/manager (regenerar masivamente puede ser
 * costoso y modifica content_items del equipo).
 */

const MARKET_LANG: Record<Market, string> = {
  spain:    'español (España, voseo/tuteo neutro)',
  latam:    'español neutro (LATAM)',
  uk:       'inglés internacional (neutro, sin regionalismos)',
  france:   'francés',
  italy:    'italiano',
  portugal: 'portugués (Portugal)',
  brasil:   'portugués (Brasil)',
  mexico:   'español (México, voseo/tuteo neutro mexicano)',
}

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

const FAST_CHANNELS: Channel[] = ['linkedin', 'instagram', 'x', 'facebook', 'email']
const PRO_CHANNELS:  Channel[] = ['blog', 'newsletter']

function modelForChannel(channel: Channel): string {
  if (PRO_CHANNELS.includes(channel))  return 'gemini-2.5-pro'
  if (FAST_CHANNELS.includes(channel)) return 'gemini-2.5-flash'
  return 'gemini-2.5-flash'
}

const SYSTEM_BASE = `Eres un copywriter B2B senior para iGEO, ERP especializado en empresas de servicios técnicos de sanidad ambiental, control de plagas y Legionella.
Tu trabajo es ADAPTAR copy existente a un nuevo mercado/idioma.

REGLAS GENERALES iGEO:
- Tono profesional pero cercano. Evita buzzwords vacíos.
- Datos concretos del sector cuando aplique.
- CTA claro al final si tiene sentido para el formato.
- Devuelve SOLO el copy final adaptado, sin meta-comentarios, sin "Aquí tienes…", sin explicaciones tuyas.

REGLAS DE ADAPTACIÓN:
- NO traduzcas literalmente. Adapta tono, ejemplos, expresiones y CTAs al contexto local del mercado destino.
- Mantén la INTENCIÓN, el ÁNGULO y la ESTRUCTURA del original (si era carrusel, sigue siendo carrusel; si tenía caption + slides, mantén ese formato).
- Respeta TODAS las reglas del mercado destino (especialmente términos prohibidos y terminología local).
- El producto y la empresa (iGEO) son los mismos. NO cambies datos del producto.
- Si el original tiene formato estructurado (═══ SLIDE 1 ═══ etc.), mantén EXACTAMENTE el mismo formato en la adaptación.`

export const runtime = 'nodejs'
// El plan Hobby de Vercel topa en 60s — declarar 180 no lo eleva. Cada
// llamada a Gemini tarda ~5-15s, así que replicar a >4 mercados puede
// acercarse al límite; si fuera un problema recurrente, trocear en lotes.
export const maxDuration = 60

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
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Rate-limit (best-effort): replicar dispara N llamadas a Gemini. Frena
  // bucles/dobles clicks que multiplicarían el coste.
  maybeCleanupRateLimits()
  const rl = checkRateLimit(`ai-replicate:${user.id}`, 5, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } },
    )
  }

  const { id } = await ctx.params

  // 2) Body
  let body: { target_markets?: unknown } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  if (!Array.isArray(body.target_markets) || body.target_markets.length === 0) {
    return NextResponse.json({ error: 'target_markets_required' }, { status: 400 })
  }
  // Filtrar y validar
  const requested = body.target_markets.filter(
    (m): m is Market => typeof m === 'string' && ALL_MARKETS.includes(m as Market),
  )
  if (requested.length === 0) {
    return NextResponse.json({ error: 'no_valid_markets' }, { status: 400 })
  }

  // 3) Cargar item fuente
  const { data: source, error: itemErr } = await admin
    .from('content_items').select('*').eq('id', id)
    .single<ContentItem>()
  if (itemErr || !source) return NextResponse.json({ error: 'item_not_found' }, { status: 404 })

  if (!source.content?.trim()) {
    return NextResponse.json({ error: 'source_has_no_content' }, { status: 400 })
  }

  // Excluir el mercado del propio item de la lista (no tiene sentido replicar
  // sobre el mismo mercado). Dedupe.
  const targets = Array.from(new Set(requested)).filter(m => m !== source.market)
  if (targets.length === 0) {
    return NextResponse.json({ error: 'all_targets_match_source_market' }, { status: 400 })
  }

  // Dedup: ¿ya existe una réplica de ESTE origen para alguno de los mercados
  // pedidos? (migración 027 garantiza unicidad por (replicated_from, market)).
  // Los que ya existen se saltan y se reportan como 'already_exists' en vez de
  // crear duplicados.
  const { data: existingReplicas } = await admin
    .from('content_items')
    .select('market')
    .eq('replicated_from', source.id)
    .in('market', targets)
    .returns<Array<{ market: Market }>>()
  const alreadyReplicated = new Set((existingReplicas ?? []).map(r => r.market))

  // 4) Cargar content_type (mismo orden de prioridad que el endpoint /generate):
  //    1) item.content_type_id si está activo
  //    2) fallback al más reciente activo del canal
  let ct: ContentType | null = null
  if (source.content_type_id) {
    const { data: exact } = await admin
      .from('content_types').select('*')
      .eq('id', source.content_type_id).eq('active', true)
      .maybeSingle<ContentType>()
    ct = exact ?? null
  }
  if (!ct) {
    const { data: ctRows } = await admin
      .from('content_types').select('*')
      .eq('channel', source.channel).eq('active', true)
      .order('created_at', { ascending: false }).limit(1)
      .returns<ContentType[]>()
    ct = ctRows?.[0] ?? null
  }

  const modelUsed = modelForChannel(source.channel as Channel)

  // 5) Procesar cada mercado destino en SERIE (evita ráfagas a Gemini que
  //    podrían dar 429). Cada uno tiene su propio resultado.
  const results: Array<{
    market: Market
    ok:     boolean
    item?:  ContentItem
    error?: string
  }> = []

  for (const target of targets) {
    // Saltar mercados que ya tienen réplica de este origen (no duplicar).
    if (alreadyReplicated.has(target)) {
      results.push({ market: target, ok: false, error: 'already_exists' })
      continue
    }
    try {
      // 5a) Cargar brand_context específico del nuevo mercado
      const channelBlockKey = `channel_${source.channel}`
      const marketBlockKey  = MARKET_BLOCK[target]
      const wantedKeys = [
        'brand_identity', 'tone_of_voice', 'approved_claims', 'no_decir',
        channelBlockKey, marketBlockKey,
      ]
      const { data: brandRows } = await admin
        .from('brand_context').select('*')
        .in('key', wantedKeys)
        .in('market', ['all', target])
        .returns<BrandContext[]>()
      const brandBlocks = (brandRows ?? []).slice().sort((a, b) =>
        wantedKeys.indexOf(a.key) - wantedKeys.indexOf(b.key),
      )
      const brandSection = brandBlocks.length > 0
        ? `\n\n════ CONTEXTO DE MARCA iGEO ════\n${brandBlocks.map(b => b.content).join('\n\n')}`
        : ''

      // 5b) Reglas del mercado destino (terminología, no-decir, CTA)
      const marketRulesSection = await buildMarketRulesPrompt(
        admin, target, source.channel as Channel,
      )

      // 5c) Format spec si aplica (el formato no cambia entre mercados)
      const formatSpecSection = ct ? buildFormatSpecPromptBlock(ct.format_spec) : ''

      // 5d) Plantillas visuales — mismas que el original (helper toma item.id)
      let creativeTemplatesSection = ''
      try {
        const { promptNotes } = await matchTemplatesForItem(admin, source.id, source.channel, { cap: 5 })
        if (promptNotes.length > 0) {
          creativeTemplatesSection = `\n\n════ PLANTILLAS VISUALES QUE ACOMPAÑARÁN A ESTE COPY ════
${promptNotes.map(n => `  · ${n}`).join('\n')}`
        }
      } catch { /* no bloqueante */ }

      // 5e) Construir prompt
      const systemPrompt = ct
        ? `${SYSTEM_BASE}${brandSection}${marketRulesSection}${formatSpecSection}${creativeTemplatesSection}

════ INSTRUCCIONES ESPECÍFICAS PARA ESTE CONTENIDO (${ct.name}) ════
PROCESO: ${ct.process}
ESTILO: ${ct.style}`
        : `${SYSTEM_BASE}${brandSection}${marketRulesSection}${creativeTemplatesSection}

(No hay content_type configurado para canal ${source.channel}. Usa criterio general.)`

      const userPrompt = [
        `Adapta el siguiente copy del mercado ${source.market} al mercado ${target}.`,
        `Idioma destino: ${MARKET_LANG[target]}.`,
        `Canal: ${source.channel}.`,
        source.campaign ? `Campaña: ${source.campaign}` : null,
        source.description ? `Descripción/contexto: ${source.description}` : null,
        ``,
        `════ COPY ORIGINAL (${source.market}) ════`,
        source.content,
        ``,
        `════ TU TAREA ════`,
        `Devuelve SOLO el copy adaptado al mercado ${target}, sin explicaciones.`,
        `Mantén EXACTAMENTE el mismo formato que el original (si tiene SLIDE/CAPTION FEED, replícalo).`,
      ].filter(Boolean).join('\n')

      // 5f) Llamar Gemini
      const res = await genai.models.generateContent({
        model: modelUsed,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: PRO_CHANNELS.includes(source.channel as Channel) ? 4000 : 1500,
        },
      })
      const adaptedText = (res.text ?? '').trim()
      if (!adaptedText) {
        results.push({ market: target, ok: false, error: 'empty_llm_response' })
        continue
      }

      // 5g) Validar términos prohibidos del mercado destino
      const forbiddenMatches = await detectForbiddenTerms(admin, target, adaptedText)
      const clarityPass = forbiddenMatches.length === 0
      const claritySummary = clarityPass
        ? null
        : `Detectados términos prohibidos por reglas de mercado (${target}): ${forbiddenMatches.map(m => `"${m}"`).join(', ')}.`

      // 5h) Insertar el nuevo content_item (clon adaptado)
      const insertRow = {
        title:           source.title,    // mismo título — el usuario puede editarlo después
        channel:         source.channel,
        stage:           'ideas' as Stage,
        market:          target,
        status:          'pending',
        campaign:        source.campaign,
        content:         adaptedText,
        description:     source.description,
        ai_generated:    true,
        clarity_pass:    clarityPass,
        clarity_summary: claritySummary,
        human_approved:  false,
        approved_by:     null,
        approved_at:     null,
        scheduled_at:    null,
        published_at:    null,
        postiz_id:       null,
        // Limpio para que el cron Postiz no toque nada de la réplica
        publish_state:     null,
        publish_error:     null,
        publish_synced_at: null,
        // Mantenemos calendar_item_id null porque la réplica no es el evento original
        calendar_item_id: null,
        content_type_id:  source.content_type_id,
        // Trazabilidad/dedup: esta réplica viene de `source.id`.
        replicated_from:  source.id,
        // package_id y playbook_step_id no se replican — son específicos del original
        package_id:       null,
        playbook_step_id: null,
        created_by:       user.id,
      }
      const { data: inserted, error: insErr } = await admin
        .from('content_items').insert(insertRow as never)
        .select('*').single<ContentItem>()
      if (insErr || !inserted) {
        // Violación del índice único (replicated_from, market) → otra petición
        // concurrente ya creó la réplica. Lo tratamos como 'already_exists'.
        const dup = (insErr?.message ?? '').toLowerCase().includes('duplicate')
          || insErr?.code === '23505'
        results.push({ market: target, ok: false, error: dup ? 'already_exists' : (insErr?.message ?? 'db_insert_failed') })
        continue
      }
      results.push({ market: target, ok: true, item: inserted })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[content-items/${id}/replicate] market=${target} failed:`, msg)
      const lower = msg.toLowerCase()
      const code = lower.includes('quota') || lower.includes('exhausted') || lower.includes('unavailable')
        ? 'models_unavailable'
        : 'replicate_failed'
      results.push({ market: target, ok: false, error: code })
    }
  }

  const ok = results.filter(r => r.ok).length
  return NextResponse.json({
    ok: ok > 0,
    total:  results.length,
    successful: ok,
    failed: results.length - ok,
    results,
    meta: { model: modelUsed, content_type_id: ct?.id ?? null },
  })
}
