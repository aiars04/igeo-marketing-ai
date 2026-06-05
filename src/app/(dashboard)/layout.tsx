import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'

export type UserRole = 'admin' | 'manager' | 'user'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS policy `profiles_select` permite a cualquier authenticated leer perfiles,
  // así que el cliente user-scoped basta — sin necesidad de service_role aquí.
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .single<{ full_name: string | null; role: UserRole; active: boolean }>()

  // Si profile no existe o usuario está inactivo → cerrar sesión y al login
  if (!profileData || !profileData.active) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const profile = {
    user_id:   user.id,
    email:     user.email ?? '',
    full_name: profileData.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    role:      profileData.role,
    active:    profileData.active,
  }

  return <AppShell profile={profile}>{children}</AppShell>
}
