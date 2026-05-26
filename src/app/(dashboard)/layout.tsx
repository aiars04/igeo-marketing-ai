import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { FloatingPaths } from '@/components/ui/FloatingPaths'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Fondo animado — muy sutil detrás del contenido */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.22 }}>
        <FloatingPaths />
      </div>

      {/* Sidebar fixed */}
      <Sidebar />

      {/* Contenido principal */}
      <main
        className="relative z-10 h-screen overflow-y-auto overflow-x-hidden"
        style={{
          marginLeft: 'var(--sidebar-collapsed)',
          width: 'calc(100% - var(--sidebar-collapsed))',
        }}
      >
        {children}
      </main>
    </div>
  )
}
