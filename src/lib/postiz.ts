/**
 * Cliente Postiz — iGEO Marketing AI
 * Base URL y API key vienen de variables de entorno (server-side únicamente).
 * Nunca exponer POSTIZ_API_KEY al cliente.
 */

const BASE_URL = process.env.POSTIZ_API_URL ?? 'http://localhost:4007/api/public/v1'
const API_KEY  = process.env.POSTIZ_API_KEY ?? ''

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
      Authorization: API_KEY,
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

/** Comprueba si la API key tiene acceso (health-check ligero). */
export async function postizIsConnected(): Promise<boolean> {
  try {
    const res = await postizFetch<{ connected: boolean }>('GET', '/is-connected')
    return res.connected === true
  } catch {
    return false
  }
}
