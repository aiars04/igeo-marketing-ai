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
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
          background: 'var(--surface)',
          border: '1px solid var(--line2)',
          borderRadius: 'var(--r-lg)',
          boxShadow:
            '0 1px 0 rgba(255, 235, 215, 0.04) inset, 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(234, 88, 12, 0.06)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Top accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, var(--orange), var(--orange-3) 30%, transparent 70%)',
          }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 gap-3"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] mb-1.5" style={{ color: 'var(--orange-3)' }}>
              — Detalle
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight truncate" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 transition-colors shrink-0"
            style={{ color: 'var(--muted)', border: '1px solid var(--line2)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.borderColor = 'var(--line3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--muted)'
              e.currentTarget.style.borderColor = 'var(--line2)'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
