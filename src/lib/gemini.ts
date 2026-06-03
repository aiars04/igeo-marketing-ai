import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  // Solo lanza en runtime real (no en build estático)
  throw new Error('GEMINI_API_KEY is not set in environment')
}

export const genai = new GoogleGenAI({ apiKey })

// Nombre verificado vía models.list() — Imagen 4 Ultra (calidad máxima)
export const IMAGEN_MODEL = 'imagen-4.0-ultra-generate-001'
export const ENHANCER_MODEL = 'gemini-2.0-flash'

// Resolución máxima soportada por Imagen 4 para cada aspect ratio
export const IMAGEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 }, // máximo cuadrado
  '16:9': { width: 1408, height: 792  }, // máximo landscape
  '9:16': { width: 792,  height: 1408 }, // máximo portrait
  '4:5':  { width: 896,  height: 1120 }, // máximo feed Instagram
}

export type AspectRatio = keyof typeof IMAGEN_DIMENSIONS
