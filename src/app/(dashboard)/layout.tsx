import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Sidebar fixed — se expande al hacer hover */}
      <Sidebar />
      {/* Main content desplazado el ancho del sidebar colapsado (52px) */}
      <main className="ml-[52px] h-screen overflow-auto bg-[var(--bg)]">
        {children}
      </main>
    </div>
  )
}
