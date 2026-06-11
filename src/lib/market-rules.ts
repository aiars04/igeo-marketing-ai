/**
 * Helpers para market_rules:
 *  - buildMarketRulesPrompt(): construye un bloque de texto a inyectar
 *    en el system prompt de Gemini con las reglas operativas del mercado.
 *  - detectForbiddenTerms(): busca términos prohibidos en un copy generado
 *    y devuelve los matches (para clarity_summary).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Market, MarketRules, Channel } from '@/types/database'

interface KeywordRules {
  primary?:   string[]
  secondary?: string[]
  forbidden?: string[]
}

interface TerminologyRules {
  prefer?: Record<string, string>
}

interface CtaRules {
  default?: string
  [channel: string]: string | undefined
}

/**
 * Carga las reglas del mercado y devuelve un bloque de texto listo para
 * inyectar en el system prompt de Gemini. Devuelve '' si no hay reglas
 * configuradas (todos los campos vacíos).
 */
export async function buildMarketRulesPrompt(
  admin: SupabaseClient,
  market: Market,
  channel?: Channel,
): Promise<string> {
  const { data } = await admin
    .from('market_rules').select('*').eq('market', market)
    .maybeSingle<MarketRules>()
  if (!data) return ''

  const kw = (data.keyword_rules ?? {}) as KeywordRules
  const term = (data.terminology_rules ?? {}) as TerminologyRules
  const noSay = data.no_say_rules ?? []
  const cta = (data.cta_rules ?? {}) as CtaRules

  const sections: string[] = []

  if (kw.primary && kw.primary.length > 0) {
    sections.push(`KEYWORDS PRIMARIAS (úsalas cuando encajen naturalmente): ${kw.primary.join(', ')}`)
  }
  if (kw.secondary && kw.secondary.length > 0) {
    sections.push(`KEYWORDS SECUNDARIAS: ${kw.secondary.join(', ')}`)
  }
  if (kw.forbidden && kw.forbidden.length > 0) {
    sections.push(`KEYWORDS PROHIBIDAS (no las uses NUNCA): ${kw.forbidden.join(', ')}`)
  }

  const preferEntries = Object.entries(term.prefer ?? {})
  if (preferEntries.length > 0) {
    sections.push(
      `TERMINOLOGÍA OBLIGATORIA — usa el término de la derecha en vez del de la izquierda:\n`
      + preferEntries.map(([from, to]) => `  · "${from}" → "${to}"`).join('\n')
    )
  }

  if (noSay.length > 0) {
    sections.push(
      `NO DECIR NUNCA (legal/compliance — bloqueo absoluto):\n`
      + noSay.map(p => `  · "${p}"`).join('\n')
    )
  }

  // CTA: prioriza el del canal, si no el default
  const ctaForChannel = channel ? cta[channel] : undefined
  const ctaToUse = ctaForChannel ?? cta.default
  if (ctaToUse) {
    sections.push(`CTA RECOMENDADO PARA ESTE MERCADO${channel ? ` Y CANAL (${channel})` : ''}: "${ctaToUse}"`)
  }

  if (data.notes && data.notes.trim()) {
    sections.push(`NOTAS DEL MERCADO:\n${data.notes.trim()}`)
  }

  if (sections.length === 0) return ''

  return `\n\n════ REGLAS DE MERCADO (${market.toUpperCase()}) ════\n${sections.join('\n\n')}`
}

/**
 * Busca términos prohibidos en un copy generado.
 * Devuelve un array de matches encontrados (vacío si no hay).
 *
 * Detecta:
 *  - no_say_rules (frases prohibidas absolutas)
 *  - keyword_rules.forbidden (keywords vetadas)
 *
 * Búsqueda case-insensitive sobre el texto completo.
 */
export async function detectForbiddenTerms(
  admin: SupabaseClient,
  market: Market,
  text: string,
): Promise<string[]> {
  if (!text || text.trim() === '') return []

  const { data } = await admin
    .from('market_rules').select('no_say_rules, keyword_rules').eq('market', market)
    .maybeSingle<{
      no_say_rules: string[]
      keyword_rules: KeywordRules
    }>()
  if (!data) return []

  const matches: string[] = []
  const haystack = text.toLowerCase()

  for (const phrase of data.no_say_rules ?? []) {
    if (phrase && haystack.includes(phrase.toLowerCase())) {
      matches.push(phrase)
    }
  }
  for (const kw of data.keyword_rules?.forbidden ?? []) {
    if (kw && haystack.includes(kw.toLowerCase())) {
      matches.push(kw)
    }
  }

  return Array.from(new Set(matches))
}
