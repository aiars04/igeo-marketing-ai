import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)]">
          <Compass className="h-7 w-7 text-[var(--ink-3)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-2">
          Página no encontrada
        </h2>
        <p className="text-sm text-[var(--ink-2)] mb-6">
          La ruta que buscas no existe o ha sido movida.
        </p>
        <Link
          href="/calendar"
          className="inline-flex items-center px-4 h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Volver al calendario
        </Link>
      </div>
    </div>
  )
}
