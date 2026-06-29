/**
 * Nano Banana 2 (Gemini 3.1 Flash Image) — wrapper de generación de imágenes
 *
 * Diferencias vs Imagen 4:
 * - Usa generateContent (no generateImages)
 * - Imagen viene en candidates[0].content.parts[].inlineData.data (base64)
 * - No soporta el parámetro aspectRatio — se inyecta en el prompt
 * - No soporta numberOfImages — para variantes hay que hacer N llamadas en paralelo
 * - 3-8 segundos por imagen (vs 15-30s de Imagen 4 Ultra)
 * - Cuota ~150x más generosa en free tier
 */

import { genai, NANO_BANANA_MODEL } from '@/lib/gemini'

// Sugerencia de aspect ratio inyectada en el prompt — Nano Banana respeta el formato
// del último canvas pedido. Esta directiva mejora la consistencia.
const ASPECT_HINTS: Record<string, string> = {
  '1:1':  'Square aspect ratio (1:1), 1024x1024.',
  '16:9': 'Landscape aspect ratio (16:9), wide format 1408x792.',
  '9:16': 'Vertical aspect ratio (9:16), portrait format 792x1408.',
  '4:5':  'Portrait aspect ratio (4:5), Instagram feed format 896x1120.',
}

/**
 * Imagen de referencia para guiar la generación visual.
 * Nano Banana 2 acepta múltiples (multi-image input) y las usa como contexto
 * de estilo, identidad de marca, paleta, composición, etc.
 */
export interface NanoBananaReference {
  imageBase64: string  // sin el prefijo "data:image/...;base64,"
  mimeType:    string  // 'image/png' | 'image/jpeg' | 'image/webp' …
}

/** Tope conservador — pasar más confunde al modelo y degrada la calidad. */
const MAX_REFERENCES = 5

/**
 * Genera UNA imagen con Nano Banana 2.
 * Opcionalmente acepta imágenes de referencia (plantillas maestras, brand kit,
 * ejemplos…) que se inyectan como input multi-imagen. El modelo las usa para
 * imitar estilo, paleta, composición y mantener identidad visual.
 *
 * Lanza error si el modelo no devuelve imagen.
 */
export async function generateWithNanoBanana(
  prompt: string,
  aspectRatio: string,
  references: NanoBananaReference[] = [],
  opts: { editingMode?: boolean } = {},
): Promise<{ imageBytes: string; modelUsed: string }> {
  const hint = ASPECT_HINTS[aspectRatio] ?? ''
  const refsUsed = references.slice(0, MAX_REFERENCES)

  // Pista textual de uso de referencias — refuerza que el modelo las consulte.
  // En editingMode el prompt YA contiene una directiva específica (preservar
  // la primera imagen como base) — añadir el hint genérico "adapt content to
  // the new prompt" contradice esa instrucción. Saltarlo.
  const refHint = refsUsed.length > 0 && !opts.editingMode
    ? `\n\nUse the ${refsUsed.length} attached reference image${refsUsed.length === 1 ? '' : 's'} as visual guide for brand identity, color palette, composition style and layout. Match the visual language closely but adapt the content to the new prompt.`
    : ''
  const finalPrompt = `${prompt}\n\n${hint}${refHint}`.trim()

  // El modelo acepta interleave de partes: imágenes primero (refs), luego texto.
  // Las imágenes inlineData van en partes con mimeType.
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  for (const ref of refsUsed) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.imageBase64 } })
  }
  parts.push({ text: finalPrompt })

  const response = await genai.models.generateContent({
    model: NANO_BANANA_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['Image'],
    },
  })

  // La imagen viene en parts[].inlineData.data como base64
  const respParts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of respParts) {
    const data = part.inlineData?.data
    if (data) {
      return { imageBytes: data, modelUsed: NANO_BANANA_MODEL }
    }
  }

  // No image returned — propagamos error específico
  throw new Error('nano_banana_no_image_returned')
}

/**
 * Genera N imágenes con Nano Banana 2 en paralelo (para modo "variantes").
 * Cada llamada usa el mismo prompt pero el modelo produce variaciones naturales.
 */
export async function generateNanoBananaVariants(
  prompt: string,
  n: number,
  aspectRatio: string,
): Promise<string[]> {
  const promises = Array.from({ length: n }, () => generateWithNanoBanana(prompt, aspectRatio))
  const results = await Promise.allSettled(promises)
  const images = results
    .filter((r): r is PromiseFulfilledResult<{ imageBytes: string; modelUsed: string }> => r.status === 'fulfilled')
    .map(r => r.value.imageBytes)
  if (images.length === 0) {
    // Si todas fallaron, propaga el primer error
    const firstFailure = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
    throw firstFailure?.reason ?? new Error('nano_banana_all_variants_failed')
  }
  return images
}
