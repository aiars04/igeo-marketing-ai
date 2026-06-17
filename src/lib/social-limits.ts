/**
 * Límites de caracteres por red social — usados para mostrar contadores
 * en el modal de publicación y avisar al usuario antes de que Postiz/la
 * red rechacen el post.
 *
 * Los `identifier` de Postiz son strings tipo 'x', 'linkedin', 'instagram',
 * 'facebook', etc. Mantenemos un default razonable (3000) para redes que
 * no conocemos — no es bloqueante, solo informativo.
 *
 * Fuentes (a 2024-2025):
 *   - X (Twitter): 280 plan free / 25k Premium — usamos 280 conservador.
 *   - Threads: 500
 *   - Bluesky: 300
 *   - Mastodon: 500 default
 *   - LinkedIn: 3000 post
 *   - Instagram: 2200 caption
 *   - Facebook: 63206 (efectivo no truncado)
 *   - TikTok: 2200 (descripción)
 *   - YouTube: 5000 (descripción)
 *   - Pinterest: 500 (descripción)
 *   - Reddit: 40000 (post body)
 */
export interface SocialLimit {
  /** Etiqueta visible en la UI ("X / Twitter") */
  label: string
  /** Caracteres permitidos como max */
  max:   number
}

const LIMITS: Record<string, SocialLimit> = {
  x:           { label: 'X / Twitter',  max: 280 },
  twitter:     { label: 'X / Twitter',  max: 280 },
  threads:     { label: 'Threads',      max: 500 },
  bluesky:     { label: 'Bluesky',      max: 300 },
  mastodon:    { label: 'Mastodon',     max: 500 },
  linkedin:    { label: 'LinkedIn',     max: 3000 },
  'linkedin-page': { label: 'LinkedIn Page', max: 3000 },
  instagram:   { label: 'Instagram',    max: 2200 },
  facebook:    { label: 'Facebook',     max: 63206 },
  'facebook-page': { label: 'Facebook Page', max: 63206 },
  tiktok:      { label: 'TikTok',       max: 2200 },
  youtube:     { label: 'YouTube',      max: 5000 },
  pinterest:   { label: 'Pinterest',    max: 500 },
  reddit:      { label: 'Reddit',       max: 40000 },
  dribbble:    { label: 'Dribbble',     max: 1000 },
  slack:       { label: 'Slack',        max: 4000 },
  discord:     { label: 'Discord',      max: 2000 },
}

const FALLBACK: SocialLimit = { label: 'Red social', max: 3000 }

export function getSocialLimit(identifier: string | undefined | null): SocialLimit {
  if (!identifier) return FALLBACK
  return LIMITS[identifier.toLowerCase()] ?? { ...FALLBACK, label: identifier }
}
