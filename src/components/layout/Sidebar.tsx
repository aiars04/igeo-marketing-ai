'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Calendar, Lightbulb, Image, Settings,
  BarChart3, Zap, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/pipeline',  icon: LayoutGrid, label: 'Pipeline',   badge: null },
  { href: '/calendar',  icon: Calendar,   label: 'Calendario', badge: null },
  { href: '/ideas',     icon: Lightbulb,  label: 'Ideas',      badge: null },
  { href: '/images',    icon: Image,      label: 'Imágenes',   badge: null },
  { href: '/analytics', icon: BarChart3,  label: 'Análisis',   badge: null },
  { href: '/settings',  icon: Settings,   label: 'Config',     badge: null },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-[220px] shrink-0 h-full border-r border-[var(--border)] bg-[var(--surface)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-[60px] border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] flex items-center justify-center">
          <Zap size={14} className="text-black" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white leading-none">iGEO</div>
          <div className="text-[10px] text-[var(--muted)] leading-none mt-0.5">Marketing AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                active
                  ? 'bg-[var(--surface3)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.04)]'
              )}
            >
              <Icon
                size={16}
                className={cn(active ? 'text-[var(--accent)]' : 'text-[var(--muted)] group-hover:text-[var(--text)]')}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded-full font-semibold">
                  {badge}
                </span>
              )}
              {active && <ChevronRight size={12} className="text-[var(--muted)]" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[11px] font-bold text-white">
            R
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[var(--text)] truncate">Ramón</div>
            <div className="text-[10px] text-[var(--muted)] truncate">Editor</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
