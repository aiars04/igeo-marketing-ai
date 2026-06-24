'use client'

import { useEffect, useState } from 'react'

type CurrentUser = {
  id: string
  full_name: string | null
  email: string
  role: 'admin' | 'manager' | 'user'
  active: boolean
}

// IMPORTANTE: `cache` solo se SETEA dentro de useEffect (cliente). Si alguien
// refactoriza para setearlo en top-level o durante el render, el módulo-global
// del servidor Next.js podría filtrar el perfil de un usuario a la SSR de
// otro. Mantener la escritura dentro de useEffect.
let cache: CurrentUser | null = null
let inFlight: Promise<CurrentUser | null> | null = null

/** Limpia el cache. Llamar desde handleLogout antes de cambiar de sesión. */
export function clearCurrentUserCache(): void {
  cache = null
  inFlight = null
}

/**
 * Devuelve el perfil del usuario actual (id, role, etc.) cacheado en memoria
 * para evitar pedirlo en cada render. El cache es por carga de página — al
 * recargar se vuelve a pedir.
 *
 * Estados:
 *   { user: null, loading: true  } — primera carga
 *   { user: X,    loading: false } — perfil cargado
 *   { user: null, loading: false } — error o sesión expirada
 */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(cache)
  const [loading, setLoading] = useState<boolean>(!cache)

  useEffect(() => {
    if (cache) return
    let cancelled = false
    if (!inFlight) {
      inFlight = fetch('/api/me')
        .then(r => r.ok ? r.json() as Promise<CurrentUser> : null)
        // Solo cachear éxito. Si /api/me falla transitoriamente (500, timeout),
        // queremos reintentar en el siguiente mount, no quedarnos en fail-closed
        // para el resto de la vida de la página.
        .then(p => { if (p) cache = p; return p })
        .catch(() => null)
        .finally(() => { inFlight = null })
    }
    inFlight.then(p => {
      if (cancelled) return
      setUser(p)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return { user, loading }
}

/** Helper: ¿el usuario actual puede publicar/cancelar? */
export function useCanPublish(): boolean {
  const { user } = useCurrentUser()
  return user?.role === 'admin' || user?.role === 'manager'
}
