import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'
import type { Profile, UserRole } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = createAdminClient()
  const { data: me } = await supabaseAdmin
    .from('profiles')
    .select('id, role, active, full_name, email')
    .eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active' | 'full_name' | 'email'>>()

  if (!me || !me.active) redirect('/login')

  // Solo admin y manager pueden acceder
  if (me.role === 'user') redirect('/pipeline')

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
    .returns<Profile[]>()

  return (
    <UsersClient
      currentUserId={me.id}
      currentRole={me.role as UserRole}
      initialProfiles={profiles ?? []}
    />
  )
}
