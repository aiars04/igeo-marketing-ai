'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const maxWidth = size === 'sm' ? 440 : size === 'lg' ? 720 : size === 'xl' ? 920 : 580
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7), rgba(0,0,0,0.85))',
        backdropFilter: 'blur(10px) saturate(120%)',
        WebkitBackdropFilter: 'blur(10px) saturate(120%)',
      }}
      onMouseDown={e => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="animate-scale-in w-full relative overflow-hidden"
        style={{
          maxWidth,
          background: `
            linear-gradient(180deg, rgba(234,88,12,0.04), transparent 30%),
            var(--surface)
          `,
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: `
            0 32px 96px rgba(0, 0, 0, 0.75),
            0 0 0 1px rgba(255, 246, 235, 0.04),
            0 0 80px rgba(234, 88, 12, 0.08)
          `,
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-7 right-7 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(234,88,12,0.7) 50%, transparent)',
            boxShadow: '0 0 12px rgba(234,88,12,0.5)',
          }}
        />

        {/* Top glow */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60%] h-32 pointer-events-none opacity-50"
          style={{ background: 'radial-gradient(ellipse, rgba(234,88,12,0.4), transparent 70%)' }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 relative"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="min-w-0 flex-1 pr-3">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'var(--orange3)' }}>
              <span className="inline-block w-2.5 h-px mr-1.5 align-middle" style={{ background: 'var(--orange)' }} />
              Detalle
            </div>
            <h2
              className="font-display text-[18px] font-bold tracking-[-0.025em] leading-tight truncate"
              style={{ color: 'var(--text)' }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 transition-all shrink-0"
            style={{ color: 'var(--muted)', border: '1px solid var(--border2)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(234, 88, 12, 0.08)'
              e.currentTarget.style.color = 'var(--orange3)'
              e.currentTarget.style.borderColor = 'var(--border-warm)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.borderColor = 'var(--border2)'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 96px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
