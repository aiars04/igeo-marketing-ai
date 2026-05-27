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
  const maxWidth = size === 'sm' ? 440 : size === 'lg' ? 720 : size === 'xl' ? 880 : 560
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
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="animate-scale-in w-full relative overflow-hidden flex flex-col"
        style={{
          maxWidth,
          background: '#1e1e2e',                              // ← specs
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,                                   // ← specs
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          maxHeight: '88vh',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header — título 18px bold + close con hover */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '20px 28px',                              // ← 28px horizontal
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2
            className="truncate pr-3"
            style={{
              fontSize: 18,                                    // ← specs
              fontWeight: 700,                                 // ← bold
              color: '#ffffff',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md transition-colors shrink-0 flex items-center justify-center"
            style={{
              width: 32, height: 32,
              color: 'rgba(255,255,255,0.55)',
              background: 'transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
            }}
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body — padding 28px */}
        <div
          className="overflow-y-auto flex-1"
          style={{ padding: 28 }}                              // ← specs
        >
          {children}
        </div>
      </div>
    </div>
  )
}
