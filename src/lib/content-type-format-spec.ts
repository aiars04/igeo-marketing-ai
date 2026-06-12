/**
 * Helpers para validar, normalizar y formatear ContentTypeFormatSpec.
 *
 * El format_spec define qué assets necesita cada content_type:
 *   - needs_copy / needs_script (booleanos)
 *   - images: lista de {label, width, height, required, notes}
 *   - carousel: opcional { min, max, width, height }
 *
 * Las dimensiones son SUGERIDAS. No se valida obligatoriedad — solo se
 * inyectan en el prompt de Gemini y se muestran como checklist en la UI.
 */
import type { ContentTypeFormatSpec } from '@/types/database'

const MAX_IMAGES   = 12
const MAX_DIM      = 8192
const MAX_CAROUSEL = 30

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(MAX_DIM, Math.floor(n)))
}

/**
 * Normaliza y valida un format_spec arbitrario del cliente.
 * Descarta lo malformado en silencio (defensive parse).
 */
export function normalizeFormatSpec(input: unknown): ContentTypeFormatSpec {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const out: ContentTypeFormatSpec = {}

  if (raw.needs_copy   !== undefined) out.needs_copy   = !!raw.needs_copy
  if (raw.needs_script !== undefined) out.needs_script = !!raw.needs_script

  // Lista de imágenes con dimensiones opcionales
  if (Array.isArray(raw.images)) {
    const images = raw.images
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
      .slice(0, MAX_IMAGES)
      .map(item => {
        const label = typeof item.label === 'string' ? item.label.trim().slice(0, 80) : ''
        if (!label) return null
        return {
          label,
          width:    num(item.width),
          height:   num(item.height),
          required: item.required === undefined ? true : !!item.required,
          notes:    typeof item.notes === 'string' ? item.notes.trim().slice(0, 200) : null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    if (images.length > 0) out.images = images
  }

  // Carrusel opcional
  if (raw.carousel && typeof raw.carousel === 'object' && !Array.isArray(raw.carousel)) {
    const c = raw.carousel as Record<string, unknown>
    const minRaw = num(c.min)
    const maxRaw = num(c.max)
    const min = minRaw === null ? 2 : Math.max(2, Math.min(MAX_CAROUSEL, minRaw))
    const max = maxRaw === null ? min : Math.max(min, Math.min(MAX_CAROUSEL, maxRaw))
    out.carousel = {
      min, max,
      width:  num(c.width),
      height: num(c.height),
    }
  }

  return out
}

/**
 * Construye un bloque de texto legible con las especificaciones,
 * pensado para inyectar en el system prompt de Gemini al generar copy.
 *
 * Si el spec está vacío, devuelve ''.
 */
export function buildFormatSpecPromptBlock(spec: ContentTypeFormatSpec | null | undefined): string {
  if (!spec) return ''
  const lines: string[] = []

  const wants: string[] = []
  if (spec.needs_copy) wants.push('copy')
  if (spec.needs_script) wants.push('guión')
  if (spec.carousel) wants.push(`carrusel (${spec.carousel.min}-${spec.carousel.max} slides)`)
  if (spec.images && spec.images.length > 0) wants.push(`${spec.images.length} imagen${spec.images.length === 1 ? '' : 'es'}`)
  if (wants.length === 0) return ''

  lines.push(`Este formato requiere: ${wants.join(' + ')}.`)

  if (spec.images && spec.images.length > 0) {
    lines.push('\nIMÁGENES ESPERADAS (dimensiones sugeridas, no obligatorias):')
    for (const img of spec.images) {
      const dims = img.width && img.height ? ` — ${img.width}×${img.height}` : ''
      const req  = img.required ? ' [obligatoria]' : ' [opcional]'
      const note = img.notes ? ` · ${img.notes}` : ''
      lines.push(`  · ${img.label}${dims}${req}${note}`)
    }
  }

  if (spec.carousel) {
    const dims = spec.carousel.width && spec.carousel.height
      ? ` (${spec.carousel.width}×${spec.carousel.height} cada slide)`
      : ''
    lines.push(`\nCARRUSEL: ${spec.carousel.min}–${spec.carousel.max} slides${dims}.`)
  }

  return `\n\n════ ESTRUCTURA DEL FORMATO ════\n${lines.join('\n')}`
}
