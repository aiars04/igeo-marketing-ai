'use client'

import { useState, useEffect } from 'react'
import {
  add, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, parse,
  startOfToday, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Flame, RefreshCw, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useContentTypes } from '@/lib/content-types-store'
import type { Channel } from '@/types/database'

/* ─── Types ─── */
export type EventKind = 'acontecimiento' | 'contenido'

export type CalEvent = {
  id: string
  date: string
  kind: EventKind
  title: string

  // Acontecimiento
  dolor?: string
  comunicacion?: string
  estiloComun?: string

  // Contenido programado
  channel?: Channel
  contentTypeId?: string
  frecuencia?: 'once' | 'weekly' | 'biweekly' | 'monthly'
  frecuenciaDias?: string[]   // multi-day for weekly
}

/* ─── Mock data ─── */
const INITIAL_EVENTS: CalEvent[] = [
  { id:'1', date:'2026-05-21', kind:'contenido',      channel:'linkedin',   contentTypeId:'ct_1', frecuencia:'weekly', frecuenciaDias:['lunes','miércoles'],   title:'Post semana — LinkedIn iGEO' },
  { id:'2', date:'2026-05-22', kind:'contenido',      channel:'instagram',  contentTypeId:'ct_2', frecuencia:'weekly', frecuenciaDias:['martes'],  title:'Carrusel semanal Instagram' },
  { id:'3', date:'2026-05-24', kind:'acontecimiento', title:'Feria TECNA Madrid', dolor:'Falta visibilidad en el sector de limpieza industrial', comunicacion:'Post + reels en vivo', estiloComun:'Dinámico y cercano' },
  { id:'4', date:'2026-05-26', kind:'contenido',      channel:'blog',       contentTypeId:'ct_5', frecuencia:'monthly', title:'Artículo: Trazabilidad en legionella' },
  { id:'5', date:'2026-05-28', kind:'contenido',      channel:'newsletter', contentTypeId:'ct_3', frecuencia:'monthly', title:'Newsletter mayo 2026' },
  { id:'6', date:'2026-05-30', kind:'acontecimiento', title:'Visita cliente — Clece Barcelona', dolor:'Gestión de múltiples contratos sin visibilidad', comunicacion:'Case study + post LinkedIn', estiloComun:'Profesional y cercano' },
]

/* ─── Channel colour maps ─── */
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
const CHANNEL_BG: Record<Channel, string> = {
  linkedin:   'rgba(59,130,246,0.08)',
  instagram:  'rgba(236,72,153,0.08)',
  facebook:   'rgba(147,197,253,0.08)',
  x:          'rgba(148,163,184,0.08)',
  blog:       'rgba(52,211,153,0.08)',
  email:      'rgba(251,191,36,0.08)',
  newsletter: 'rgba(167,139,250,0.08)',
}

const CHANNELS: Channel[] = ['linkedin','instagram','facebook','x','blog','email','newsletter']
const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin:'LinkedIn', instagram:'Instagram', facebook:'Facebook',
  x:'X (Twitter)', blog:'Blog', email:'Email', newsletter:'Newsletter',
}

const FRECUENCIA_LABELS: Record<string, string> = {
  once: 'Una vez', weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual',
}
const DIAS_SEMANA = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/* ─── Chip ─── */
function EventChip({ ev }: { ev: CalEvent }) {
  if (ev.kind === 'acontecimiento') {
    return (
      <div
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-full"
        style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(251,191,36,0.20)' }}
      >
        <Flame size={8} className="shrink-0 text-amber-400" />
        <span className="text-[9.5px] font-semibold truncate leading-none text-amber-300">
          {ev.title}
        </span>
      </div>
    )
  }
  const ch = ev.channel!
  return (
    <div
      className="flex items-center gap-1.5 px-1.5 py-1 rounded-full"
      style={{ background: CHANNEL_BG[ch], border: `1px solid ${CHANNEL_BG[ch].replace('0.08', '0.22')}` }}
    >
      <span
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', CHANNEL_DOT[ch])}
        style={{ boxShadow: '0 0 6px currentColor' }}
      />
      {ev.frecuencia && ev.frecuencia !== 'once' && (
        <RefreshCw size={7} className="shrink-0 text-[var(--muted)]" />
      )}
      <span className={cn('text-[9.5px] font-semibold truncate leading-none', CHANNEL_TEXT[ch])}>
        {ev.title}
      </span>
    </div>
  )
}

/* ─── Page ─── */
export default function CalendarPage() {
  const today     = startOfToday()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { types: contentTypes } = useContentTypes()

  const [currentMonth, setCurrentMonth] = useState(format(today, 'MMM-yyyy'))
  const [selectedDay, setSelectedDay]   = useState(today)
  const [events, setEvents]             = useState<CalEvent[]>(INITIAL_EVENTS)
  const [eventsHydrated, setEventsHydrated] = useState(false)

  // localStorage persistence for events
  useEffect(() => {
    try {
      const saved = localStorage.getItem('igeo_cal_events_v1')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) setEvents(parsed)
      }
    } catch {}
    setEventsHydrated(true)
  }, [])
  useEffect(() => {
    if (!eventsHydrated) return
    try { localStorage.setItem('igeo_cal_events_v1', JSON.stringify(events)) } catch {}
  }, [events, eventsHydrated])

  /* ─── Modal state ─── */
  type ModalStep = 'kind-select' | 'form'
  const [modalOpen, setModalOpen]           = useState(false)
  const [modalDate, setModalDate]           = useState('')
  const [modalStep, setModalStep]           = useState<ModalStep>('kind-select')
  const [formKind, setFormKind]             = useState<EventKind>('acontecimiento')

  // Acontecimiento fields
  const [formTitle, setFormTitle]           = useState('')
  const [formDolor, setFormDolor]           = useState('')
  const [formComunicacion, setFormComunicacion] = useState('')
  const [formEstilo, setFormEstilo]         = useState('')

  // Contenido fields
  const [formContentTypeId, setFormContentTypeId] = useState('')
  const [formChannel, setFormChannel]       = useState<Channel>('linkedin')
  const [formFrecuencia, setFormFrecuencia] = useState<'once'|'weekly'|'biweekly'|'monthly'>('weekly')
  const [formFrecuenciaDias, setFormFrecuenciaDias] = useState<string[]>(['lunes'])

  const { items: toasts, show: toast, remove: removeToast } = useToast()

  const firstDay = parse(currentMonth, 'MMM-yyyy', new Date())
  const days = eachDayOfInterval({
    start: startOfWeek(firstDay, { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(firstDay), { weekStartsOn: 1 }),
  })
  const numWeeks = days.length / 7

  const eventsFor = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.date + 'T00:00'), day))

  const openAdd = (date: Date) => {
    setModalDate(format(date, 'yyyy-MM-dd'))
    setModalStep('kind-select')
    setFormTitle('')
    setFormDolor('')
    setFormComunicacion('')
    setFormEstilo('')
    setFormContentTypeId(contentTypes.find(t => t.active)?.id ?? '')
    setFormChannel('linkedin')
    setFormFrecuencia('weekly')
    setFormFrecuenciaDias(['lunes'])
    setModalOpen(true)
  }

  const selectKind = (k: EventKind) => {
    setFormKind(k)
    if (k === 'contenido') {
      const first = contentTypes.find(t => t.active)
      if (first) {
        setFormContentTypeId(first.id)
        setFormChannel(first.channel)
      }
    }
    setModalStep('form')
  }

  // sync channel when content type changes
  useEffect(() => {
    if (!formContentTypeId) return
    const ct = contentTypes.find(t => t.id === formContentTypeId)
    if (ct) setFormChannel(ct.channel)
  }, [formContentTypeId, contentTypes])

  const handleAdd = () => {
    if (!formTitle.trim()) return
    const base = { id: `e_${Date.now()}`, date: modalDate, title: formTitle.trim(), kind: formKind }
    const newEv: CalEvent = formKind === 'acontecimiento'
      ? { ...base, dolor: formDolor.trim() || undefined, comunicacion: formComunicacion.trim() || undefined, estiloComun: formEstilo.trim() || undefined }
      : { ...base, channel: formChannel, contentTypeId: formContentTypeId || undefined, frecuencia: formFrecuencia, frecuenciaDias: formFrecuencia === 'weekly' ? formFrecuenciaDias : undefined }
    setEvents(p => [...p, newEv])
    setModalOpen(false)
    toast(`Evento añadido al calendario`, 'success')
  }

  const modalTitle = modalStep === 'kind-select' ? 'Añadir evento'
    : formKind === 'acontecimiento' ? 'Acontecimiento' : 'Contenido programado'

  const activeTypes = contentTypes.filter(t => t.active)

  return (
    <div className="flex flex-col h-screen">

      {/* ─── Topbar ─── */}
      <div className="topbar shrink-0 gap-4 justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <div className="text-eyebrow mb-1" style={{ color: 'var(--orange3)' }}>
              <span className="inline-block w-3 h-px mr-1.5 align-middle" style={{ background: 'var(--orange)' }} />
              Planificación
            </div>
            <h1 className="font-display text-[22px] font-bold leading-none tracking-[-0.025em] capitalize" style={{ color: 'var(--text)' }}>
              {format(firstDay, 'MMMM yyyy', { locale: es })}
            </h1>
          </div>
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-sm"
            style={{ background: 'rgba(255,246,235,0.025)', border: '1px solid var(--border2)', color: 'var(--text2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--orange3)', boxShadow: '0 0 8px rgba(251,146,60,0.55)' }} />
            <span className="tabular-nums">
              {format(firstDay, "d MMM", { locale: es })} — {format(endOfMonth(firstDay), "d MMM yyyy", { locale: es })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex items-center overflow-hidden rounded-full backdrop-blur-sm"
            style={{ border: '1px solid var(--border2)', background: 'rgba(255,246,235,0.025)' }}
          >
            <button
              onClick={() => setCurrentMonth(format(add(firstDay, { months: -1 }), 'MMM-yyyy'))}
              className="p-2 transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--orange3)'; e.currentTarget.style.background = 'rgba(234,88,12,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'transparent' }}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => { setCurrentMonth(format(today, 'MMM-yyyy')); setSelectedDay(today) }}
              className="px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
              style={{ color: 'var(--text2)', borderLeft: '1px solid var(--border2)', borderRight: '1px solid var(--border2)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--orange3)'; e.currentTarget.style.background = 'rgba(234,88,12,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'transparent' }}
            >
              Hoy
            </button>
            <button
              onClick={() => setCurrentMonth(format(add(firstDay, { months: 1 }), 'MMM-yyyy'))}
              className="p-2 transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--orange3)'; e.currentTarget.style.background = 'rgba(234,88,12,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'transparent' }}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <button className="btn-primary" onClick={() => openAdd(selectedDay)}>
            <Plus size={13} /> Añadir evento
          </button>
        </div>
      </div>

      {/* ─── Week day headers ─── */}
      <div
        className="grid grid-cols-7 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7, 7, 13, 0.45)', backdropFilter: 'blur(10px)' }}
      >
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className="text-center py-2.5 text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: 'var(--muted)', borderRight: i < 6 ? '1px solid var(--border)' : undefined }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ─── Calendar grid ─── */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-7 h-full" style={{ gridTemplateRows: `repeat(${numWeeks}, 1fr)` }}>
          {days.map((day, idx) => {
            const dayEvents     = eventsFor(day)
            const inMonth       = isSameMonth(day, firstDay)
            const isSelectedDay = isSameDay(day, selectedDay)
            const isTodayDay    = isToday(day)
            const isLastCol     = idx % 7 === 6
            return (
              <div
                key={day.toISOString()}
                className="group relative flex flex-col cursor-pointer transition-colors duration-100"
                style={{
                  borderRight:  isLastCol ? 'none' : '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  background: !inMonth ? 'rgba(12,12,22,0.4)' : isSelectedDay ? 'rgba(234,88,12,0.06)' : 'transparent',
                }}
                onClick={() => setSelectedDay(day)}
                onMouseEnter={e => { if (!isSelectedDay) e.currentTarget.style.background = 'rgba(255,246,235,0.025)' }}
                onMouseLeave={e => { e.currentTarget.style.background = !inMonth ? 'rgba(12,12,22,0.4)' : isSelectedDay ? 'rgba(234,88,12,0.06)' : 'transparent' }}
              >
                <header className="flex items-center justify-between px-2 pt-2 pb-1 shrink-0">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setSelectedDay(day); openAdd(day) }}
                    className="flex h-6 w-6 items-center justify-center rounded-full font-display text-[11.5px] font-bold transition-all tabular-nums"
                    style={{
                      color: isTodayDay || isSelectedDay ? 'white' : inMonth ? 'var(--text)' : 'var(--muted)',
                      background: isTodayDay
                        ? 'linear-gradient(135deg, var(--orange2), var(--orange))'
                        : isSelectedDay
                          ? 'rgba(234,88,12,0.35)'
                          : 'transparent',
                      boxShadow: isTodayDay ? '0 0 12px rgba(234,88,12,0.45)' : 'none',
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); setSelectedDay(day); openAdd(day) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all hover:bg-[var(--surface3)]" style={{ color: 'var(--muted)' }} aria-label="Añadir evento">
                    <Plus size={10} />
                  </button>
                </header>

                {isDesktop ? (
                  <div className="flex-1 px-1.5 pb-1.5 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(ev => <EventChip key={ev.id} ev={ev} />)}
                    {dayEvents.length > 2 && (
                      <p className="text-[9px] font-medium px-1" style={{ color: 'var(--muted)' }}>+{dayEvents.length - 2} más</p>
                    )}
                  </div>
                ) : (
                  dayEvents.length > 0 && (
                    <div className="px-1.5 pb-1.5 flex flex-wrap gap-0.5">
                      {dayEvents.map(ev => (
                        <span key={ev.id} className={cn('w-1.5 h-1.5 rounded-full', ev.kind === 'acontecimiento' ? 'bg-amber-400' : CHANNEL_DOT[ev.channel!])} />
                      ))}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Modal ─── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} size="sm">

        {/* Paso 1: elegir tipo */}
        {modalStep === 'kind-select' && (
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Fecha</span>
              <input type="date" className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} value={modalDate} onChange={e => setModalDate(e.target.value)} />
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-2.5" style={{ color: 'var(--muted)' }}>Tipo de evento</span>
              <div className="grid grid-cols-2 gap-3">
                {/* Acontecimiento */}
                <button
                  onClick={() => selectKind('acontecimiento')}
                  className="flex flex-col items-center gap-3 rounded-2xl py-5 px-3 text-left transition-all duration-150 hover:scale-[1.02]"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.4)'; e.currentTarget.style.background = 'rgba(245,158,11,0.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'rgba(245,158,11,0.15)' }}>
                    <Flame size={20} className="text-amber-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-display text-[13px] font-bold tracking-[-0.02em] text-white">Acontecimiento</p>
                    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>Feria, lanzamiento, ponencia, visita…</p>
                  </div>
                </button>

                {/* Contenido programado */}
                <button
                  onClick={() => selectKind('contenido')}
                  className="flex flex-col items-center gap-3 rounded-2xl py-5 px-3 text-left transition-all duration-150 hover:scale-[1.02]"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-warm)'; e.currentTarget.style.background = 'rgba(234,88,12,0.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'rgba(234,88,12,0.15)' }}>
                    <RefreshCw size={20} style={{ color: 'var(--orange3)' }} />
                  </div>
                  <div className="text-center">
                    <p className="font-display text-[13px] font-bold tracking-[-0.02em] text-white">Contenido programado</p>
                    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>Publicación recurrente planificada</p>
                  </div>
                </button>
              </div>
            </div>

            <button className="btn-ghost w-full" onClick={() => setModalOpen(false)}>Cancelar</button>
          </div>
        )}

        {/* Paso 2: formulario */}
        {modalStep === 'form' && (
          <div className="space-y-4">
            {/* Back + badge */}
            <div className="flex items-center gap-2">
              <button onClick={() => setModalStep('kind-select')} className="p-1 rounded-lg transition-colors hover:bg-[var(--surface2)]" style={{ color: 'var(--muted)' }} aria-label="Volver">
                <ArrowLeft size={15} />
              </button>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{
                  background: formKind === 'acontecimiento' ? 'rgba(251,191,36,0.12)' : 'rgba(234,88,12,0.14)',
                  border: `1px solid ${formKind === 'acontecimiento' ? 'rgba(251,191,36,0.28)' : 'rgba(234,88,12,0.30)'}`,
                  color: formKind === 'acontecimiento' ? 'var(--warning)' : 'var(--orange3)',
                }}
              >
                {formKind === 'acontecimiento' ? <Flame size={11} /> : <RefreshCw size={11} />}
                {formKind === 'acontecimiento' ? 'Acontecimiento' : 'Contenido programado'}
              </span>
            </div>

            {/* Fecha */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Fecha</span>
              <input type="date" className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} value={modalDate} onChange={e => setModalDate(e.target.value)} />
            </div>

            {/* ── ACONTECIMIENTO ── */}
            {formKind === 'acontecimiento' && (<>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Nombre del evento</span>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="Ej: Feria TECNA Madrid 2026"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Punto de dolor que ataca <span className="font-normal opacity-60">(opcional)</span></span>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="¿Qué problema del cliente resuelve o comunica este evento?"
                  value={formDolor}
                  onChange={e => setFormDolor(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Cómo se comunica <span className="font-normal opacity-60">(opcional)</span></span>
                <input
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="Ej: Post LinkedIn + reels en vivo"
                  value={formComunicacion}
                  onChange={e => setFormComunicacion(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Estilo de comunicación <span className="font-normal opacity-60">(opcional)</span></span>
                <input
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="Ej: Dinámico, cercano y visual"
                  value={formEstilo}
                  onChange={e => setFormEstilo(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
            </>)}

            {/* ── CONTENIDO PROGRAMADO ── */}
            {formKind === 'contenido' && (<>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Tipo de contenido</span>
                {activeTypes.length > 0 ? (
                  <select
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    value={formContentTypeId}
                    onChange={e => setFormContentTypeId(e.target.value)}
                  >
                    {activeTypes.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[12px] px-3 py-2" style={{ color: 'var(--muted)' }}>
                    No hay tipos activos. Crea uno en{' '}
                    <a href="/admin" className="underline" style={{ color: 'var(--accent2)' }}>Admin</a>.
                  </p>
                )}
              </div>

              {/* Canal — auto de tipo de contenido, pero editable */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Canal</span>
                <select
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  value={formChannel}
                  onChange={e => setFormChannel(e.target.value as Channel)}
                >
                  {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </select>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Título / Tema</span>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="Describe el contenido a publicar…"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--muted)' }}>Frecuencia</span>
                <select
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  value={formFrecuencia}
                  onChange={e => setFormFrecuencia(e.target.value as typeof formFrecuencia)}
                >
                  {Object.entries(FRECUENCIA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {formFrecuencia === 'weekly' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Días de la semana</span>
                    {formFrecuenciaDias.length > 0 && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(234,88,12,0.14)', border: '1px solid rgba(234,88,12,0.30)', color: 'var(--orange3)' }}
                      >
                        {formFrecuenciaDias.length} {formFrecuenciaDias.length === 1 ? 'día' : 'días'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DIAS_SEMANA.map(d => {
                      const active = formFrecuenciaDias.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFormFrecuenciaDias(prev =>
                            active ? prev.filter(x => x !== d) : [...prev, d]
                          )}
                          className="py-1.5 rounded-full text-[11px] font-semibold capitalize transition-all"
                          style={active ? {
                            background: 'linear-gradient(135deg, var(--orange2), var(--orange))',
                            color: 'white',
                            border: '1px solid rgba(253,186,116,0.4)',
                            boxShadow: '0 4px 12px rgba(234,88,12,0.3)',
                          } : {
                            background: 'rgba(255,246,235,0.025)',
                            color: 'var(--text2)',
                            border: '1px solid var(--border2)',
                          }}
                        >
                          {d.slice(0, d === 'miércoles' ? 3 : 3)}
                        </button>
                      )
                    })}
                  </div>
                  {formFrecuenciaDias.length === 0 && (
                    <p className="text-[11px] mt-1.5" style={{ color: 'var(--danger)' }}>Selecciona al menos un día</p>
                  )}
                </div>
              )}
            </>)}

            {(() => {
              const canSubmit = formTitle.trim() &&
                (formKind !== 'contenido' || formFrecuencia !== 'weekly' || formFrecuenciaDias.length > 0)
              return (
                <div className="flex gap-2 pt-1">
                  <button className="btn-ghost flex-1" onClick={() => setModalOpen(false)}>Cancelar</button>
                  <button
                    className="btn-primary flex-1"
                    onClick={handleAdd}
                    disabled={!canSubmit}
                    style={{
                      opacity: canSubmit ? 1 : 0.5,
                      ...(formKind === 'acontecimiento' ? { background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 0 20px rgba(245,158,11,0.2)' } : {}),
                    }}
                  >
                    <Plus size={13} /> Añadir
                  </button>
                </div>
              )
            })()}
          </div>
        )}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
