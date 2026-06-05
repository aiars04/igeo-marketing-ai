import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  // Inicializador lazy: SSR-safe (window guard) y evita un setState extra al montar.
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  // Sync con MediaQueryList externo (window) — patrón canónico para
  // subscribirse a APIs del navegador.
  useEffect(() => {
    const media = window.matchMedia(query)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (media.matches !== matches) setMatches(media.matches)
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return matches
}
