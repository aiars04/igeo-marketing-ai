'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Error boundary del dashboard. Captura cualquier excepción no controlada
 * en una página o componente del árbol (dashboard)/.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log a consola; en producción Vercel lo captura.
    console.error('[dashboard error]', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)]">
          <AlertTriangle className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-2">
          Algo salió mal
        </h2>
        <p className="text-sm text-[var(--ink-2)] mb-6">
          {error.message || 'Ha ocurrido un error inesperado al cargar esta sección.'}
        </p>
        {error.digest && (
          <p className="text-[11px] text-[var(--ink-3)] font-mono mb-6">
            ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </button>
      </div>
    </div>
  )
}
