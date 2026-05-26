import { useState, useEffect } from 'react'
import type { Channel } from '@/types/database'

/* ─── Types ─── */
export type ContentType = {
  id: string
  name: string
  channel: Channel
  description: string   // qué produce este tipo de contenido
  process: string       // cómo crearlo — la IA lee esto
  style: string         // tono, formato, longitud — estilo iGEO
  active: boolean
  createdAt: string
}

const STORAGE_KEY = 'igeo_content_types_v1'

/* ─── Defaults ─── */
export const DEFAULT_CONTENT_TYPES: ContentType[] = [
  {
    id: 'ct_1',
    name: 'Post LinkedIn iGEO',
    channel: 'linkedin',
    description: 'Publicación profesional en LinkedIn para posicionar iGEO como referente en digitalización del sector de servicios medioambientales.',
    process: 'Identifica un pain point del sector → Conecta con funcionalidad iGEO → CTA al demo o artículo.',
    style: 'Tono profesional pero cercano. Emojis moderados. Incluir estadística o dato del sector cuando sea posible. 150-300 palabras.',
    active: true,
    createdAt: '2026-05-01',
  },
  {
    id: 'ct_2',
    name: 'Carrusel Instagram',
    channel: 'instagram',
    description: 'Carrusel educativo de 5-8 slides que explica un proceso de trabajo o funcionalidad de iGEO de forma visual.',
    process: 'Slide 1: problema/pregunta gancho → Slides 2-6: solución paso a paso → Slide final: CTA.',
    style: 'Visual, colores corporativos iGEO (naranja #EA580C y azul). Texto corto por slide. Tono didáctico y accesible.',
    active: true,
    createdAt: '2026-05-01',
  },
  {
    id: 'ct_3',
    name: 'Newsletter mensual',
    channel: 'newsletter',
    description: 'Email mensual con resumen de novedades de iGEO, artículo del sector y próximos eventos.',
    process: 'Intro personal → Novedad destacada iGEO → Artículo/insight del sector → Evento próximo → CTA.',
    style: 'Tono cálido y editorial. Estructura clara con secciones. Longitud media (400-600 palabras).',
    active: true,
    createdAt: '2026-05-01',
  },
  {
    id: 'ct_4',
    name: 'Hilo X',
    channel: 'x',
    description: 'Hilo de 5-10 tweets sobre un tema técnico o tendencia del sector medioambiental.',
    process: 'Tweet 1 (gancho con cifra o pregunta) → Tweets 2-8 (desarrollo del tema) → Tweet final (conclusión + CTA).',
    style: 'Directo, con datos y referencias. Cada tweet funciona de forma independiente. Sin florituras. Máximo 280 chars por tweet.',
    active: true,
    createdAt: '2026-05-01',
  },
  {
    id: 'ct_5',
    name: 'Artículo de blog',
    channel: 'blog',
    description: 'Artículo SEO sobre digitalización del sector de servicios medioambientales, control de plagas o legionella.',
    process: 'Intro con problema → Desarrollo en secciones H2/H3 → Casos de uso iGEO → Conclusión + CTA.',
    style: 'Tono experto y divulgativo. 800-1500 palabras. Incluir palabras clave del sector. Evitar jerga excesivamente técnica.',
    active: true,
    createdAt: '2026-05-01',
  },
]

/* ─── Hook ─── */
export function useContentTypes() {
  const [types, setTypes] = useState<ContentType[]>(DEFAULT_CONTENT_TYPES)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) setTypes(parsed)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(types)) } catch {}
  }, [types, hydrated])

  const add = (t: Omit<ContentType, 'id' | 'createdAt'>) => {
    setTypes(prev => [...prev, {
      ...t,
      id: `ct_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    }])
  }

  const update = (id: string, changes: Partial<Omit<ContentType, 'id' | 'createdAt'>>) => {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t))
  }

  const remove = (id: string) => {
    setTypes(prev => prev.filter(t => t.id !== id))
  }

  const toggle = (id: string) => {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t))
  }

  return { types, add, update, remove, toggle, hydrated }
}
