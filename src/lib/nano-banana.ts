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
 * Genera UNA imagen con Nano Banana 2.
 * Lanza error si el modelo no devuelve imagen.
 */
export async function generateWithNanoBanana(
  prompt: string,
  aspectRatio: string,
): Promise<{ imageBytes: string; modelUsed: string }> {
  const hint = ASPECT_HINTS[aspectRatio] ?? ''
  const finalPrompt = `${prompt}\n\n${hint}`.trim()

  const response = await genai.models.generateContent({
    model: NANO_BANANA_MODEL,
    contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
    config: {
      responseModalities: ['Image'],
    },
  })

  // La imagen viene en parts[].inlineData.data como base64
  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
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
