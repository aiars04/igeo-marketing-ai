'use client'

/**
 * Aplica las CSS custom properties --ch-{channel}-{text|bg|border} en
 * document.documentElement según los overrides del usuario (localStorage).
 *
 * Se monta una vez en el AppShell. Permite que CSS estático (globals.css,
 * ej. .pcard[data-channel="X"] con var(--ch-X-border)) y componentes inline
 * que consumen directamente las variables se repinten al instante cuando el
 * usuario cambia un color desde Admin → Colores.
 *
 * Render: null (es un side-effect provider, no produce UI).
 */

import { useEffect } from 'react'
import { useChannelColors, applyChannelCssVars } from '@/lib/channel-colors'

export function ChannelColorsCssVars() {
  const { overrides } = useChannelColors()

  useEffect(() => {
    if (typeof document === 'undefined') return
    applyChannelCssVars(document.documentElement, overrides)
  }, [overrides])

  return null
}
