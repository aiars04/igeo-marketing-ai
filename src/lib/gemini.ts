import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  // Solo lanza en runtime real (no en build estático)
  throw new Error('GEMINI_API_KEY is not set in environment')
}

export const genai = new GoogleGenAI({ apiKey })

export const IMAGEN_MODEL = 'imagen-4.0-generate-001'

export const IMAGEN_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768  },
  '9:16': { width: 768,  height: 1344 },
  '4:5':  { width: 896,  height: 1120 },
}

export type AspectRatio = keyof typeof IMAGEN_DIMENSIONS
