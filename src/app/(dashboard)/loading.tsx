/**
 * Loading skeleton del dashboard. Se muestra mientras un Server Component
 * o navegación entre rutas está en streaming.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex items-center gap-3 text-[var(--ink-3)]">
        <div className="h-4 w-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <span className="text-[13px]">Cargando…</span>
      </div>
    </div>
  )
}
