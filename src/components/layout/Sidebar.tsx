'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Calendar, Lightbulb, Image,
  Settings, BarChart3, LogOut, BookOpen, Sparkles, ChevronRight,
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
          initial={{ opacity: 0, x: -6, width: 0 }}
          animate={{ opacity: 1, x: 0, width: 'auto' }}
          exit={{ opacity: 0, x: -6, width: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden whitespace-nowrap flex-1 min-w-0"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/* ─── Section label ─── */
function SectionLabel({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden px-3 pb-1.5 pt-2"
        >
          <span
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: 'var(--muted)' }}
          >
            {children}
          </span>
        </motion.div>
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
      className="relative flex items-center h-10 rounded-xl overflow-hidden transition-all duration-150 group mx-2"
      style={{
        paddingLeft: 12,
        paddingRight: open ? 12 : 12,
        background: active
          ? 'linear-gradient(90deg, rgba(234,88,12,0.16) 0%, rgba(234,88,12,0.04) 100%)'
          : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = 'rgba(255, 246, 235, 0.04)'
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Orange left bar for active */}
      {active && (
        <motion.span
          layoutId="nav-active-bar"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
          style={{
            background: 'linear-gradient(180deg, var(--orange3), var(--orange))',
            boxShadow: '0 0 12px rgba(234,88,12,0.6)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      {/* Icon container */}
      <span
        className="shrink-0 flex items-center justify-center rounded-lg transition-all duration-150"
        style={{
          width: 26, height: 26,
          background: active ? 'rgba(234,88,12,0.18)' : 'transparent',
          border: active ? '1px solid rgba(234,88,12,0.30)' : '1px solid transparent',
        }}
      >
        <Icon
          size={14}
          strokeWidth={active ? 2.4 : 1.8}
          style={{ color: active ? 'var(--orange3)' : 'var(--text2)' }}
        />
      </span>

      {/* Label */}
      <Label show={open}>
        <span
          className="ml-3 text-[13px] tracking-[-0.005em] transition-colors"
          style={{
            color: active ? 'var(--text)' : 'var(--text2)',
            fontWeight: active ? 600 : 500,
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
          className="ml-auto shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
          style={{
            background: active ? 'rgba(234,88,12,0.28)' : 'rgba(255, 246, 235, 0.06)',
            color: active ? 'var(--orange3)' : 'var(--text2)',
            border: active ? '1px solid rgba(234,88,12,0.4)' : '1px solid var(--border)',
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
        transition: 'width 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        background: 'linear-gradient(180deg, #0d0d1a 0%, #0a0a14 100%)',
        borderRight: '1px solid var(--border2)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* ── Top warm glow ── */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(234,88,12,0.10) 0%, transparent 65%)' }}
      />
      {/* ── Right edge highlight ── */}
      <div
        className="absolute top-0 right-0 bottom-0 w-px pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(234,88,12,0.18) 50%, transparent)' }}
      />

      {/* ── Brand ── */}
      <div
        className="relative flex items-center shrink-0 overflow-hidden"
        style={{ height: 72, paddingLeft: 16, borderBottom: '1px solid var(--border)' }}
      >
        {/* iGEO monogram */}
        <div
          className="shrink-0 flex items-center justify-center rounded-xl font-bold text-[15px] relative overflow-hidden"
          style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #2d1106 0%, #0a0a14 100%)',
            border: '1px solid rgba(234,88,12,0.4)',
            boxShadow: '0 0 24px rgba(234,88,12,0.32), 0 1px 0 rgba(255,255,255,0.08) inset',
          }}
        >
          <span className="font-display" style={{ color: 'var(--orange3)' }}>i</span>
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(253,186,116,0.25) 0%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Wordmark */}
        <Label show={open}>
          <div className="ml-3 flex flex-col leading-none">
            <div className="flex items-baseline gap-0.5 font-display">
              <span className="text-[16px] font-extrabold tracking-[-0.04em]" style={{ color: 'var(--orange3)' }}>i</span>
              <span className="text-[16px] font-bold text-white tracking-[-0.04em]">GEO</span>
              <span className="text-[10px] font-medium ml-1.5 tracking-wider" style={{ color: 'var(--muted)' }}>ERP</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Sparkles size={8} style={{ color: 'var(--orange2)' }} />
              <span
                className="text-[8.5px] font-bold tracking-[0.18em] uppercase"
                style={{ color: 'var(--orange3)' }}
              >
                Marketing AI
              </span>
            </div>
          </div>
        </Label>
      </div>

      {/* ── Main nav ── */}
      <nav className="relative flex-1 flex flex-col pt-2 gap-0.5 overflow-hidden">
        <SectionLabel show={open}>Workspace</SectionLabel>
        {NAV_TOP.map(item => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            open={open}
          />
        ))}

        {/* Divider */}
        <div className="mx-4 my-3 divider-gradient" />

        <SectionLabel show={open}>System</SectionLabel>
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
        className="relative shrink-0 p-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center rounded-xl px-2.5 py-2.5 gap-3 cursor-pointer transition-all overflow-hidden group"
          style={{
            background: 'rgba(255, 246, 235, 0.02)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(234, 88, 12, 0.06)'
            e.currentTarget.style.borderColor = 'var(--border-warm)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 246, 235, 0.02)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          {/* Avatar */}
          <div
            className="shrink-0 flex items-center justify-center rounded-lg text-[12px] font-bold text-white relative"
            style={{
              width: 30, height: 30,
              background: 'linear-gradient(135deg, var(--orange2) 0%, var(--orange-deep) 100%)',
              boxShadow: '0 4px 12px rgba(234,88,12,0.4), 0 1px 0 rgba(255,255,255,0.15) inset',
            }}
          >
            R
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: 'var(--success)', border: '2px solid var(--surface)' }}
            />
          </div>

          <Label show={open}>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-[12.5px] font-semibold leading-none truncate"
                style={{ color: 'var(--text)' }}
              >
                Ramón
              </span>
              <span
                className="text-[10px] mt-1 truncate tracking-wide"
                style={{ color: 'var(--muted)' }}
              >
                Editor · iGEO
              </span>
            </div>
          </Label>

          {open && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <LogOut size={13} style={{ color: 'var(--muted)' }} />
            </motion.div>
          )}
        </div>
      </div>
    </aside>
  )
}
