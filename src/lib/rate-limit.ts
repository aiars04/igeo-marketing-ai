/**
 * Rate-limiter in-memory por (clave, ventana deslizante).
 *
 * Limitación conocida del entorno serverless de Vercel: cada instancia
 * tiene su propio Map. Esto NO da garantías estrictas, solo "best-effort"
 * para limitar ráfagas dentro de la misma instancia. Para un límite
 * global de verdad haría falta Redis/Upstash — overkill para una app
 * interna con N usuarios humanos.
 *
 * Aun así protege contra el caso más probable: usuario que hace clic
 * frenéticamente o un script propio que lanza ráfagas.
 */

const buckets = new Map<string, number[]>()

interface RateLimitResult {
  ok:           boolean
  remaining:    number
  resetInMs:    number   // ms hasta que el siguiente request entra
}

/**
 * Comprueba si la clave puede hacer otra acción.
 *
 * @param key       identificador único (user.id, ip, etc.)
 * @param limit     máximo de acciones permitidas en la ventana
 * @param windowMs  tamaño de la ventana en milisegundos
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs

  let timestamps = buckets.get(key) ?? []
  // Limpia eventos fuera de ventana
  timestamps = timestamps.filter(t => t > cutoff)

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0]
    const resetInMs = Math.max(0, oldestInWindow + windowMs - now)
    buckets.set(key, timestamps)
    return { ok: false, remaining: 0, resetInMs }
  }

  timestamps.push(now)
  buckets.set(key, timestamps)
  return {
    ok: true,
    remaining: limit - timestamps.length,
    resetInMs: 0,
  }
}

/**
 * Limpieza periódica del Map para evitar fuga de memoria si hay muchas
 * keys distintas (poco probable en una app con N users).
 * Se ejecuta lazy: cada call hace 1/100 probabilidad de limpiar todo.
 */
export function maybeCleanupRateLimits(maxAgeMs = 60 * 60 * 1000) {
  if (Math.random() > 0.01) return
  const cutoff = Date.now() - maxAgeMs
  for (const [key, ts] of buckets.entries()) {
    const fresh = ts.filter(t => t > cutoff)
    if (fresh.length === 0) buckets.delete(key)
    else buckets.set(key, fresh)
  }
}
