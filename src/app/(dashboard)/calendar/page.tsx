'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn, CHANNEL_CONFIG } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'

const MOCK_EVENTS = [
  { id:'1', date:'2026-05-21', channel:'linkedin' as const,   topic:'ERP para sanidad ambiental' },
  { id:'2', date:'2026-05-22', channel:'instagram' as const,  topic:'Carrusel control operativo' },
  { id:'3', date:'2026-05-24', channel:'newsletter' as const, topic:'Newsletter mayo 2026' },
  { id:'4', date:'2026-05-26', channel:'blog' as const,       topic:'Trazabilidad en legionella' },
  { id:'5', date:'2026-05-28', channel:'linkedin' as const,   topic:'Gestión documental' },
  { id:'6', date:'2026-05-28', channel:'x' as const,          topic:'Hilo: digitalización' },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date(2026, 4, 1)) // May 2026

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startPad = (getDay(days[0]) + 6) % 7 // Mon=0

  const eventsFor = (d: Date) => {
    const iso = format(d, 'yyyy-MM-dd')
    return MOCK_EVENTS.filter(e => e.date === iso)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Calendario editorial</h1>
          <p className="text-[12px] text-[var(--muted)]">Base de planificación de contenido</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrent(subMonths(current, 1))} className="p-1.5 rounded-lg hover:bg-[var(--surface3)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold text-white px-2 capitalize">
              {format(current, 'MMMM yyyy', { locale: es })}
            </span>
            <button onClick={() => setCurrent(addMonths(current, 1))} className="p-1.5 rounded-lg hover:bg-[var(--surface3)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-[12px] hover:opacity-90 transition-opacity">
            <Plus size={13} /> Añadir evento
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map(day => {
            const events = eventsFor(day)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] rounded-xl border p-2 transition-colors cursor-pointer',
                  today
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border2)] hover:bg-[var(--surface2)]'
                )}
              >
                <div className={cn(
                  'text-[12px] font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full',
                  today ? 'bg-[var(--accent)] text-black' : 'text-[var(--muted)]'
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {events.map(ev => {
                    const ch = CHANNEL_CONFIG[ev.channel]
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5 bg-[var(--surface3)] truncate"
                      >
                        <span>{ch.icon}</span>
                        <span className={cn('truncate', ch.color)}>{ev.topic}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
