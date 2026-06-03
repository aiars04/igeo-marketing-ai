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
      style={{
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onMouseDown={e => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="animate-scale-in w-full relative overflow-hidden flex flex-col"
        style={{
          maxWidth,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          maxHeight: '88vh',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              paddingRight: 12,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="image-menu-trigger"
            aria-label="Cerrar"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div
          className="overflow-y-auto flex-1"
          style={{ padding: 28 }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
