'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Calendar, Lightbulb, Image,
  Settings, BarChart3, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { IgeoMark } from '@/components/ui/Logo'

/* ─── Config ─── */
const nav = [
  { href: '/pipeline',  icon: LayoutGrid, label: 'Pipeline',   badge: null },
  { href: '/calendar',  icon: Calendar,   label: 'Calendario', badge: null },
  { href: '/ideas',     icon: Lightbulb,  label: 'Ideas',      badge: '3'  },
  { href: '/images',    icon: Image,      label: 'Imágenes',   badge: null },
  { href: '/analytics', icon: BarChart3,  label: 'Análisis',   badge: null },
  { href: '/settings',  icon: Settings,   label: 'Ajustes',    badge: null },
]

/* ─── Label animado ─── */
function FadeLabel({ show, children, className }: {
  show: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          key="label"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.14 }}
          className={cn('whitespace-nowrap overflow-hidden', className)}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/* ─── Sidebar ─── */
export function Sidebar() {
  const pathname     = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-full flex flex-col border-r border-[var(--border)] overflow-hidden"
      style={{
        background:  'var(--surface)',
        width:       open ? '220px' : '52px',
        transition:  'width 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Gradient top glow */}
      <div
        className="absolute top-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--glow-blue), transparent)' }}
      />

      {/* ── Logo ── */}
      <div className="relative flex items-center h-[62px] px-3.5 shrink-0 border-b border-[var(--border)]">
        <div className="shrink-0">
          <IgeoMark size={26} />
        </div>
        <FadeLabel show={open} className="flex flex-col leading-none ml-2.5">
          <div className="flex items-baseline gap-px">
            <span className="font-bold text-[13.5px]" style={{ color: '#EA580C' }}>i</span>
            <span className="font-bold text-[13.5px] text-white">GEO</span>
            <span className="font-semibold text-[11px] text-[var(--muted)] ml-1">ERP</span>
          </div>
          <span
            className="text-[9.5px] font-semibold tracking-[0.1em] uppercase"
            style={{ color: 'var(--accent2)' }}
          >
            Marketing AI
          </span>
        </FadeLabel>
      </div>

      {/* ── Nav ── */}
      <nav className="relative flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {nav.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative group flex items-center h-[34px] px-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 overflow-hidden',
                active
                  ? 'bg-[var(--surface3)] text-white'
                  : 'text-[var(--muted)] hover:text-white hover:bg-[var(--surface2)]',
              )}
            >
              {/* Left active indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-[var(--accent)]" />
              )}

              <Icon
                size={16}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-[var(--accent)]' : 'text-[var(--muted)] group-hover:text-white',
                )}
                strokeWidth={active ? 2.5 : 2}
              />

              <FadeLabel show={open} className="ml-2.5 flex-1 truncate">
                {label}
              </FadeLabel>

              {badge && open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    active
                      ? 'bg-[var(--accent)]/20 text-[var(--accent2)]'
                      : 'bg-[var(--surface3)] text-[var(--muted)]',
                  )}
                >
                  {badge}
                </motion.span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Usuario ── */}
      <div className="relative px-2 py-3 shrink-0 border-t border-[var(--border)]">
        <div className="flex items-center h-[34px] px-2.5 rounded-lg hover:bg-[var(--surface2)] cursor-pointer transition-colors overflow-hidden">
          <div
            className="w-[22px] h-[22px] shrink-0 rounded-md flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }}
          >
            R
          </div>
          <FadeLabel show={open} className="ml-2.5 flex flex-col flex-1 min-w-0">
            <span className="text-[12px] font-semibold text-[var(--text)] leading-none">Ramón</span>
            <span className="text-[10px] text-[var(--muted)] mt-0.5">Editor</span>
          </FadeLabel>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-auto shrink-0"
            >
              <LogOut size={12} className="text-[var(--muted)]" />
            </motion.div>
          )}
        </div>
      </div>
    </aside>
  )
}
