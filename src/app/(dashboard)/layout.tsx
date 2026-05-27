import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Mapear user de Supabase al shape Profile que espera AppShell
  const profile = {
    user_id:   user.id,
    email:     user.email ?? '',
    full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    role:      'admin' as const,   // rol por defecto hasta que tengamos tabla de roles
  }

  return <AppShell profile={profile}>{children}</AppShell>
}
