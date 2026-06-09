import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  // Solo lanza en runtime real (no en build estático)
  throw new Error('GEMINI_API_KEY is not set in environment')
}

export const genai = new GoogleGenAI({ apiKey })

// ── Modelos de generación de imágenes ──────────────────────────────────────
// Nano Banana 2 (Gemini 3 Flash Image Preview) — PRINCIPAL
// Más rápido (3-8s), cuota mucho mayor (~1500/día free), más barato y soporta edición.
// Devuelve la imagen vía generateContent con responseModalities: ['Image'].
export const NANO_BANANA_MODEL = 'gemini-3.1-flash-image'
// Variante Pro (calidad superior, más lenta) — fallback intermedio
export const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image'

// Imagen 4 Ultra — fallback si Nano Banana falla. Calidad máxima pero más lento y cuota baja.
export const IMAGEN_MODEL = 'imagen-4.0-ultra-generate-001'
// Imagen 4 Base — fallback final. Soporta numberOfImages 1..4 (Ultra no).
export const IMAGEN_BASE_MODEL = 'imagen-4.0-generate-001'

// Gemini Flash para enriquecer prompts antes de la generación
export const ENHANCER_MODEL = 'gemini-2.0-flash'

// Resolución máxima soportada por Imagen 4 para cada aspect ratio
export const IMAGEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 }, // máximo cuadrado
  '16:9': { width: 1408, height: 792  }, // máximo landscape
  '9:16': { width: 792,  height: 1408 }, // máximo portrait
  '4:5':  { width: 896,  height: 1120 }, // máximo feed Instagram
}

export type AspectRatio = keyof typeof IMAGEN_DIMENSIONS
