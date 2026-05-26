'use client'

import { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastData {
  id: string
  message: string
  kind: ToastKind
}

export function useToast() {
  const [items, setItems] = useState<ToastData[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setItems(prev => [...prev, { id, message, kind }])
  }, [])

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  return { items, show, remove }
}

const KIND_CONFIG: Record<ToastKind, {
  borderColor: string
  icon: React.ReactNode
}> = {
  success: {
    borderColor: '#10b981',
    icon: <CheckCircle2 size={15} style={{ color: '#10b981' }} />,
  },
  error: {
    borderColor: '#f43f5e',
    icon: <AlertCircle size={15} style={{ color: '#f43f5e' }} />,
  },
  info: {
    borderColor: '#38bdf8',
    icon: <Info size={15} style={{ color: '#38bdf8' }} />,
  },
}

function ToastItem({ toast, remove }: { toast: ToastData; remove: (id: string) => void }) {
  const cfg = KIND_CONFIG[toast.kind]

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), 3200)
    return () => clearTimeout(timer)
  }, [toast.id, remove])

  return (
    <div
      className="animate-fade-in flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderLeft: `3px solid ${cfg.borderColor}`,
        color: 'var(--text)',
        minWidth: 260,
        maxWidth: 380,
      }}
    >
      <span className="flex-shrink-0">{cfg.icon}</span>
      <span className="flex-1 text-[13px] leading-snug">{toast.message}</span>
      <button
        onClick={() => remove(toast.id)}
        className="flex-shrink-0 rounded-md p-0.5 transition-colors hover:bg-white/10"
        style={{ color: 'var(--muted)' }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function Toasts({ items, remove }: { items: ToastData[]; remove: (id: string) => void }) {
  if (items.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end">
      {items.map(t => (
        <ToastItem key={t.id} toast={t} remove={remove} />
      ))}
    </div>
  )
}
