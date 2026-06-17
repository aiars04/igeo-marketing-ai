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

async function postizFetch<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: AUTH_HEADER,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Postiz API ${method} ${path} → ${res.status}: ${text}`)
  }

  // DELETE 204 no content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Devuelve los canales conectados en Postiz. */
export async function postizGetChannels(): Promise<PostizChannel[]> {
  return postizFetch<PostizChannel[]>('GET', '/integrations')
}

/** Devuelve los posts programados/publicados. */
export async function postizGetPosts(): Promise<{ posts: PostizPost[] }> {
  return postizFetch<{ posts: PostizPost[] }>('GET', '/posts')
}

/** Crea o programa un post en Postiz. */
export async function postizCreatePost(body: PostizCreatePostBody) {
  return postizFetch<unknown>('POST', '/posts', body)
}

/** Sube una imagen desde una URL pública y la registra en la librería de Postiz. */
export async function postizUploadFromUrl(url: string): Promise<PostizMediaItem> {
  return postizFetch<PostizMediaItem>('POST', '/upload-from-url', { url })
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
