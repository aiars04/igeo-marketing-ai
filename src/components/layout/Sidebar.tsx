'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Calendar, Lightbulb, Image,
  Settings, BarChart3, LogOut, BookOpen, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Nav config ─── */
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

/* ─── Animated label ─── */
function Label({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0, x: -4, width: 0 }}
          animate={{ opacity: 1, x: 0, width: 'auto' }}
          exit={{ opacity: 0, x: -4, width: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden whitespace-nowrap flex-1 min-w-0"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/* ─── Nav item ─── */
function NavItem({
  href, icon: Icon, label, badge, active, open,
}: {
  href: string; icon: React.ElementType; label: string
  badge: string | null; active: boolean; open: boolean
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center h-9 rounded-xl overflow-hidden transition-all duration-150 group"
      style={{
        paddingLeft: 10,
        paddingRight: open ? 10 : 10,
        background: active ? 'rgba(234,88,12,0.10)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Orange left bar for active */}
      {active && (
        <motion.span
          layoutId="nav-active-bar"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
          style={{ background: 'linear-gradient(180deg, #f97316, #ea580c)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      {/* Icon */}
      <Icon
        size={16}
        strokeWidth={active ? 2.5 : 1.8}
        className="shrink-0 transition-colors duration-150"
        style={{ color: active ? '#f97316' : 'var(--muted)' }}
      />

      {/* Label */}
      <Label show={open}>
        <span
          className="ml-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors"
          style={{
            color: active ? 'var(--text)' : 'var(--text2)',
          }}
        >
          {label}
        </span>
      </Label>

      {/* Badge */}
      {badge && open && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="ml-auto shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            background: active ? 'rgba(234,88,12,0.25)' : 'rgba(255,255,255,0.08)',
            color: active ? '#fb923c' : 'var(--text2)',
          }}
        >
          {badge}
        </motion.span>
      )}
    </Link>
  )
}

/* ─── Sidebar ─── */
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
      {/* ── Top glow ── */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(234,88,12,0.06) 0%, transparent 100%)' }}
      />

      {/* ── Brand ── */}
      <div
        className="relative flex items-center shrink-0 overflow-hidden"
        style={{ height: 62, paddingLeft: 14, borderBottom: '1px solid var(--border)' }}
      >
        {/* iGEO monogram */}
        <div
          className="shrink-0 flex items-center justify-center rounded-xl font-bold text-[14px] relative overflow-hidden"
          style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #1a0a04 0%, #2d1106 100%)',
            border: '1px solid rgba(234,88,12,0.25)',
            boxShadow: '0 0 16px rgba(234,88,12,0.18)',
          }}
        >
          <span style={{ color: '#ea580c' }}>i</span>
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(234,88,12,0.15) 0%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Wordmark */}
        <Label show={open}>
          <div className="ml-3 flex flex-col leading-none">
            <div
              className="flex items-baseline gap-0.5 font-display"
            >
              <span className="text-[14px] font-800 tracking-tight" style={{ color: '#ea580c' }}>i</span>
              <span className="text-[14px] font-700 text-white tracking-tight">GEO</span>
              <span className="text-[11px] font-500 ml-1" style={{ color: 'var(--muted)' }}>ERP</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Zap size={8} style={{ color: '#f97316' }} />
              <span
                className="text-[9px] font-bold tracking-[0.12em] uppercase"
                style={{ color: '#f97316' }}
              >
                Marketing AI
              </span>
            </div>
          </div>
        </Label>
      </div>

      {/* ── Main nav ── */}
      <nav className="relative flex-1 flex flex-col px-2 pt-3 gap-0.5 overflow-hidden">
        {NAV_TOP.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            open={open}
          />
        ))}

        {/* Divider */}
        <div className="mx-2 my-2" style={{ height: 1, background: 'var(--border)' }} />

        {NAV_BOTTOM.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            open={open}
          />
        ))}
      </nav>

      {/* ── User section ── */}
      <div
        className="relative shrink-0 px-2 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center rounded-xl px-2 py-2 gap-2.5 cursor-pointer transition-colors overflow-hidden"
          style={{ background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          {/* Avatar */}
          <div
            className="shrink-0 flex items-center justify-center rounded-lg text-[11px] font-bold text-white"
            style={{
              width: 28, height: 28,
              background: 'linear-gradient(135deg, var(--orange) 0%, #9a3412 100%)',
              boxShadow: '0 2px 8px rgba(234,88,12,0.35)',
            }}
          >
            R
          </div>

          <Label show={open}>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-[12px] font-semibold leading-none truncate"
                style={{ color: 'var(--text)' }}
              >
                Ramón
              </span>
              <span
                className="text-[10px] mt-0.5 truncate"
                style={{ color: 'var(--muted)' }}
              >
                Editor
              </span>
            </div>
          </Label>

          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="shrink-0 ml-auto"
            >
              <LogOut size={12} style={{ color: 'var(--muted)' }} />
            </motion.div>
          )}
        </div>
      </div>
    </aside>
  )
}
