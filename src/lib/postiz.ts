/**
 * Cliente Postiz — iGEO Marketing AI
 * Base URL y API key vienen de variables de entorno (server-side únicamente).
 * Nunca exponer POSTIZ_API_KEY al cliente.
 *
 * Compatible con Postiz self-hosted y Postiz Web (cloud).
 *
 * Variables de entorno:
 *   POSTIZ_API_URL       Base URL de la API pública. Self-hosted típico:
 *                        http://localhost:4007/api/public/v1
 *                        Postiz Web cloud: comprobar en el dashboard
 *                        (suele ser https://api.postiz.com/public/v1).
 *   POSTIZ_API_KEY       Clave de la API generada en el dashboard.
 *   POSTIZ_AUTH_SCHEME   (opcional) 'bearer' para enviar
 *                        Authorization: Bearer <KEY>. Vacío o ausente envía
 *                        Authorization: <KEY> directo (formato actual usado
 *                        en self-hosted).
 */

const BASE_URL    = process.env.POSTIZ_API_URL ?? 'http://localhost:4007/api/public/v1'
const API_KEY     = process.env.POSTIZ_API_KEY ?? ''
const AUTH_SCHEME = (process.env.POSTIZ_AUTH_SCHEME ?? '').toLowerCase().trim()
const AUTH_HEADER = AUTH_SCHEME === 'bearer' ? `Bearer ${API_KEY}` : API_KEY

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface PostizChannel {
  id: string
  name: string
  identifier: string   // 'linkedin' | 'instagram' | 'facebook' | 'x' | etc.
  picture: string | null
  disabled: boolean
  profile: string | null
}

export interface PostizPostValue {
  content: string
  image?: Array<{ path: string; id?: string }>
}

export interface PostizPostInput {
  integration: { id: string }
  value: PostizPostValue[]
  settings?: Record<string, unknown>
}

export interface PostizCreatePostBody {
  type: 'schedule' | 'draft' | 'now'
  date?: string          // ISO — requerido si type = 'schedule'
  posts: PostizPostInput[]
  tags?: string[]
  shortLinks?: boolean
}

export interface PostizPost {
  id: string
  group: string
  state: string
  publishDate: string | null
  integration?: { id: string; name: string; providerIdentifier: string }
  content?: string
}

export interface PostizMediaItem {
  id: string
  name: string
  path: string
}

export interface PostizNotification {
  id:        string
  content:   string
  link:      string | null
  createdAt: string
}

export interface PostizNotificationsPage {
  notifications: PostizNotification[]
  total:         number
  page:          number
  limit:         number
  hasMore:       boolean
}

// ─── Helper interno ───────────────────────────────────────────────────────────

/** Espera asíncrona simple — usada por el backoff. */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Política de reintentos:
 *   - Reintentamos en errores de red y respuestas 5xx (también 429).
 *   - 2 reintentos con backoff exponencial 500ms → 1500ms.
 *   - NO reintentamos 4xx ≠ 429 (es petición mal hecha, no se va a curar).
 *   - GET es siempre idempotente. POST/PUT/DELETE de Postiz también lo son en
 *     la práctica (la API responde con error si ya existe), pero para
 *     reducir riesgo de duplicados solo reintentamos POST/PUT/DELETE si el
 *     fallo fue ANTES de respuesta (network error) o 5xx puro.
 */
async function postizFetch<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const MAX_ATTEMPTS = 3
  const BACKOFF_MS   = [500, 1500] // entre intentos 1→2 y 2→3
  let lastErr: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })

      // OK rápido
      if (res.ok) {
        if (res.status === 204) return undefined as T
        return await res.json() as T
      }

      // 4xx ≠ 429 → no reintentamos
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`Postiz API ${method} ${path} → ${res.status}: ${text}`)
      }

      // 5xx o 429 → marcamos error reintenable
      const text = await res.text().catch(() => res.statusText)
      lastErr = new Error(`Postiz API ${method} ${path} → ${res.status}: ${text}`)
    } catch (err) {
      // Errores de red, DNS, timeout, etc. — reintenables
      lastErr = err
    }
    // Backoff antes de siguiente intento (excepto en el último)
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS[attempt - 1])
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Postiz API: error desconocido')
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Devuelve los canales conectados en Postiz. */
export async function postizGetChannels(): Promise<PostizChannel[]> {
  return postizFetch<PostizChannel[]>('GET', '/integrations')
}

/**
 * Devuelve los posts en un rango de fechas. `startDate` y `endDate` son
 * OBLIGATORIOS en Postiz Web (en formato ISO UTC). Si no se pasan, usamos
 * un rango por defecto: últimos 90 días hasta dentro de 90 días en el
 * futuro (cubre lo recién publicado y lo programado).
 */
export async function postizGetPosts(opts?: { startDate?: string; endDate?: string }): Promise<{ posts: PostizPost[] }> {
  const now = Date.now()
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const startDate = opts?.startDate ?? new Date(now - NINETY_DAYS_MS).toISOString()
  const endDate   = opts?.endDate   ?? new Date(now + NINETY_DAYS_MS).toISOString()
  const qs = new URLSearchParams({ startDate, endDate }).toString()
  return postizFetch<{ posts: PostizPost[] }>('GET', `/posts?${qs}`)
}

/** Crea o programa un post en Postiz. */
export async function postizCreatePost(body: PostizCreatePostBody) {
  return postizFetch<unknown>('POST', '/posts', body)
}

/**
 * Cancela un post en Postiz. Si el post ya está publicado, Postiz
 * normalmente devuelve 400 o 404 (no se puede eliminar lo que ya está
 * en la red social). Para los borradores y programados, lo elimina.
 *
 * DELETE devuelve 204 en éxito; 404 = ya borrado (también éxito).
 */
export async function postizDeletePost(id: string): Promise<{ ok: boolean; alreadyGone: boolean }> {
  try {
    await postizFetch<void>('DELETE', `/posts/${encodeURIComponent(id)}`)
    return { ok: true, alreadyGone: false }
  } catch (err) {
    // 404 → ya estaba borrado, lo tratamos como éxito idempotente
    const msg = err instanceof Error ? err.message : String(err)
    if (/→\s*404/.test(msg)) return { ok: true, alreadyGone: true }
    throw err
  }
}

/** Sube una imagen desde una URL pública y la registra en la librería de Postiz. */
export async function postizUploadFromUrl(url: string): Promise<PostizMediaItem> {
  return postizFetch<PostizMediaItem>('POST', '/upload-from-url', { url })
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface PostizAnalyticsSeries {
  label:             string
  data:              Array<{ total: string; date: string }>
  percentageChange?: number
}

/**
 * Devuelve series temporales de métricas (followers, impresiones, etc.)
 * para una integración concreta y un rango de N días hacia atrás.
 *
 * Postiz devuelve un array — cada elemento es una serie con label + puntos.
 * El shape de `total` es string (no number) según la doc oficial.
 */
export async function postizGetAnalytics(integrationId: string, days = 30): Promise<PostizAnalyticsSeries[]> {
  const safeDays = Math.min(Math.max(1, Math.floor(Number(days) || 30)), 365)
  const qs = new URLSearchParams({ date: String(safeDays) }).toString()
  return postizFetch<PostizAnalyticsSeries[]>(
    'GET',
    `/analytics/${encodeURIComponent(integrationId)}?${qs}`,
  )
}

/**
 * Devuelve la página de notificaciones de la organización en Postiz.
 * Ej.: "Your post to X was published successfully" / "Failed to publish to LinkedIn".
 * Ordenadas por fecha descendente. page es 0-indexed.
 */
export async function postizGetNotifications(page = 0): Promise<PostizNotificationsPage> {
  const safePage = Math.max(0, Math.floor(Number(page) || 0))
  const qs = new URLSearchParams({ page: String(safePage) }).toString()
  return postizFetch<PostizNotificationsPage>('GET', `/notifications?${qs}`)
}

/** Comprueba si la API key tiene acceso (health-check ligero). */
export async function postizIsConnected(): Promise<boolean> {
  try {
    const res = await postizFetch<{ connected: boolean }>('GET', '/is-connected')
    return res.connected === true
  } catch {
    return false
  }
}

/**
 * Health-check con diagnóstico rico — pensado para el endpoint /api/postiz/status.
 * Devuelve el código HTTP y un mensaje sanitizado (sin volcar el body crudo del
 * upstream) para que la UI pueda mostrar info útil al admin sin filtrar tokens.
 */
export interface PostizConnectionDiagnostics {
  connected: boolean
  status?:   number          // HTTP code devuelto por Postiz si hubo respuesta
  reason?:   string          // motivo legible (sin secretos)
}

export async function postizCheckConnection(): Promise<PostizConnectionDiagnostics> {
  // 1) Pre-flight: si faltan env vars, no llegamos a tocar la red
  if (!API_KEY) {
    return { connected: false, reason: 'missing_api_key' }
  }
  if (!process.env.POSTIZ_API_URL) {
    return { connected: false, reason: 'missing_api_url' }
  }
  // 2) Llamada al endpoint público de Postiz
  try {
    const res = await fetch(`${BASE_URL}/is-connected`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: AUTH_HEADER,
      },
    })
    if (!res.ok) {
      // Heurística para diagnóstico: distinguimos auth fallida vs upstream caído
      const reason =
        res.status === 401 || res.status === 403 ? 'invalid_api_key'
        : res.status === 404                     ? 'endpoint_not_found'
        : res.status >= 500                       ? 'upstream_error'
        : `http_${res.status}`
      return { connected: false, status: res.status, reason }
    }
    const body = await res.json().catch(() => null) as { connected?: boolean } | null
    if (body?.connected === true) return { connected: true, status: res.status }
    return { connected: false, status: res.status, reason: 'unexpected_body' }
  } catch (err) {
    // Error de red, timeout, DNS, URL inválida, TLS, etc. No hay status code.
    const name = err instanceof Error ? err.name : 'Error'
    const msg  = err instanceof Error ? err.message : String(err)
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null
    // Log server-side para que aparezca en Vercel — el mensaje de fetch no
    // contiene la API key (solo URL y código de causa).
    console.error('[postiz] check connection failed', { name, msg, cause, baseUrl: BASE_URL })
    // Clasificamos por tipo de error sin filtrar contenido sensible.
    const lower = `${name} ${msg} ${cause ?? ''}`.toLowerCase()
    const reason =
      lower.includes('invalid url') || lower.includes('failed to parse url') ? 'invalid_api_url'
      : lower.includes('enotfound') || lower.includes('dns')                  ? 'dns_not_resolved'
      : lower.includes('econnrefused')                                         ? 'connection_refused'
      : lower.includes('certificate') || lower.includes('self-signed') || lower.includes('tls')
                                                                              ? 'tls_error'
      : lower.includes('timeout') || lower.includes('etimedout')               ? 'timeout'
      : lower.includes('fetch failed') || lower.includes('fetch')              ? 'network_error'
      : `error_${name.toLowerCase()}`
    return { connected: false, reason }
  }
}
