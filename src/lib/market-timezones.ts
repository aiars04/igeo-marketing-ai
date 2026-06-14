/**
 * Timezones por mercado — sirve para que al programar un post en, p.ej.,
 * mercado España, "09:00" signifique 9 AM hora de Madrid (no del navegador).
 *
 * Para LATAM (que abarca múltiples países y husos), elegimos un TZ "ancla"
 * configurable. Default: America/Bogota — coincide con la zona horaria del
 * caso de uso del cliente. Si se cambia, los `scheduled_at` ya guardados no
 * se recalculan (el almacenamiento sigue siendo UTC).
 */

import type { Market } from '@/types/database'

export const MARKET_TIMEZONE: Record<Market, string> = {
  spain:    'Europe/Madrid',
  latam:    'America/Bogota',
  // 'uk' se reetiqueta visualmente como "Internacional"; mantenemos el TZ
  // anclado a UTC para tratarlo como referencia neutra global.
  uk:       'UTC',
  france:   'Europe/Paris',
  italy:    'Europe/Rome',
  portugal: 'Europe/Lisbon',
  brasil:   'America/Sao_Paulo',
  mexico:   'America/Mexico_City',
}

export const MARKET_TZ_LABEL: Record<Market, string> = {
  spain:    'Madrid',
  latam:    'Bogotá',
  uk:       'UTC',
  france:   'París',
  italy:    'Roma',
  portugal: 'Lisboa',
  brasil:   'São Paulo',
  mexico:   'Ciudad de México',
}

export function getMarketTimezone(market: Market | string | null | undefined): string {
  if (market && (market as Market) in MARKET_TIMEZONE) {
    return MARKET_TIMEZONE[market as Market]
  }
  return 'UTC'
}

/**
 * Para un instante UTC dado, devuelve cuántos ms hay que sumar/restar para
 * convertirlo a wall-clock del TZ pedido. Usa Intl.DateTimeFormat para
 * resolver DST correctamente.
 */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - utcMs
}

/**
 * Convierte un valor de <input type="datetime-local"> (string "YYYY-MM-DDTHH:mm")
 * interpretado como HORA LOCAL DEL MERCADO a un ISO UTC para persistir.
 *
 * Robusto frente a DST: calcula el offset que ese mismo TZ tendría para el
 * instante objetivo.
 */
export function marketLocalToUtcISO(local: string, market: Market | string | null | undefined): string | null {
  if (!local) return null
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const y  = Number(m[1])
  const mo = Number(m[2])
  const d  = Number(m[3])
  const h  = Number(m[4])
  const mi = Number(m[5])
  const s  = Number(m[6] ?? 0)
  const tz = getMarketTimezone(market)
  // Primer intento: tratar (y,mo,d,h,mi,s) como si ya fueran UTC
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  // Corrección iterativa por DST: el offset puede cambiar después del ajuste
  // si el primer ajuste cae justo en el cambio de hora. Dos pasadas bastan.
  const offset = tzOffsetMs(naiveUtc, tz)
  let candidate = naiveUtc - offset
  const offset2 = tzOffsetMs(candidate, tz)
  if (offset2 !== offset) {
    candidate = naiveUtc - offset2
  }
  return new Date(candidate).toISOString()
}

/**
 * Convierte un ISO UTC a un valor "YYYY-MM-DDTHH:mm" en wall-clock del TZ
 * del mercado, listo para meter en <input type="datetime-local">.
 */
export function utcISOToMarketLocal(iso: string | null | undefined, market: Market | string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const tz = getMarketTimezone(market)
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/**
 * Para mostrar al usuario "el post saldrá tal hora en Madrid" y, si su navegador
 * está en otro TZ, también qué hora es para él.
 */
export function formatInTimezone(iso: string | null | undefined, tz: string, locale = 'es-ES'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}
