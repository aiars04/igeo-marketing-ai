'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Calendar, Lightbulb, Image, Settings,
  BarChart3, ChevronRight, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'

const nav = [
  { href: '/pipeline',  icon: LayoutGrid, label: 'Pipeline',   badge: null },
  { href: '/calendar',  icon: Calendar,   label: 'Calendario', badge: null },
  { href: '/ideas',     icon: Lightbulb,  label: 'Ideas',      badge: '3' },
  { href: '/images',    icon: Image,      label: 'Imágenes',   badge: null },
  { href: '/analytics', icon: BarChart3,  label: 'Análisis',   badge: null },
  { href: '/settings',  icon: Settings,   label: 'Ajustes',    badge: null },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="relative flex flex-col w-[220px] shrink-0 h-full border-r border-[var(--border)] bg-[var(--surface)]">
      {/* Gradient decorativo superior */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[var(--glow-blue)] to-transparent pointer-events-none" />

      {/* ── Logo ── */}
      <div className="relative flex items-center px-5 h-[62px] border-b border-[var(--border)]">
        <Logo variant="sidebar" />
      </div>

      {/* ── Navegación ── */}
      <nav className="relative flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150',
                active
                  ? 'bg-[var(--surface3)] text-white'
                  : 'text-[var(--muted)] hover:text-white hover:bg-[var(--surface2)]'
              )}
            >
              {/* Indicador izquierda estilo Linear */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-[var(--accent)]" />
              )}

              <Icon
                size={15}
                className={cn(
                  'shrink-0 transition-colors',
                  active
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--muted)] group-hover:text-white'
                )}
                strokeWidth={active ? 2.5 : 2}
              />

              <span className="flex-1 truncate">{label}</span>

              {badge && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  active
                    ? 'bg-[var(--accent)]/20 text-[var(--accent2)]'
                    : 'bg-[var(--surface3)] text-[var(--muted)]'
                )}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Usuario ── */}
      <div className="relative px-2.5 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--surface2)] cursor-pointer transition-colors group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            R
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-[var(--text)] leading-none truncate">Ramón</div>
            <div className="text-[10px] text-[var(--muted)] leading-none mt-0.5">Editor</div>
          </div>
          <LogOut
            size={13}
            className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          />
        </div>
      </div>
    </aside>
  )
}
