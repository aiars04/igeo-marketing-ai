/**
 * Traductor de mensajes de error crudos de Postiz/redes sociales a copy
 * accionable en español. El cron guarda el mensaje original en
 * `content_items.publish_error` (útil para debug) y este helper se aplica
 * SOLO al renderizar — los datos persistidos no se tocan.
 *
 * Si ningún patrón hace match, devolvemos el original tal cual (siempre
 * mostrar algo es mejor que esconder el error).
 */

export interface HumanizedPostizError {
  /** Frase principal en español. */
  title: string
  /** Acción concreta que el usuario debe hacer (opcional). */
  action: string | null
}

interface Pattern {
  /** Regex sobre el mensaje crudo (case-insensitive). */
  match: RegExp
  title: string
  action: string | null
}

// Orden importa: patrones más específicos primero.
const PATTERNS: Pattern[] = [
  {
    match: /missing (some )?permissions|allow all permissions/i,
    title: 'La cuenta de la red social perdió permisos en Postiz.',
    action: 'Ve a tu dashboard de Postiz → Settings → Integrations, reconecta la cuenta afectada y acepta TODOS los permisos.',
  },
  {
    match: /invalid (access )?token|token (has )?expired|expired token|reauth/i,
    title: 'El token de acceso caducó.',
    action: 'Reconecta la cuenta en Postiz → Settings → Integrations.',
  },
  {
    match: /rate.?limit|too many requests|throttle/i,
    title: 'La red social limitó las publicaciones (rate limit).',
    action: 'Espera entre 30 minutos y 1 hora antes de reintentar.',
  },
  {
    match: /duplicate|already (posted|published)/i,
    title: 'La red detectó contenido duplicado.',
    action: 'Cambia el copy o la imagen y vuelve a intentar.',
  },
  {
    match: /(media|image|file).*(too large|size|exceed)|maximum (file )?size/i,
    title: 'La imagen es demasiado grande para esa red social.',
    action: 'Reduce el tamaño o las dimensiones y reintenta.',
  },
  {
    match: /unsupported (format|media|type)|invalid (format|media|file type)/i,
    title: 'El formato del archivo no es compatible con esa red social.',
    action: 'Convierte la imagen a JPG/PNG (o el vídeo a MP4) y reintenta.',
  },
  {
    match: /business (account|profile) required|not a business account/i,
    title: 'Esa cuenta no es Business/Creator.',
    action: 'En Instagram/Facebook, cambia el perfil a Business desde la app móvil y vuelve a reconectar en Postiz.',
  },
  {
    match: /page (not found|deleted)|account (suspended|deleted|disabled)/i,
    title: 'La página o cuenta ya no existe o fue suspendida por la red social.',
    action: 'Revisa el estado de la cuenta en Meta/X/LinkedIn y reconecta en Postiz si la cuenta vuelve a estar activa.',
  },
  {
    match: /caption.*too long|text.*too long|character limit|content (length|too long)/i,
    title: 'El texto excede el límite de caracteres de la red social.',
    action: 'Acorta el copy y reintenta.',
  },
  {
    match: /network|timeout|econn|fetch failed/i,
    title: 'Error de red al contactar con la API de la red social.',
    action: 'Reintenta en unos minutos. Si persiste, comprueba el estado de Postiz.',
  },
]

export function humanizePostizError(raw: string | null | undefined): HumanizedPostizError {
  if (!raw || !raw.trim()) {
    return { title: 'La red social rechazó la publicación.', action: null }
  }
  for (const p of PATTERNS) {
    if (p.match.test(raw)) {
      return { title: p.title, action: p.action }
    }
  }
  // Fallback: devolver el mensaje original (truncado por seguridad).
  return { title: raw.slice(0, 300), action: null }
}
