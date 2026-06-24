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
  // Elemento que tenía el foco antes de abrir, para restaurarlo al cerrar.
  const prevFocusRef = useRef<HTMLElement | null>(null)

  // Escape para cerrar.
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Gestión de foco (WAI-ARIA dialog): al abrir, guardar el foco previo y
  // moverlo al panel; al cerrar/desmontar, restaurarlo. Además, focus trap:
  // Tab no se escapa del modal.
  useEffect(() => {
    if (!open) return
    prevFocusRef.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    // Mover el foco al primer elemento enfocable (o al panel) al abrir.
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
    ;(focusables[0] ?? panel)?.focus?.()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null) // visibles
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) { e.preventDefault(); last.focus() }
      } else {
        if (active === last || !panel.contains(active)) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => {
      window.removeEventListener('keydown', handleTab)
      // Restaurar el foco al elemento que lo tenía antes de abrir.
      prevFocusRef.current?.focus?.()
    }
  }, [open])

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
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
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
          className="flex items-center justify-between shrink-0 gap-3"
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2
            title={title}
            className="min-w-0"
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
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="image-menu-trigger shrink-0"
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
