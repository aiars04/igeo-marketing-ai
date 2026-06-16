'use client'

/**
 * Personalización de colores por canal.
 *
 * Cada usuario puede asignar un slug de la paleta Apple a cualquiera de los
 * canales (LinkedIn, Instagram, etc.). Las preferencias se persisten en
 * localStorage por dispositivo. El default por canal se mantiene si el usuario
 * no ha tocado nada.
 *
 * Sin BD: las preferencias visuales no necesitan sincronización cross-device.
 * Si en el futuro se quiere multidispositivo, se migra a profiles.preferences.
 */

import { useEffect, useState, useCallback } from 'react'
import type { Channel } from '@/types/database'

/** Paleta Apple system colors — pares text/border/bg para chips de canal. */
export interface PaletteEntry {
  slug:   string
  label:  string
  text:   string
  border: string
  bg:     string
}

export const CHANNEL_PALETTE: readonly PaletteEntry[] = [
  { slug: 'red',    label: 'Rojo',          text: '#c0392b', border: 'rgba(255,59,48,0.22)',  bg: 'rgba(255,59,48,0.08)'  },
  { slug: 'orange', label: 'Naranja',       text: '#b25000', border: 'rgba(255,159,10,0.25)', bg: 'rgba(255,159,10,0.08)' },
  { slug: 'yellow', label: 'Amarillo',      text: '#8a6d00', border: 'rgba(255,204,0,0.30)',  bg: 'rgba(255,204,0,0.14)'  },
  { slug: 'green',  label: 'Verde',         text: '#1a7a36', border: 'rgba(52,199,89,0.25)',  bg: 'rgba(52,199,89,0.08)'  },
  { slug: 'mint',   label: 'Menta',         text: '#008a83', border: 'rgba(0,199,190,0.25)',  bg: 'rgba(0,199,190,0.10)'  },
  { slug: 'teal',   label: 'Verde-azulado', text: '#1f7a8c', border: 'rgba(48,176,199,0.25)', bg: 'rgba(48,176,199,0.10)' },
  { slug: 'cyan',   label: 'Cian',          text: '#1e7da8', border: 'rgba(50,173,230,0.25)', bg: 'rgba(50,173,230,0.10)' },
  { slug: 'blue',   label: 'Azul',          text: '#0055b3', border: 'rgba(0,113,227,0.22)',  bg: 'rgba(0,113,227,0.07)'  },
  { slug: 'indigo', label: 'Índigo',        text: '#3b3a99', border: 'rgba(88,86,214,0.25)',  bg: 'rgba(88,86,214,0.10)'  },
  { slug: 'purple', label: 'Morado',        text: '#7b2fa8', border: 'rgba(175,82,222,0.22)', bg: 'rgba(175,82,222,0.10)' },
  { slug: 'pink',   label: 'Rosa',          text: '#c0245a', border: 'rgba(232,56,140,0.22)', bg: 'rgba(232,56,140,0.07)' },
  { slug: 'brown',  label: 'Marrón',        text: '#6e5b40', border: 'rgba(162,132,94,0.30)', bg: 'rgba(162,132,94,0.14)' },
  { slug: 'gray',   label: 'Gris',          text: '#3c3c43', border: 'rgba(0,0,0,0.12)',      bg: 'rgba(0,0,0,0.04)'      },
] as const

const GRAY_FALLBACK = CHANNEL_PALETTE.find(p => p.slug === 'gray')!

export function paletteEntry(slug: string | undefined | null): PaletteEntry {
  if (!slug) return GRAY_FALLBACK
  return CHANNEL_PALETTE.find(p => p.slug === slug) ?? GRAY_FALLBACK
}

/** Default por canal — coincide con los colores históricos del codebase. */
export const DEFAULT_CHANNEL_SLUG: Record<Channel, string> = {
  linkedin:   'blue',
  instagram:  'pink',
  facebook:   'blue',
  x:          'gray',
  blog:       'orange',
  email:      'orange',
  newsletter: 'green',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin:   'LinkedIn',
  instagram:  'Instagram',
  facebook:   'Facebook',
  x:          'X',
  blog:       'Blog',
  email:      'Email',
  newsletter: 'Newsletter',
}

const STORAGE_KEY = 'igeo:channel-colors:v1'
const SAME_TAB_EVENT = 'igeo:channel-colors-changed'

type Overrides = Partial<Record<Channel, string>>

function readStored(): Overrides {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Overrides) : {}
  } catch { return {} }
}

function writeStored(next: Overrides) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    // storage event no se dispara en la misma pestaña — usamos uno propio.
    window.dispatchEvent(new Event(SAME_TAB_EVENT))
  } catch {}
}

/**
 * Devuelve el slug de paleta resuelto para un canal (override del usuario o default).
 */
export function getResolvedSlug(channel: Channel, overrides: Overrides): string {
  return overrides[channel] ?? DEFAULT_CHANNEL_SLUG[channel] ?? 'gray'
}

/** Lista de todos los canales (mantener en sync con type Channel). */
export const ALL_CHANNELS_ARRAY: Channel[] = [
  'linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter',
]

/**
 * Escribe las CSS custom properties --ch-{channel}-{text|bg|border} en el
 * elemento dado (típicamente document.documentElement) según los overrides
 * actuales. Permite que CSS estático (globals.css) y componentes inline
 * compartan la misma fuente de verdad y se repinten al instante cuando el
 * usuario cambia un color desde Admin → Colores.
 */
export function applyChannelCssVars(root: HTMLElement, overrides: Overrides): void {
  for (const ch of ALL_CHANNELS_ARRAY) {
    const entry = paletteEntry(getResolvedSlug(ch, overrides))
    root.style.setProperty(`--ch-${ch}-text`,   entry.text)
    root.style.setProperty(`--ch-${ch}-bg`,     entry.bg)
    root.style.setProperty(`--ch-${ch}-border`, entry.border)
  }
}

/**
 * Hook reactivo. Carga overrides desde localStorage al montar, escucha cambios
 * de otras pestañas (storage event) y del mismo tab (evento custom), y expone
 * setters/reset.
 *
 * Para evitar mismatch de hidratación SSR/CSR, durante el primer render se
 * devuelve `{}` (defaults). Tras useEffect se hidrata con los overrides reales.
 */
export function useChannelColors() {
  const [overrides, setOverrides] = useState<Overrides>({})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrides(readStored())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setOverrides(readStored())
    }
    const onSameTab = () => setOverrides(readStored())
    window.addEventListener('storage', onStorage)
    window.addEventListener(SAME_TAB_EVENT, onSameTab)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SAME_TAB_EVENT, onSameTab)
    }
  }, [])

  const setChannelColor = useCallback((channel: Channel, slug: string) => {
    setOverrides(prev => {
      const next = { ...prev, [channel]: slug }
      writeStored(next)
      return next
    })
  }, [])

  const resetChannelColor = useCallback((channel: Channel) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[channel]
      writeStored(next)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setOverrides({})
    writeStored({})
  }, [])

  const getColor = useCallback(
    (channel: Channel): PaletteEntry => paletteEntry(getResolvedSlug(channel, overrides)),
    [overrides],
  )

  return { overrides, getColor, setChannelColor, resetChannelColor, resetAll }
}
