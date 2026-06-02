'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Lightbulb,
  Image as ImageIcon,
  BarChart3,
  BookOpen,
  Settings,
  MessageSquarePlus,
  LogOut,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  user_id: string
  email: string
  full_name: string | null
  role: 'admin' | 'manager' | 'user'
  active?: boolean
}

const ROLE_LABEL: Record<Profile['role'], string> = {
  admin:   'Admin',
  manager: 'Manager',
  user:    'Usuario',
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode
  profile?: Profile | null
}) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const isLogin = pathname.startsWith('/login')

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isLogin) return <>{children}</>

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        {/* ── Brand ── */}
        <div className="brand">
          <div className="brand-mark">i</div>
          <div className="brand-text">
            <p className="brand-title">iGEO Marketing</p>
            <p className="brand-subtitle">AI Workspace</p>
          </div>
        </div>

        <div className="sidebar-scroll">
          {/* ── Bloque principal (workspace) ── */}
          <div className="nav-block">
            <div className="section-label">Workspace</div>
            <Link
              className={`nav-link ${isActive(pathname, '/pipeline') ? 'active' : ''}`}
              href="/pipeline"
              title="Pipeline"
            >
              <LayoutDashboard />
              <span className="sidebar-label">Pipeline</span>
            </Link>
            <Link
              className={`nav-link ${isActive(pathname, '/calendar') ? 'active' : ''}`}
              href="/calendar"
              title="Calendario"
            >
              <Calendar />
              <span className="sidebar-label">Calendario</span>
            </Link>
            <Link
              className={`nav-link ${isActive(pathname, '/ideas') ? 'active' : ''}`}
              href="/ideas"
              title="Ideas"
            >
              <Lightbulb />
              <span className="sidebar-label">Ideas</span>
            </Link>
            <Link
              className={`nav-link ${isActive(pathname, '/images') ? 'active' : ''}`}
              href="/images"
              title="Imágenes"
            >
              <ImageIcon />
              <span className="sidebar-label">Imágenes</span>
            </Link>
            <Link
              className={`nav-link ${isActive(pathname, '/analytics') ? 'active' : ''}`}
              href="/analytics"
              title="Análisis"
            >
              <BarChart3 />
              <span className="sidebar-label">Análisis</span>
            </Link>
          </div>

          {/* ── Bloque sistema ── */}
          <div className="nav-block">
            <div className="section-label">Sistema</div>
            <Link
              className={`nav-link ${isActive(pathname, '/admin') ? 'active' : ''}`}
              href="/admin"
              title="Admin"
            >
              <BookOpen />
              <span className="sidebar-label">Admin</span>
            </Link>
            {profile && (profile.role === 'admin' || profile.role === 'manager') && (
              <Link
                className={`nav-link ${isActive(pathname, '/users') ? 'active' : ''}`}
                href="/users"
                title="Usuarios"
              >
                <Users />
                <span className="sidebar-label">Usuarios</span>
              </Link>
            )}
            <Link
              className={`nav-link ${isActive(pathname, '/settings') ? 'active' : ''}`}
              href="/settings"
              title="Ajustes"
            >
              <Settings />
              <span className="sidebar-label">Ajustes</span>
            </Link>
          </div>

          {/* ── Bloque ayuda (pegado abajo) ── */}
          <div className="nav-block" style={{ marginTop: 'auto' }}>
            <div className="section-label">Ayuda</div>
            <a
              className="nav-button"
              href="mailto:ai@igeoerp.com?subject=Sugerencia%20iGEO%20Marketing%20AI"
              title="Sugerir mejoras"
            >
              <MessageSquarePlus />
              <span className="sidebar-label">Sugerir mejoras</span>
            </a>
          </div>

          {/* ── Tarjeta usuario abajo ── */}
          {profile && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(profile.full_name || profile.email || '?')
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <p className="sidebar-user-name">
                  {profile.full_name || profile.email.split('@')[0]}
                </p>
                <p className="sidebar-user-role">{ROLE_LABEL[profile.role]}</p>
              </div>
              <button
                className="sidebar-user-logout"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  )
}
