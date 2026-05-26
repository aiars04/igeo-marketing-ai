'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Calendar, Lightbulb, Image,
  Settings, BarChart3, LogOut, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_TOP = [
  { href: '/pipeline',  icon: LayoutGrid, label: 'Pipeline',   badge: null },
  { href: '/calendar',  icon: Calendar,   label: 'Calendario', badge: null },
  { href: '/ideas',     icon: Lightbulb,  label: 'Ideas',      badge: '3'  },
  { href: '/images',    icon: Image,      label: 'Imágenes',   badge: null },
  { href: '/analytics', icon: BarChart3,  label: 'Análisis',   badge: null },
]
const NAV_BOTTOM = [
  { href: '/admin',    icon: BookOpen, label: 'Admin',   badge: null },
  { href: '/settings', icon: Settings, label: 'Ajustes', badge: null },
]

function Label({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden whitespace-nowrap flex-1 min-w-0"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function NavItem({
  href, icon: Icon, label, badge, active, open,
}: {
  href: string; icon: React.ElementType; label: string
  badge: string | null; active: boolean; open: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center h-9 rounded-md transition-colors mx-2 px-2.5',
      )}
      style={{
        background: active ? 'rgba(234,88,12,0.10)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {active && (
        <motion.span
          layoutId="nav-active-bar"
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
          style={{ background: 'var(--orange)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      <Icon
        size={15}
        strokeWidth={active ? 2.2 : 1.8}
        className="shrink-0"
        style={{ color: active ? 'var(--orange3)' : 'var(--text2)' }}
      />

      <Label show={open}>
        <span
          className="ml-3 text-[13px]"
          style={{
            color: active ? 'var(--text)' : 'var(--text2)',
            fontWeight: active ? 600 : 500,
          }}
        >
          {label}
        </span>
      </Label>

      {badge && open && (
        <span
          className="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
          style={{
            background: active ? 'rgba(234,88,12,0.25)' : 'var(--surface3)',
            color: active ? 'var(--orange3)' : 'var(--text2)',
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="fixed left-0 top-0 z-40 h-full flex flex-col"
      style={{
        width: open ? 'var(--sidebar-expanded)' : 'var(--sidebar-collapsed)',
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Brand */}
      <div
        className="relative flex items-center shrink-0 px-3"
        style={{ height: 60, borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="shrink-0 flex items-center justify-center rounded-md font-bold text-[14px] text-white"
          style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-deep) 100%)',
          }}
        >
          i
        </div>
        <Label show={open}>
          <div className="ml-2.5 flex flex-col leading-none">
            <span className="text-[13px] font-semibold text-white tracking-tight">iGEO Marketing</span>
            <span className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>AI Workspace</span>
          </div>
        </Label>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col py-3 gap-0.5 overflow-hidden">
        {NAV_TOP.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            open={open}
          />
        ))}

        <div className="mx-3 my-2.5 divider" />

        {NAV_BOTTOM.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            open={open}
          />
        ))}
      </nav>

      {/* User */}
      <div className="shrink-0 p-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="flex items-center rounded-md px-2 py-2 gap-2.5 cursor-pointer transition-colors group"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div
            className="shrink-0 flex items-center justify-center rounded text-[11px] font-bold text-white"
            style={{
              width: 28, height: 28,
              background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-deep) 100%)',
            }}
          >
            R
          </div>

          <Label show={open}>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12.5px] font-semibold leading-none truncate" style={{ color: 'var(--text)' }}>
                Ramón
              </span>
              <span className="text-[10.5px] mt-1 truncate" style={{ color: 'var(--muted)' }}>
                Editor
              </span>
            </div>
          </Label>

          {open && (
            <LogOut size={12} className="shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted)' }} />
          )}
        </div>
      </div>
    </aside>
  )
}
