'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn, CHANNEL_CONFIG } from '@/lib/utils'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import type { Channel } from '@/types/database'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isToday, addMonths, subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

const MOCK_EVENTS = [
  { id:'1', date:'2026-05-21', channel:'linkedin'   as Channel, topic:'ERP para sanidad ambiental' },
  { id:'2', date:'2026-05-22', channel:'instagram'  as Channel, topic:'Carrusel control operativo' },
  { id:'3', date:'2026-05-24', channel:'newsletter' as Channel, topic:'Newsletter mayo 2026' },
  { id:'4', date:'2026-05-26', channel:'blog'       as Channel, topic:'Trazabilidad en legionella' },
  { id:'5', date:'2026-05-28', channel:'linkedin'   as Channel, topic:'Gestión documental' },
  { id:'6', date:'2026-05-28', channel:'x'          as Channel, topic:'Hilo: digitalización' },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const CHANNEL_DOT: Record<Channel, string> = {
  linkedin:   'bg-blue-400',
  instagram:  'bg-pink-400',
  facebook:   'bg-blue-300',
  x:          'bg-slate-400',
  blog:       'bg-emerald-400',
  email:      'bg-amber-400',
  newsletter: 'bg-violet-400',
}

const CHANNEL_TEXT: Record<Channel, string> = {
  linkedin:   'text-blue-400',
  instagram:  'text-pink-400',
  facebook:   'text-blue-300',
  x:          'text-slate-300',
  blog:       'text-emerald-400',
  email:      'text-amber-400',
  newsletter: 'text-violet-400',
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date(2026, 4, 1))

  const days     = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startPad = (getDay(days[0]) + 6) % 7

  const eventsFor = (d: Date) => {
    const iso = format(d, 'yyyy-MM-dd')
    return MOCK_EVENTS.filter(e => e.date === iso)
  }

  return (
    <div className="flex flex-col h-screen">

      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[62px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-bold text-white leading-none">Calendario editorial</h1>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">Planificación mensual de contenido</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Navegación mes */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrent(subMonths(current, 1))}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[var(--surface2)] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold text-white px-2.5 capitalize min-w-[130px] text-center">
              {format(current, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={() => setCurrent(addMonths(current, 1))}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[var(--surface2)] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #1a55a8)',
              boxShadow:  '0 3px 16px rgba(29,111,200,0.3)',
            }}
          >
            <Plus size={13} /> Añadir evento
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Grid días */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map(day => {
            const events = eventsFor(day)
            const today  = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[100px] rounded-xl p-2 transition-all cursor-pointer group',
                  today
                    ? 'bg-[var(--accent)]/8'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface2)]'
                )}
                style={{
                  border: today
                    ? '1px solid rgba(29,111,200,0.4)'
                    : '1px solid var(--border)',
                }}
              >
                {/* Número del día */}
                <div className={cn(
                  'text-[12px] font-bold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full',
                  today
                    ? 'text-white'
                    : 'text-[var(--muted)] group-hover:text-[var(--text)]'
                )}
                style={today ? { background: 'var(--accent)' } : {}}>
                  {format(day, 'd')}
                </div>

                {/* Eventos */}
                <div className="space-y-0.5">
                  {events.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:opacity-90 transition-opacity"
                      style={{ background: 'var(--surface3)' }}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', CHANNEL_DOT[ev.channel])} />
                      <span className={cn('text-[9.5px] font-medium truncate', CHANNEL_TEXT[ev.channel])}>
                        {ev.topic}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
