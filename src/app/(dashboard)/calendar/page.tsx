'use client'

import { useEffect, useState } from 'react'
import { EventManager, type Event } from '@/components/ui/event-manager'
import { addPipelineItem, calendarEventToContentItem } from '@/lib/stores/pipeline-store'
import { useToast, Toasts } from '@/components/ui/Toast'

const STORAGE_KEY = 'igeo_cal_events_v2'

// Eventos demo iniciales
const INITIAL_EVENTS: Event[] = [
  {
    id: '1',
    title: 'Post semana — LinkedIn iGEO',
    description: 'Publicación semanal en LinkedIn con casos de éxito',
    startTime: new Date(2026, 4, 21, 9, 0),
    endTime: new Date(2026, 4, 21, 9, 30),
    color: 'blue',
    category: 'Contenido',
    tags: ['Trabajo', 'Equipo'],
  },
  {
    id: '2',
    title: 'Carrusel semanal Instagram',
    description: 'Carrusel con 5 slides — Control operativo',
    startTime: new Date(2026, 4, 22, 10, 0),
    endTime: new Date(2026, 4, 22, 11, 0),
    color: 'pink',
    category: 'Contenido',
    tags: ['Trabajo'],
  },
  {
    id: '3',
    title: 'Feria TECNA Madrid',
    description: 'Stand iGEO en TECNA · Falta visibilidad en limpieza industrial',
    startTime: new Date(2026, 4, 24, 9, 0),
    endTime: new Date(2026, 4, 24, 18, 0),
    color: 'orange',
    category: 'Acontecimiento',
    tags: ['Importante', 'Cliente'],
  },
  {
    id: '4',
    title: 'Artículo: Trazabilidad en legionella',
    description: 'Blog post mensual SEO',
    startTime: new Date(2026, 4, 26, 12, 0),
    endTime: new Date(2026, 4, 26, 13, 0),
    color: 'green',
    category: 'Contenido',
    tags: ['Trabajo'],
  },
  {
    id: '5',
    title: 'Newsletter mayo 2026',
    description: 'Envío mensual de newsletter a clientes',
    startTime: new Date(2026, 4, 28, 11, 0),
    endTime: new Date(2026, 4, 28, 12, 0),
    color: 'purple',
    category: 'Contenido',
    tags: ['Cliente'],
  },
  {
    id: '6',
    title: 'Visita cliente — Clece Barcelona',
    description: 'Reunión gestión de múltiples contratos · Case study',
    startTime: new Date(2026, 4, 30, 10, 0),
    endTime: new Date(2026, 4, 30, 12, 0),
    color: 'red',
    category: 'Reunión',
    tags: ['Importante', 'Cliente'],
  },
]

// Serializar/deserializar Date <-> string
function serialize(events: Event[]) {
  return JSON.stringify(
    events.map(e => ({
      ...e,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
    })),
  )
}

function deserialize(raw: string | null): Event[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.map((e: { startTime: string; endTime: string } & Omit<Event, 'startTime' | 'endTime'>) => ({
      ...e,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
    }))
  } catch {
    return null
  }
}

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS)
  const [hydrated, setHydrated] = useState(false)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // Cargar de localStorage al montar
  useEffect(() => {
    const saved = deserialize(localStorage.getItem(STORAGE_KEY))
    if (saved && saved.length > 0) setEvents(saved)
    setHydrated(true)
  }, [])

  // Persistir cambios
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, serialize(events))
    } catch {}
  }, [events, hydrated])

  return (
    <div
      className="p-4 sm:p-6"
      style={{
        background: 'var(--bg)',
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
      }}
    >
      <div className="mb-4">
        <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: 'var(--ink)',
          lineHeight: 1,
          margin: 0,
        }}>
          Calendario
        </h1>
        <p style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--ink-3)',
          margin: '3px 0 0',
          letterSpacing: '0.01em',
        }}>
          Agente Marketing · iGEO
        </p>
      </div>

      <EventManager
        events={events}
        onEventCreate={(ev) => {
          setEvents(prev => [...prev, ev])
          // Si es evento digital → crear tarjeta en pipeline (fase Ideas)
          if (ev.eventType === 'digital') {
            const item = calendarEventToContentItem(ev)
            addPipelineItem(item)
            showToast('Evento creado · Tarjeta añadida a Pipeline (Ideas)', 'success')
          }
        }}
        onEventUpdate={(id, partial) => {
          setEvents(prev =>
            prev.map(e => (e.id === id ? { ...e, ...partial } : e)),
          )
        }}
        onEventDelete={(id) => {
          setEvents(prev => prev.filter(e => e.id !== id))
        }}
        categories={['Contenido', 'Acontecimiento', 'Reunión', 'Tarea', 'Personal']}
        availableTags={['Importante', 'Urgente', 'Trabajo', 'Cliente', 'Equipo', 'Personal']}
        defaultView="month"
      />

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
