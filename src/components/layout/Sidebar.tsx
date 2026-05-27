'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Calendar, Lightbulb, Image,
  Settings, BarChart3, LogOut, BookOpen,
} from 'lucide-react'

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
      className="relative flex items-center h-8 rounded-md transition-colors mx-2 px-2"
      style={{
        background: active ? 'rgba(234,88,12,0.10)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'var(--surface2)'
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {active && (
        <motion.span
          layoutId="nav-active-bar"
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r"
          style={{ background: 'var(--orange)', boxShadow: '0 0 8px rgba(234,88,12,0.5)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      <Icon
        size={14}
        strokeWidth={active ? 2.4 : 1.8}
        className="shrink-0"
        style={{ color: active ? 'var(--orange-3)' : 'var(--text2)' }}
      />

      <Label show={open}>
        <span
          className="ml-2.5 text-[12.5px] tracking-tight"
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
          className="ml-auto shrink-0 font-mono text-[9.5px] font-bold px-1.5 rounded tabular-nums"
          style={{
            background: active ? 'rgba(234,88,12,0.22)' : 'var(--surface3)',
            color: active ? 'var(--orange-3)' : 'var(--text2)',
            border: active ? '1px solid rgba(234,88,12,0.35)' : '1px solid var(--line2)',
            lineHeight: '16px',
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
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg-soft) 100%)',
        borderRight: '1px solid var(--line)',
      }}
    >
      {/* Brand */}
      <div
        className="relative flex items-center shrink-0 px-3"
        style={{ height: 56, borderBottom: '1px solid var(--line)' }}
      >
        <div
          className="shrink-0 flex items-center justify-center rounded text-[13px] font-bold text-white relative overflow-hidden"
          style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, var(--orange-2) 0%, var(--orange-deep) 100%)',
            boxShadow: '0 0 0 1px rgba(253,186,116,0.30), 0 0 14px rgba(234,88,12,0.30)',
          }}
        >
          <span>i</span>
        </div>
        <Label show={open}>
          <div className="ml-2.5 flex flex-col leading-none">
            <span className="text-[12.5px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              iGEO <span className="font-serif italic" style={{ color: 'var(--orange-3)' }}>Marketing</span>
            </span>
            <span className="font-mono text-[9px] mt-1 uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
              AI · Workspace
            </span>
          </div>
        </Label>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col py-3 gap-0.5 overflow-hidden">
        {open && (
          <div className="px-4 pb-2 pt-1">
            <span className="font-mono text-[9px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              — Workspace
            </span>
          </div>
        )}
        {NAV_TOP.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            open={open}
          />
        ))}

        <div className="mx-4 my-2 divider" />

        {open && (
          <div className="px-4 pb-2 pt-1">
            <span className="font-mono text-[9px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              — System
            </span>
          </div>
        )}
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
      <div className="shrink-0 p-2" style={{ borderTop: '1px solid var(--line)' }}>
        <div
          className="flex items-center rounded-md px-2 py-2 gap-2.5 cursor-pointer transition-colors group"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <div
            className="shrink-0 flex items-center justify-center rounded text-[11px] font-bold text-white"
            style={{
              width: 26, height: 26,
              background: 'linear-gradient(135deg, var(--orange-2) 0%, var(--orange-deep) 100%)',
              boxShadow: '0 0 0 1px rgba(253,186,116,0.30)',
            }}
          >
            R
          </div>

          <Label show={open}>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] font-semibold leading-none truncate" style={{ color: 'var(--text)' }}>
                Ramón
              </span>
              <span className="font-mono text-[9px] mt-1 uppercase tracking-wider truncate" style={{ color: 'var(--muted)' }}>
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
