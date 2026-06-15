"use client"

import { useState, useCallback, useMemo, useEffect, useRef, Fragment } from "react"
import { createPortal } from "react-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Calendar,
  Clock,
  Grid3x3,
  List,
  Search,
  Filter,
  X,
  CalendarDays,
  Megaphone,
  MapPin,
  Upload,
  Download,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface Event {
  id: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  color: string
  category?: string
  attendees?: string[]
  tags?: string[]
  allDay?: boolean

  // Nuevos campos: tipo de evento + específicos
  eventType?: 'presential' | 'digital'
  // Presencial:
  location?: string
  // Digital:
  channel?: string
  market?: string
}

// Tipo de evento + opciones por categoría
const PRESENTIAL_KINDS = ['Feria', 'Congreso', 'Visita cliente', 'Otro'] as const
// Canales digitales — valores en lowercase (matchean el enum Channel del backend).
// Labels capitalizados se aplican solo al renderizar en la UI vía DIGITAL_CHANNEL_LABEL.
const DIGITAL_CHANNELS = ['linkedin', 'instagram', 'newsletter', 'blog', 'x', 'facebook'] as const
const DIGITAL_CHANNEL_LABEL: Record<typeof DIGITAL_CHANNELS[number], string> = {
  linkedin:   'LinkedIn',
  instagram:  'Instagram',
  newsletter: 'Newsletter',
  blog:       'Blog',
  x:          'X',
  facebook:   'Facebook',
}
// Labels limpios sin emojis de bandera (en Windows no se renderizan).
const DIGITAL_MARKETS = [
  { value: 'spain',    label: 'España'        },
  { value: 'uk',       label: 'Internacional' },
  { value: 'latam',    label: 'LATAM'         },
  { value: 'france',   label: 'Francia'       },
  { value: 'portugal', label: 'Portugal'      },
] as const
const COLOR_KEYS = ['blue', 'green', 'purple', 'orange', 'pink', 'red'] as const

// Color automático según canal digital
const CHANNEL_TO_COLOR: Record<string, string> = {
  linkedin:   'blue',
  instagram:  'pink',
  newsletter: 'green',
  blog:       'orange',
  x:          'purple',
  facebook:   'blue',
}

/** Detecta el tipo de evento al editar uno existente. */
function detectEventType(ev: Event | null): 'presential' | 'digital' | null {
  if (!ev) return null
  if (ev.eventType) return ev.eventType
  if (ev.channel) return 'digital'
  if (ev.location) return 'presential'
  if (ev.category === 'Acontecimiento' || ev.category === 'Reunión') return 'presential'
  if (ev.category === 'Contenido') return 'digital'
  return null
}

// Estilo común para labels de campos del modal
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--ink-2)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={fieldLabelStyle}>
        {label}
        {optional && (
          <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--ink-3)', letterSpacing: 0, marginLeft: 6 }}>
            (opcional)
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={onChange}
        className="input"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          paddingRight: 32,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--ink-3)',
        }}
      />
    </div>
  )
}

// Definición mínima de un Playbook desde el punto de vista del calendario.
// El componente es genérico; quien lo monta carga la lista y maneja la instanciación.
export interface PlaybookSummary {
  id:           string
  name:         string
  type:         string
  description:  string | null
}

export interface EventManagerProps {
  events?: Event[]
  onEventCreate?: (event: Event) => void
  onEventUpdate?: (id: string, event: Partial<Event>) => void
  onEventDelete?: (id: string) => void
  categories?: string[]
  colors?: { name: string; value: string; bg: string; text: string }[]
  defaultView?: "month" | "week" | "day" | "list"
  className?: string
  availableTags?: string[]
  onImportCSV?: (file: File) => void
  onDownloadTemplate?: () => void
  /** Lista de playbooks activos que aparecen como opción primaria en el creador. */
  playbooks?: PlaybookSummary[]
  /** Markets disponibles para instanciar un playbook. Si vacío, no se pide market. */
  playbookMarkets?: Array<{ value: string; label: string }>
  /**
   * Instancia un playbook en una fecha. Devuelve ok=true si se creó.
   * El padre se encarga de POST a /api/playbooks/[id]/instantiate y de refrescar eventos.
   */
  onPlaybookInstantiate?: (
    playbookId: string,
    payload: { title: string; anchor_date: string; market?: string; objective?: string }
  ) => Promise<{ ok: boolean; error?: string }>
}

// Paleta Apple system colors apagada para las píldoras de evento.
// Orden por gama del espectro para que el dropdown se navegue intuitivamente.
const defaultColors = [
  { name: "Rojo",     value: "red",    bg: "bg-[#ff3b30]", text: "text-[#c0392b]" },
  { name: "Naranja",  value: "orange", bg: "bg-[#ff9f0a]", text: "text-[#b25000]" },
  { name: "Amarillo", value: "yellow", bg: "bg-[#ffcc00]", text: "text-[#8a6d00]" },
  { name: "Verde",    value: "green",  bg: "bg-[#34c759]", text: "text-[#1a7a36]" },
  { name: "Menta",    value: "mint",   bg: "bg-[#00c7be]", text: "text-[#008a83]" },
  { name: "Verde-azulado", value: "teal", bg: "bg-[#30b0c7]", text: "text-[#1f7a8c]" },
  { name: "Cian",     value: "cyan",   bg: "bg-[#32ade6]", text: "text-[#1e7da8]" },
  { name: "Azul",     value: "blue",   bg: "bg-[#0071e3]", text: "text-[#0055b3]" },
  { name: "Índigo",   value: "indigo", bg: "bg-[#5856d6]", text: "text-[#3b3a99]" },
  { name: "Morado",   value: "purple", bg: "bg-[#af52de]", text: "text-[#7b2fa8]" },
  { name: "Rosa",     value: "pink",   bg: "bg-[#e8388c]", text: "text-[#c0245a]" },
  { name: "Marrón",   value: "brown",  bg: "bg-[#a2845e]", text: "text-[#6e5b40]" },
]

// Estilos apagados (background+text) usados en EventCard — un par por cada
// color de la paleta. Soft background (alpha 0.10-0.12) + texto oscuro.
const EVENT_STYLES: Record<string, { bg: string; text: string }> = {
  red:    { bg: "var(--red-soft)",          text: "var(--red-2)"   },
  orange: { bg: "var(--amber-soft)",        text: "var(--amber-2)" },
  yellow: { bg: "rgba(255, 204, 0, 0.14)",  text: "#8a6d00" },
  green:  { bg: "var(--green-soft)",        text: "var(--green-2)" },
  mint:   { bg: "rgba(0, 199, 190, 0.12)",  text: "#008a83" },
  teal:   { bg: "rgba(48, 176, 199, 0.12)", text: "#1f7a8c" },
  cyan:   { bg: "rgba(50, 173, 230, 0.12)", text: "#1e7da8" },
  blue:   { bg: "var(--accent-soft)",       text: "var(--accent)"  },
  indigo: { bg: "rgba(88, 86, 214, 0.12)",  text: "#3b3a99" },
  purple: { bg: "rgba(175, 82, 222, 0.10)", text: "#7b2fa8" },
  pink:   { bg: "rgba(232, 56, 140, 0.10)", text: "#c0245a" },
  brown:  { bg: "rgba(162, 132, 94, 0.14)", text: "#6e5b40" },
}

export function EventManager({
  events = [],
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  categories = ["Reunión", "Tarea", "Recordatorio", "Personal"],
  colors = defaultColors,
  defaultView = "month",
  onImportCSV,
  onDownloadTemplate,
  className,
  availableTags = ["Importante", "Urgente", "Trabajo", "Personal", "Equipo", "Cliente"],
  playbooks = [],
  playbookMarkets = [],
  onPlaybookInstantiate,
}: EventManagerProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "day" | "list">(defaultView)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [eventType, setEventType] = useState<'presential' | 'digital' | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null)
  // Flujo de creación desde playbook — null = no estamos en flujo playbook.
  const [playbookFlow, setPlaybookFlow] = useState<{
    playbook: PlaybookSummary
    anchorDate: Date
    title: string
    market: string
    objective: string
    submitting: boolean
    error: string | null
  } | null>(null)
  // Cuando el usuario hace click en día/slot pero aún no eligió tipo, mostramos
  // primero el selector (playbooks + Personalizado) si hay playbooks disponibles.
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
  const [allDay, setAllDay] = useState(false)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: "",
    description: "",
    color: colors[0].value,
    tags: [],
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          event.title.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.category?.toLowerCase().includes(query) ||
          event.tags?.some((tag) => tag.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }
      if (selectedColors.length > 0 && !selectedColors.includes(event.color)) return false
      if (selectedTags.length > 0) {
        const hasMatchingTag = event.tags?.some((tag) => selectedTags.includes(tag))
        if (!hasMatchingTag) return false
      }
      if (selectedCategories.length > 0 && event.category && !selectedCategories.includes(event.category))
        return false
      return true
    })
  }, [events, searchQuery, selectedColors, selectedTags, selectedCategories])

  const hasActiveFilters =
    selectedColors.length > 0 || selectedTags.length > 0 || selectedCategories.length > 0

  const clearFilters = () => {
    setSelectedColors([])
    setSelectedTags([])
    setSelectedCategories([])
    setSearchQuery("")
  }

  // Sincronizar allDay cuando se abre el modal (creación o edición).
  // Mirror de external state legítimo — el modal se abre por evento del usuario.
  useEffect(() => {
    if (!isDialogOpen) return
    const next = isCreating ? false : (selectedEvent?.allDay ?? false)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllDay(prev => (prev === next ? prev : next))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen])

  const handleCreateEvent = useCallback(() => {
    if (!eventType || !newEvent.title || !newEvent.startTime) return
    if (!allDay && !newEvent.endTime) return

    const isAllDay = eventType === 'presential' && allDay
    const startTime = isAllDay
      ? new Date(new Date(newEvent.startTime).setHours(0, 0, 0, 0))
      : newEvent.startTime
    const endBase = isAllDay
      ? (newEvent.endTime ?? newEvent.startTime) // fin opcional → mismo día
      : newEvent.endTime!
    const endTime = isAllDay
      ? new Date(new Date(endBase).setHours(23, 59, 59, 999))
      : endBase

    const event: Event = {
      id: Math.random().toString(36).substr(2, 9),
      title: newEvent.title,
      description: newEvent.description,
      startTime,
      endTime,
      color: newEvent.color || colors[0].value,
      category: newEvent.category,
      attendees: newEvent.attendees,
      tags: newEvent.tags || [],
      allDay: isAllDay || undefined,
      eventType,
      location: eventType === 'presential' ? newEvent.location : undefined,
      channel:  eventType === 'digital'    ? newEvent.channel  : undefined,
      market:   eventType === 'digital'    ? newEvent.market   : undefined,
    }
    onEventCreate?.(event)
    setIsDialogOpen(false)
    setIsCreating(false)
    setEventType(null)
    setAllDay(false)
    setNewEvent({
      title: "",
      description: "",
      color: colors[0].value,
      tags: [],
    })
  }, [newEvent, eventType, allDay, colors, onEventCreate])

  const handleUpdateEvent = useCallback(() => {
    if (!selectedEvent) return
    const isAllDay = selectedEvent.eventType === 'presential' && allDay
    const patched: Event = isAllDay
      ? {
          ...selectedEvent,
          allDay: true,
          startTime: new Date(new Date(selectedEvent.startTime).setHours(0, 0, 0, 0)),
          endTime: new Date(
            new Date(selectedEvent.endTime ?? selectedEvent.startTime).setHours(23, 59, 59, 999),
          ),
        }
      : { ...selectedEvent, allDay: undefined }
    onEventUpdate?.(patched.id, patched)
    setIsDialogOpen(false)
    setSelectedEvent(null)
    setEventType(null)
    setAllDay(false)
  }, [selectedEvent, allDay, onEventUpdate])

  const handleDeleteEvent = useCallback(
    (id: string) => {
      onEventDelete?.(id)
      setIsDialogOpen(false)
      setIsCreating(false)
      setSelectedEvent(null)
      setEventType(null)
      setAllDay(false)
    },
    [onEventDelete],
  )

  const handleDragStart = useCallback((event: Event) => setDraggedEvent(event), [])
  const handleDragEnd = useCallback(() => setDraggedEvent(null), [])

  const handleDrop = useCallback(
    (date: Date, hour?: number) => {
      if (!draggedEvent) return
      const duration = draggedEvent.endTime.getTime() - draggedEvent.startTime.getTime()
      const newStartTime = new Date(date)
      if (hour !== undefined) newStartTime.setHours(hour, 0, 0, 0)
      const newEndTime = new Date(newStartTime.getTime() + duration)
      const updatedEvent = { ...draggedEvent, startTime: newStartTime, endTime: newEndTime }
      onEventUpdate?.(draggedEvent.id, updatedEvent)
      setDraggedEvent(null)
    },
    [draggedEvent, onEventUpdate],
  )

  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const newDate = new Date(prev)
        if (view === "month") newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1))
        else if (view === "week") newDate.setDate(prev.getDate() + (direction === "next" ? 7 : -7))
        else if (view === "day") newDate.setDate(prev.getDate() + (direction === "next" ? 1 : -1))
        return newDate
      })
    },
    [view],
  )

  const getColorClasses = useCallback(
    (colorValue: string) => {
      const color = colors.find((c) => c.value === colorValue)
      return color || colors[0]
    },
    [colors],
  )

  const toggleTag = (tag: string, isCreating: boolean) => {
    if (isCreating) {
      setNewEvent((prev) => ({
        ...prev,
        tags: prev.tags?.includes(tag)
          ? prev.tags.filter((t) => t !== tag)
          : [...(prev.tags || []), tag],
      }))
    } else {
      setSelectedEvent((prev) =>
        prev
          ? {
              ...prev,
              tags: prev.tags?.includes(tag)
                ? prev.tags.filter((t) => t !== tag)
                : [...(prev.tags || []), tag],
            }
          : null,
      )
    }
  }

  // ── Form data helpers para el modal ──
  const formData: Partial<Event> = isCreating ? newEvent : (selectedEvent ?? {})
  const updateField = (patch: Partial<Event>) => {
    if (isCreating) setNewEvent(prev => ({ ...prev, ...patch }))
    else setSelectedEvent(prev => prev ? { ...prev, ...patch } : null)
  }
  const closeDialog = () => {
    setIsDialogOpen(false)
    setIsCreating(false)
    setSelectedEvent(null)
    setEventType(null)
    setAllDay(false)
    setPlaybookFlow(null)
    setCustomPickerOpen(false)
  }

  /**
   * Abre el modal de creación pre-cargando una fecha (y opcionalmente una hora).
   * Si hay playbooks disponibles, deja al usuario en el selector inicial
   * (lista de playbooks + "Personalizado"). Si no hay playbooks, salta directamente
   * al selector legacy (presencial / digital).
   */
  const openCreateAt = (date: Date, hour?: number) => {
    const start = new Date(date)
    if (typeof hour === 'number') start.setHours(hour, 0, 0, 0)
    else start.setHours(12, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setSelectedEvent(null)
    setIsCreating(true)
    setEventType(null)
    setPlaybookFlow(null)
    setCustomPickerOpen(false)
    setAllDay(false)
    setNewEvent({
      title: "",
      description: "",
      color: colors[0].value,
      tags: [],
      startTime: start,
      endTime: end,
    })
    setIsDialogOpen(true)
  }

  /** Maneja la selección de un playbook del listado. */
  const selectPlaybook = (pb: PlaybookSummary, anchorDate: Date) => {
    setPlaybookFlow({
      playbook: pb,
      anchorDate,
      title: pb.name,
      market: playbookMarkets[0]?.value ?? '',
      objective: '',
      submitting: false,
      error: null,
    })
  }

  /** Confirma la instanciación de un playbook contra el backend. */
  const handleInstantiatePlaybook = async () => {
    if (!playbookFlow || !onPlaybookInstantiate) return
    if (!playbookFlow.title.trim()) return
    setPlaybookFlow(prev => prev ? { ...prev, submitting: true, error: null } : prev)
    try {
      const res = await onPlaybookInstantiate(playbookFlow.playbook.id, {
        title: playbookFlow.title.trim(),
        anchor_date: playbookFlow.anchorDate.toISOString(),
        market: playbookFlow.market || undefined,
        objective: playbookFlow.objective.trim() || undefined,
      })
      if (res.ok) {
        closeDialog()
      } else {
        setPlaybookFlow(prev => prev ? { ...prev, submitting: false, error: res.error ?? 'error' } : prev)
      }
    } catch (e) {
      // Si onPlaybookInstantiate rechaza (error de red, etc.), liberamos el botón
      // y mostramos el error en vez de dejar submitting bloqueado para siempre.
      const msg = e instanceof Error ? e.message : 'Error de red'
      setPlaybookFlow(prev => prev ? { ...prev, submitting: false, error: msg } : prev)
    }
  }

  const selectEventType = (type: 'presential' | 'digital') => {
    setEventType(type)
    if (type === 'digital') {
      setNewEvent((prev) => ({
        ...prev,
        // limpiar campos de presencial:
        location: undefined,
        // defaults digital:
        channel: DIGITAL_CHANNELS[0],
        market:  DIGITAL_MARKETS[0].value,
        color:   CHANNEL_TO_COLOR[DIGITAL_CHANNELS[0]] ?? 'blue',
      }))
    } else {
      setNewEvent((prev) => ({
        ...prev,
        // limpiar campos digital:
        channel: undefined,
        market:  undefined,
        // defaults presencial:
        category: PRESENTIAL_KINDS[0],
        color:    prev.color ?? 'blue',
      }))
    }
  }
  const canSave = Boolean(
    eventType &&
    formData.title?.trim() &&
    formData.startTime &&
    (allDay ? true : formData.endTime) &&
    (eventType !== 'presential' || formData.location?.trim()) &&
    (eventType !== 'digital' || (formData.channel && formData.market))
  )
  const toLocalISO = (d: Date | undefined): string =>
    d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""
  const toLocalDate = (d: Date | undefined): string =>
    d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : ""

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              textTransform: "capitalize",
            }}
          >
            {view === "month" &&
              currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            {view === "week" &&
              `Semana del ${currentDate.toLocaleDateString("es-ES", { month: "short", day: "numeric" })}`}
            {view === "day" &&
              currentDate.toLocaleDateString("es-ES", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            {view === "list" && "Todos los eventos"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateDate("prev")}
              className="btn-pill-secondary"
              style={{ height: 32, width: 32, padding: 0 }}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="btn-pill-secondary"
              style={{ height: 32 }}
            >
              Hoy
            </button>
            <button
              onClick={() => navigateDate("next")}
              className="btn-pill-secondary"
              style={{ height: 32, width: 32, padding: 0 }}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Mobile select */}
          <div className="sm:hidden">
            <Select value={view} onValueChange={(value: string) => setView(value as "month" | "week" | "day" | "list")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" aria-hidden="true" /> Mes
                  </div>
                </SelectItem>
                <SelectItem value="week">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="h-4 w-4" aria-hidden="true" /> Semana
                  </div>
                </SelectItem>
                <SelectItem value="day">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" aria-hidden="true" /> Día
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" aria-hidden="true" /> Lista
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop pill group */}
          <div
            className="hidden sm:flex items-center"
            style={{
              gap: 2,
              padding: 3,
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--border)",
              background: "#ffffff",
            }}
          >
            {[
              { key: "month", label: "Mes", icon: Calendar },
              { key: "week", label: "Semana", icon: Grid3x3 },
              { key: "day", label: "Día", icon: Clock },
              { key: "list", label: "Lista", icon: List },
            ].map(({ key, label, icon: Icon }) => {
              const active = view === key
              return (
                <button
                  key={key}
                  onClick={() => setView(key as "month" | "week" | "day" | "list")}
                  aria-pressed={active}
                  className="inline-flex items-center transition-colors"
                  style={{
                    height: 28,
                    padding: "0 12px",
                    gap: 5,
                    borderRadius: "var(--radius-pill)",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#ffffff" : "var(--ink-2)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    border: "none",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-2)" }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>

          {/* CSV controls — visibles solo si las props existen */}
          {onDownloadTemplate && (
            <button
              onClick={onDownloadTemplate}
              className="btn-pill-secondary"
              title="Descargar plantilla CSV"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Plantilla
            </button>
          )}
          {onImportCSV && (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) onImportCSV(file)
                }}
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                className="btn-pill-secondary"
                title="Importar eventos desde CSV"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Importar CSV
              </button>
            </>
          )}

          <button
            onClick={() => {
              setIsCreating(true)
              setEventType(null)
              setNewEvent({
                title: "",
                description: "",
                color: colors[0].value,
                tags: [],
              })
              setIsDialogOpen(true)
            }}
            className="btn-cta w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo evento
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--ink-3)" }}
            aria-hidden="true"
          />
          <input
            placeholder="Buscar eventos..."
            aria-label="Buscar eventos"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full transition-colors focus:outline-none"
            style={{
              height: 38,
              padding: "0 14px 0 38px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontSize: 13,
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "var(--accent)"
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)"
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.boxShadow = "none"
            }}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center transition-colors"
              style={{
                height: 24,
                width: 24,
                borderRadius: "var(--radius-pill)",
                background: "transparent",
                color: "var(--ink-3)",
                border: "none",
              }}
              onClick={() => setSearchQuery("")}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="btn-pill-secondary"
                style={{ height: 30, padding: "0 12px", fontSize: 12 }}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Colores
                {selectedColors.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 6px",
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {selectedColors.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filtrar por color</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {colors.map((color) => (
                <DropdownMenuCheckboxItem
                  key={color.value}
                  checked={selectedColors.includes(color.value)}
                  onCheckedChange={(checked) => {
                    setSelectedColors((prev) =>
                      checked ? [...prev, color.value] : prev.filter((c) => c !== color.value),
                    )
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("h-3 w-3 rounded", color.bg)} />
                    {color.name}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="btn-pill-secondary"
                style={{ height: 30, padding: "0 12px", fontSize: 12 }}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Etiquetas
                {selectedTags.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 6px",
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {selectedTags.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filtrar por etiqueta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={(checked) => {
                    setSelectedTags((prev) => (checked ? [...prev, tag] : prev.filter((t) => t !== tag)))
                  }}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="btn-pill-secondary"
                style={{ height: 30, padding: "0 12px", fontSize: 12 }}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Categorías
                {selectedCategories.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 6px",
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {selectedCategories.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filtrar por categoría</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(checked) => {
                    setSelectedCategories((prev) =>
                      checked ? [...prev, category] : prev.filter((c) => c !== category),
                    )
                  }}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-ghost"
              style={{ height: 30, padding: "0 12px" }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>
            Filtros activos
          </span>
          {selectedColors.map((colorValue) => {
            const color = getColorClasses(colorValue)
            return (
              <span
                key={colorValue}
                className="inline-flex items-center"
                style={{
                  gap: 5,
                  height: 22,
                  padding: "0 6px 0 10px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", color.bg)} />
                {color.name}
                <button
                  onClick={() => setSelectedColors((prev) => prev.filter((c) => c !== colorValue))}
                  className="inline-flex items-center"
                  style={{ marginLeft: 2, color: "var(--ink-3)", background: "transparent", border: "none", padding: 2, cursor: "pointer" }}
                  aria-label={`Quitar filtro color ${color.name}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )
          })}
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center"
              style={{
                gap: 5,
                height: 22,
                padding: "0 6px 0 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ink)",
              }}
            >
              {tag}
              <button
                onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                className="inline-flex items-center"
                style={{ marginLeft: 2, color: "var(--ink-3)", background: "transparent", border: "none", padding: 2, cursor: "pointer" }}
                aria-label={`Quitar filtro etiqueta ${tag}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {selectedCategories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center"
              style={{
                gap: 5,
                height: 22,
                padding: "0 6px 0 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ink)",
              }}
            >
              {category}
              <button
                onClick={() => setSelectedCategories((prev) => prev.filter((c) => c !== category))}
                className="inline-flex items-center"
                style={{ marginLeft: 2, color: "var(--ink-3)", background: "transparent", border: "none", padding: 2, cursor: "pointer" }}
                aria-label={`Quitar filtro categoría ${category}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event)
            setEventType(detectEventType(event))
            setIsCreating(false)
            setIsDialogOpen(true)
          }}
          onDayClick={(date) => openCreateAt(date)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event)
            setEventType(detectEventType(event))
            setIsCreating(false)
            setIsDialogOpen(true)
          }}
          onSlotClick={(date, hour) => openCreateAt(date, hour)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event)
            setEventType(detectEventType(event))
            setIsCreating(false)
            setIsDialogOpen(true)
          }}
          onSlotClick={(date, hour) => openCreateAt(date, hour)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "list" && (
        <ListView
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event)
            setEventType(detectEventType(event))
            setIsCreating(false)
            setIsDialogOpen(true)
          }}
          getColorClasses={getColorClasses}
        />
      )}

      {isDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        >
          <div
            className="relative w-full flex flex-col overflow-hidden animate-scale-in"
            style={{
              maxWidth: 520,
              maxHeight: '90vh',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between shrink-0"
              style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>
                  {isCreating ? 'Crear evento' : 'Editar evento'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>
                  {playbookFlow
                    ? `Playbook · ${playbookFlow.playbook.name}`
                    : eventType === 'presential' ? 'Evento presencial'
                    : eventType === 'digital'    ? 'Publicación / Contenido'
                    : isCreating && playbooks.length > 0 && !customPickerOpen
                      ? 'Elige un playbook o crea un evento personalizado'
                      : 'Selecciona el tipo de evento'}
                </p>
              </div>
              <button className="image-menu-trigger" onClick={closeDialog} aria-label="Cerrar">
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="overflow-y-auto flex-1" style={{ padding: 24 }}>

              {/* Playbook-instantiate form — el usuario ha elegido un playbook */}
              {isCreating && playbookFlow && (
                <div className="flex flex-col" style={{ gap: 16 }}>
                  <button
                    type="button"
                    onClick={() => setPlaybookFlow(null)}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'transparent', border: 'none',
                      color: 'var(--accent)', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', padding: 0,
                    }}
                  >
                    ← Cambiar de opción
                  </button>

                  <div style={{
                    padding: 12,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {playbookFlow.playbook.name}
                    </div>
                    {playbookFlow.playbook.description && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                        {playbookFlow.playbook.description}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
                      Fecha ancla: <strong style={{ color: 'var(--ink-2)' }}>
                        {playbookFlow.anchorDate.toLocaleDateString('es-ES', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </strong>
                    </div>
                  </div>

                  <Field label="Título de la campaña">
                    <input
                      autoFocus
                      className="input"
                      placeholder="Webinar — Sanidad ambiental Q3"
                      value={playbookFlow.title}
                      onChange={(e) => setPlaybookFlow(prev => prev ? { ...prev, title: e.target.value } : prev)}
                    />
                  </Field>

                  {playbookMarkets.length > 0 && (
                    <Field label="Mercado">
                      <SelectField
                        value={playbookFlow.market}
                        onChange={(e) => setPlaybookFlow(prev => prev ? { ...prev, market: e.target.value } : prev)}
                      >
                        {playbookMarkets.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </SelectField>
                    </Field>
                  )}

                  <Field label="Objetivo (opcional)">
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Captar 50 leads cualificados de empresas medianas..."
                      value={playbookFlow.objective}
                      onChange={(e) => setPlaybookFlow(prev => prev ? { ...prev, objective: e.target.value } : prev)}
                      style={{ resize: 'vertical', minHeight: 60 }}
                    />
                  </Field>

                  {playbookFlow.error && (
                    <div style={{
                      padding: '8px 12px',
                      background: 'var(--red-soft)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: 'var(--red-2)',
                    }}>
                      Error al instanciar: {playbookFlow.error}
                    </div>
                  )}
                </div>
              )}

              {/* Selector inicial — playbooks + Personalizado */}
              {isCreating && !eventType && !playbookFlow && !customPickerOpen && playbooks.length > 0 && (
                <div>
                  <div style={fieldLabelStyle}>¿Qué quieres crear?</div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 10,
                  }}>
                    {playbooks.map(pb => (
                      <button
                        key={pb.id}
                        type="button"
                        onClick={() => {
                          const anchor = newEvent.startTime instanceof Date
                            ? newEvent.startTime
                            : new Date()
                          selectPlaybook(pb, anchor)
                        }}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minHeight: 84,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)' }}
                      >
                        <Sparkles size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                          {pb.name}
                        </div>
                        {pb.description && (
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }} className="line-clamp-2">
                            {pb.description}
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomPickerOpen(true)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        minHeight: 84,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ink-2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <Plus size={16} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                        Personalizado
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
                        Crea un evento libre (presencial o publicación)
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Selector legacy presencial / digital — sólo si:
                  - no hay playbooks disponibles, o
                  - el usuario eligió "Personalizado" */}
              {isCreating && !eventType && !playbookFlow && (playbooks.length === 0 || customPickerOpen) && (
                <div>
                  {customPickerOpen && (
                    <button
                      type="button"
                      onClick={() => setCustomPickerOpen(false)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: 'var(--accent)', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', padding: 0, marginBottom: 12,
                      }}
                    >
                      ← Volver
                    </button>
                  )}
                  <div style={fieldLabelStyle}>Tipo de evento</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {[
                      { key: 'presential' as const, icon: CalendarDays, label: 'Evento presencial', sublabel: 'Ferias, congresos, visitas' },
                      { key: 'digital'    as const, icon: Megaphone,    label: 'Publicación / Contenido', sublabel: 'Redes sociales y contenido' },
                    ].map((t) => {
                      const Icon = t.icon
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => selectEventType(t.key)}
                          style={{
                            flex: 1,
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            background: 'var(--surface-2)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        >
                          <Icon size={20} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{t.sublabel}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Form — cuando eventType existe */}
              {eventType && (
                <div className="flex flex-col" style={{ gap: 16 }}>

                  {isCreating && (
                    <button
                      type="button"
                      onClick={() => setEventType(null)}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ← Cambiar tipo de evento
                    </button>
                  )}

                  {/* Title */}
                  <Field label={eventType === 'digital' ? 'Título' : 'Nombre del evento'}>
                    <input
                      autoFocus={isCreating}
                      className="input"
                      placeholder={eventType === 'digital'
                        ? 'LinkedIn: Caso práctico — reducción de papeleo'
                        : 'Feria TECNA Madrid 2026'}
                      value={formData.title ?? ''}
                      onChange={(e) => updateField({ title: e.target.value })}
                    />
                  </Field>

                  {/* Presential-specific fields */}
                  {eventType === 'presential' && (
                    <>
                      <Field label="Tipo">
                        <SelectField
                          value={formData.category ?? PRESENTIAL_KINDS[0]}
                          onChange={(e) => updateField({ category: e.target.value })}
                        >
                          {PRESENTIAL_KINDS.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </SelectField>
                      </Field>
                      {/* Toggle "Todo el día" */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allDay}
                          onClick={() => setAllDay(v => !v)}
                          style={{
                            width: 36, height: 20,
                            borderRadius: 'var(--radius-pill)',
                            background: allDay ? 'var(--accent)' : 'var(--surface-3)',
                            border: 'none', cursor: 'pointer',
                            position: 'relative',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <span style={{
                            position: 'absolute',
                            top: 2, left: allDay ? 18 : 2,
                            width: 16, height: 16,
                            borderRadius: '50%', background: '#fff',
                            transition: 'left 0.15s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
                          Todo el día
                        </span>
                      </div>

                      {allDay ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Fecha inicio">
                            <input
                              type="date"
                              className="input"
                              value={toLocalDate(formData.startTime)}
                              onChange={(e) => {
                                const [y, m, d] = e.target.value.split('-').map(Number)
                                if (!y) return
                                updateField({ startTime: new Date(y, m - 1, d, 0, 0, 0, 0) })
                              }}
                            />
                          </Field>
                          <Field label="Fecha fin (opcional)">
                            <input
                              type="date"
                              className="input"
                              value={toLocalDate(formData.endTime)}
                              onChange={(e) => {
                                const [y, m, d] = e.target.value.split('-').map(Number)
                                if (!y) { updateField({ endTime: undefined }); return }
                                updateField({ endTime: new Date(y, m - 1, d, 23, 59, 59, 999) })
                              }}
                            />
                          </Field>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Inicio">
                            <input
                              type="datetime-local"
                              className="input"
                              value={toLocalISO(formData.startTime)}
                              onChange={(e) => updateField({ startTime: new Date(e.target.value) })}
                            />
                          </Field>
                          <Field label="Fin">
                            <input
                              type="datetime-local"
                              className="input"
                              value={toLocalISO(formData.endTime)}
                              onChange={(e) => updateField({ endTime: new Date(e.target.value) })}
                            />
                          </Field>
                        </div>
                      )}
                      <Field label="Ubicación">
                        <input
                          className="input"
                          placeholder="Madrid, España"
                          value={formData.location ?? ''}
                          onChange={(e) => updateField({ location: e.target.value })}
                        />
                      </Field>
                    </>
                  )}

                  {/* Digital-specific fields */}
                  {eventType === 'digital' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Canal">
                          <SelectField
                            value={formData.channel ?? DIGITAL_CHANNELS[0]}
                            onChange={(e) => {
                              const channel = e.target.value
                              updateField({ channel, color: CHANNEL_TO_COLOR[channel] ?? 'blue' })
                            }}
                          >
                            {DIGITAL_CHANNELS.map((c) => (
                              <option key={c} value={c}>{DIGITAL_CHANNEL_LABEL[c]}</option>
                            ))}
                          </SelectField>
                        </Field>
                        <Field label="Mercado">
                          <SelectField
                            value={formData.market ?? DIGITAL_MARKETS[0].value}
                            onChange={(e) => updateField({ market: e.target.value })}
                          >
                            {DIGITAL_MARKETS.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </SelectField>
                        </Field>
                      </div>
                      <Field label="Fecha de publicación">
                        <input
                          type="datetime-local"
                          className="input"
                          value={toLocalISO(formData.startTime)}
                          onChange={(e) => {
                            const date = new Date(e.target.value)
                            // Digital: endTime = startTime + 30min por defecto si no existe
                            const endTime = formData.endTime ?? new Date(date.getTime() + 30 * 60000)
                            updateField({ startTime: date, endTime })
                          }}
                        />
                      </Field>
                    </>
                  )}

                  {/* SHARED — Descripción */}
                  <Field label="Descripción" optional>
                    <textarea
                      className="input"
                      style={{ height: 'auto', padding: '10px 12px', minHeight: 80, resize: 'vertical' }}
                      rows={3}
                      placeholder={eventType === 'digital'
                        ? 'Copy o descripción del contenido...'
                        : 'Detalles del evento...'}
                      value={formData.description ?? ''}
                      onChange={(e) => updateField({ description: e.target.value })}
                    />
                  </Field>

                  {/* SHARED — Etiquetas */}
                  <Field label="Etiquetas" optional>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map((tag) => {
                        const isSelected = formData.tags?.includes(tag) ?? false
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag, isCreating)}
                            aria-pressed={isSelected}
                            style={{
                              height: 26,
                              padding: '0 12px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: 12,
                              fontWeight: 500,
                              background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                              color: isSelected ? '#ffffff' : 'var(--ink-2)',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  {/* Color — solo presencial; digital usa color del canal */}
                  {eventType === 'presential' && (
                    <Field label="Color">
                      <div className="flex flex-wrap" style={{ gap: 8 }}>
                        {COLOR_KEYS.map((c) => {
                          const isSelected = (formData.color ?? colors[0].value) === c
                          const style = EVENT_STYLES[c]
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateField({ color: c })}
                              aria-label={`Color ${c}`}
                              aria-pressed={isSelected}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 'var(--radius-sm)',
                                background: style.bg,
                                border: isSelected ? `2px solid ${style.text}` : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'border 0.15s ease',
                                padding: 0,
                              }}
                            />
                          )
                        })}
                      </div>
                    </Field>
                  )}

                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center shrink-0"
              style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 8 }}
            >
              {!isCreating && selectedEvent && (
                <button
                  type="button"
                  className="btn-destructive"
                  style={{ marginRight: 'auto' }}
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                >
                  Eliminar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className="btn-secondary" onClick={closeDialog}>
                Cancelar
              </button>
              {playbookFlow ? (
                <button
                  type="button"
                  className="btn-cta"
                  disabled={!playbookFlow.title.trim() || playbookFlow.submitting}
                  onClick={handleInstantiatePlaybook}
                >
                  {playbookFlow.submitting ? 'Creando…' : 'Crear desde playbook'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-cta"
                  disabled={!canSave || (isCreating && !eventType)}
                  onClick={isCreating ? handleCreateEvent : handleUpdateEvent}
                >
                  {isCreating ? 'Crear evento' : 'Guardar cambios'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tooltip enriquecido compartido (compact + default) ──
const TOOLTIP_CHANNEL_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  linkedin:   { text: '#0071e3', border: 'rgba(0,113,227,0.2)',   bg: 'rgba(0,113,227,0.07)'   },
  instagram:  { text: '#e8388c', border: 'rgba(232,62,140,0.2)',  bg: 'rgba(232,62,140,0.07)'  },
  newsletter: { text: '#248a3d', border: 'rgba(52,199,89,0.25)',  bg: 'rgba(52,199,89,0.08)'   },
  blog:       { text: '#b25000', border: 'rgba(255,159,10,0.25)', bg: 'rgba(255,159,10,0.08)'  },
  x:          { text: '#6e6e73', border: 'rgba(0,0,0,0.15)',      bg: 'rgba(0,0,0,0.04)'       },
  facebook:   { text: '#0071e3', border: 'rgba(0,113,227,0.2)',   bg: 'rgba(0,113,227,0.07)'   },
}

const TOOLTIP_W = 288
const TOOLTIP_EST_H = 180   // alto estimado para decidir si abre arriba o abajo

function EventTooltip({
  event,
  formatTime,
  getDuration,
  anchorRect,
}: {
  event: Event
  formatTime: (d: Date) => string
  getDuration: () => string
  anchorRect: DOMRect | null
}) {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !anchorRect || typeof document === 'undefined') return null

  // Posicionamiento: portal con position: fixed para que NO lo recorte el
  // overflow:hidden de la celda del calendario. Abre hacia abajo si cabe;
  // si no, hacia arriba para no salirse por el fondo del viewport.
  const spaceBelow = window.innerHeight - anchorRect.bottom
  const spaceAbove = anchorRect.top
  const openUp = spaceBelow < TOOLTIP_EST_H + 12 && spaceAbove > spaceBelow

  // Clamp horizontal para no salirse por el lateral del viewport.
  const rawLeft = anchorRect.left
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - TOOLTIP_W - 8))

  const positionStyle: React.CSSProperties = openUp
    ? { position: 'fixed', left, bottom: window.innerHeight - anchorRect.top + 4 }
    : { position: 'fixed', left, top: anchorRect.bottom + 4 }

  const dotColor = EVENT_STYLES[event.color]?.text ?? 'var(--ink-3)'

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none animate-fade-in"
      style={{ ...positionStyle, zIndex: 60, width: TOOLTIP_W, minWidth: 240 }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Título + dot color */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
            {event.title}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dotColor,
              flexShrink: 0, marginTop: 3,
            }}
          />
        </div>

        {/* Separador */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Hora / Todo el día */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
          <Clock size={12} aria-hidden="true" />
          {event.allDay
            ? <span>Todo el día</span>
            : <span>{formatTime(event.startTime)} – {formatTime(event.endTime)} ({getDuration()})</span>
          }
        </div>

        {/* Canal + Mercado (digital) */}
        {event.eventType === 'digital' && event.channel && (() => {
          const ch = event.channel.toLowerCase()
          const c = TOOLTIP_CHANNEL_COLORS[ch] ?? { text: 'var(--ink-2)', border: 'var(--border)', bg: 'var(--surface-2)' }
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 7px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${c.border}`,
                color: c.text, background: c.bg,
              }}>
                {DIGITAL_CHANNEL_LABEL[ch as keyof typeof DIGITAL_CHANNEL_LABEL] ?? event.channel}
              </span>
              {event.market && (
                <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {DIGITAL_MARKETS.find(m => m.value === event.market)?.label ?? event.market}
                </span>
              )}
            </div>
          )
        })()}

        {/* Ubicación (presencial) */}
        {event.eventType === 'presential' && event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
            <MapPin size={12} aria-hidden="true" />
            <span>{event.location}</span>
          </div>
        )}

        {/* Categoría chip */}
        {event.category && (
          <span style={{
            alignSelf: 'flex-start',
            fontSize: 10, fontWeight: 600,
            padding: '1px 7px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--ink-2)',
          }}>
            {event.category}
          </span>
        )}

        {/* Descripción */}
        {event.description && (
          <p style={{
            fontSize: 12, color: 'var(--ink-2)',
            lineHeight: 1.5, margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {event.description}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function EventCard({
  event,
  onEventClick,
  onDragStart,
  onDragEnd,
  getColorClasses,
  variant = "default",
}: {
  event: Event
  onEventClick: (event: Event) => void
  onDragStart: (event: Event) => void
  onDragEnd: () => void
  getColorClasses: (color: string) => { bg: string; text: string }
  variant?: "default" | "compact" | "detailed"
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const colorClasses = getColorClasses(event.color)

  /** Captura el rect del wrapper al entrar; el tooltip lo usa para anclarse. */
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    const r = wrapperRef.current?.getBoundingClientRect()
    setAnchorRect(r ?? null)
  }, [])
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setAnchorRect(null)
  }, [])

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

  const getDuration = () => {
    const diff = event.endTime.getTime() - event.startTime.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  // Paleta apagada Apple
  const eventStyle = EVENT_STYLES[event.color] ?? EVENT_STYLES.blue

  if (variant === "compact") {
    return (
      <div
        ref={wrapperRef}
        draggable
        onDragStart={() => onDragStart(event)}
        onDragEnd={onDragEnd}
        onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative cursor-pointer"
      >
        <div
          className={cn("transition-all duration-200 truncate", isHovered && "scale-[1.02] z-10")}
          style={{
            borderRadius: "var(--radius-sm)",
            padding: "2px 8px",
            height: 20,
            lineHeight: "16px",
            fontSize: 11,
            fontWeight: 600,
            background: eventStyle.bg,
            color: eventStyle.text,
            border: "none",
          }}
        >
          {event.title}
        </div>
        {isHovered && (
          <EventTooltip event={event} formatTime={formatTime} getDuration={getDuration} anchorRect={anchorRect} />
        )}
      </div>
    )
  }

  if (variant === "detailed") {
    return (
      <div
        ref={wrapperRef}
        draggable
        onDragStart={() => onDragStart(event)}
        onDragEnd={onDragEnd}
        onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn("cursor-pointer transition-all duration-200", isHovered && "shadow-md")}
        style={{
          borderRadius: "var(--radius-md)",
          padding: 12,
          paddingLeft: 14,
          background: eventStyle.bg,
          color: eventStyle.text,
          border: "1px solid var(--border)",
          borderLeft: `2px solid ${eventStyle.text}`,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13 }}>{event.title}</div>
        {event.description && (
          <div className="mt-1 line-clamp-2" style={{ fontSize: 12, opacity: 0.85 }}>
            {event.description}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5" style={{ fontSize: 11, opacity: 0.8 }}>
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatTime(event.startTime)} - {formatTime(event.endTime)}
        </div>
        {isHovered && (
          <div className="mt-2 flex flex-wrap gap-1">
            {event.category && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 18,
                padding: '0 7px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 10,
                fontWeight: 600,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--ink-2)',
              }}>
                {event.category}
              </span>
            )}
            {event.tags?.map((tag) => (
              <span key={tag} style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 18,
                padding: '0 7px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 10,
                fontWeight: 500,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--ink-2)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      draggable
      onDragStart={() => onDragStart(event)}
      onDragEnd={onDragEnd}
      onClick={() => onEventClick(event)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative"
    >
      <div
        className={cn("cursor-pointer transition-all duration-200", isHovered && "scale-[1.02] z-10")}
        style={{
          borderRadius: "var(--radius-sm)",
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 600,
          background: eventStyle.bg,
          color: eventStyle.text,
          border: "none",
        }}
      >
        <div className="truncate">{event.title}</div>
      </div>
      {isHovered && (
        <EventTooltip event={event} formatTime={formatTime} getDuration={getDuration} anchorRect={anchorRect} />
      )}
    </div>
  )
}

function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
  onDragStart,
  onDragEnd,
  onDrop,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  onEventClick: (event: Event) => void
  onDayClick: (date: Date) => void
  onDragStart: (event: Event) => void
  onDragEnd: () => void
  onDrop: (date: Date) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const allDays: Date[] = []
  const currentDay = new Date(startDate)
  for (let i = 0; i < 42; i++) {
    allDays.push(new Date(currentDay))
    currentDay.setDate(currentDay.getDate() + 1)
  }

  // Si la última fila (índices 35-41) es enteramente del mes siguiente, la
  // recortamos para no malgastar altura del viewport con una fila gris. Es el
  // mismo comportamiento que Google Calendar / Apple Calendar.
  const lastWeekAllNextMonth = allDays
    .slice(35, 42)
    .every(d => d.getMonth() !== currentDate.getMonth())
  const days = lastWeekAllNextMonth ? allDays.slice(0, 35) : allDays

  const getEventsForDay = (date: Date) =>
    events.filter((event) => {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
      return event.startTime <= dayEnd && event.endTime >= dayStart
    })

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

  return (
    <div
      className="overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {/* Header de días de la semana */}
      <div
        className="grid grid-cols-7"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center"
            style={{
              padding: "10px 0",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = day.toDateString() === new Date().toDateString()
          const isLastCol = (index + 1) % 7 === 0
          const isLastRow = index >= days.length - 7

          const baseBg = isToday
            ? "var(--accent-soft)"
            : isCurrentMonth
            ? "#ffffff"
            : "rgba(0,0,0,0.02)"

          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`Crear evento el ${day.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              className={cn(
                "min-h-16 sm:min-h-20 transition-colors cursor-pointer",
                !isToday && "hover:bg-[var(--surface-2)]",
              )}
              style={{
                padding: 6,
                background: baseBg,
                borderRight: isLastCol ? "none" : "1px solid var(--border)",
                borderBottom: isLastRow ? "none" : "1px solid var(--border)",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(day)}
              onClick={() => onDayClick(day)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick(day) } }}
            >
              {/* Número de día */}
              <div
                className="mb-1.5 flex items-center"
                style={{
                  padding: "2px 4px",
                }}
              >
                {isToday ? (
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {day.getDate()}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isCurrentMonth ? "var(--ink-2)" : "var(--ink-3)",
                      padding: "0 4px",
                    }}
                  >
                    {day.getDate()}
                  </span>
                )}
              </div>

              {/* Eventos */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEventClick={onEventClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    getColorClasses={getColorClasses}
                    variant="compact"
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 10, color: "var(--ink-3)", padding: "0 4px" }}
                  >
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
  onDragStart,
  onDragEnd,
  onDrop,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  onEventClick: (event: Event) => void
  onSlotClick: (date: Date, hour: number) => void
  onDragStart: (event: Event) => void
  onDragEnd: () => void
  onDrop: (date: Date, hour: number) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    return day
  })
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getEventsForDayAndHour = (date: Date, hour: number) =>
    events.filter((event) => {
      const eventDate = new Date(event.startTime)
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getHours() === hour
      )
    })

  return (
    <div
      className="overflow-auto"
      style={{
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {/* Header */}
      <div
        className="grid grid-cols-8"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="text-center"
          style={{
            padding: "8px 0",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
            borderRight: "1px solid var(--border)",
          }}
        >
          Hora
        </div>
        {weekDays.map((day, idx) => (
          <div
            key={day.toISOString()}
            className="text-center"
            style={{
              padding: "8px 4px",
              borderRight: idx === weekDays.length - 1 ? "none" : "1px solid var(--border)",
            }}
          >
            <div
              className="hidden sm:block"
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-3)",
              }}
            >
              {day.toLocaleDateString("es-ES", { weekday: "short" })}
            </div>
            <div
              className="sm:hidden"
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              {day.toLocaleDateString("es-ES", { weekday: "narrow" })}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>
              {day.toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8">
        {hours.map((hour) => (
          <Fragment key={`row-${hour}`}>
            <div
              style={{
                padding: "6px 4px",
                fontSize: 11,
                color: "var(--ink-2)",
                borderBottom: hour === 23 ? "none" : "1px solid var(--border-soft)",
                borderRight: "1px solid var(--border)",
                textAlign: "center",
              }}
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
            {weekDays.map((day, dayIdx) => {
              const dayEvents = getEventsForDayAndHour(day, hour)
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Crear evento ${day.toLocaleDateString('es-ES')} ${hour.toString().padStart(2, '0')}:00`}
                  className="min-h-12 sm:min-h-16 transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
                  style={{
                    padding: 4,
                    borderBottom: hour === 23 ? "none" : "1px solid var(--border-soft)",
                    borderRight: dayIdx === weekDays.length - 1 ? "none" : "1px solid var(--border-soft)",
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(day, hour)}
                  onClick={() => onSlotClick(day, hour)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(day, hour) } }}
                >
                  <div className="space-y-1">
                    {dayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEventClick={onEventClick}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        getColorClasses={getColorClasses}
                        variant="default"
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function DayView({
  currentDate,
  events,
  onEventClick,
  onSlotClick,
  onDragStart,
  onDragEnd,
  onDrop,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  onEventClick: (event: Event) => void
  onSlotClick: (date: Date, hour: number) => void
  onDragStart: (event: Event) => void
  onDragEnd: () => void
  onDrop: (date: Date, hour: number) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const getEventsForHour = (hour: number) =>
    events.filter((event) => {
      const eventDate = new Date(event.startTime)
      return (
        eventDate.getDate() === currentDate.getDate() &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getFullYear() === currentDate.getFullYear() &&
        eventDate.getHours() === hour
      )
    })

  return (
    <div
      className="overflow-auto"
      style={{
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div className="space-y-0">
        {hours.map((hour) => {
          const hourEvents = getEventsForHour(hour)
          return (
            <div
              key={hour}
              role="button"
              tabIndex={0}
              aria-label={`Crear evento ${currentDate.toLocaleDateString('es-ES')} ${hour.toString().padStart(2, '0')}:00`}
              className="flex transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
              style={{
                borderBottom: hour === 23 ? "none" : "1px solid var(--border-soft)",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(currentDate, hour)}
              onClick={() => onSlotClick(currentDate, hour)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(currentDate, hour) } }}
            >
              {/* Columna de hora */}
              <div
                className="flex-shrink-0"
                style={{
                  width: 64,
                  padding: "10px 8px",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  borderRight: "1px solid var(--border)",
                  textAlign: "center",
                }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
              {/* Eventos */}
              <div
                className="min-h-16 flex-1 sm:min-h-20"
                style={{ padding: 8 }}
              >
                <div className="space-y-2">
                  {hourEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEventClick={onEventClick}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      getColorClasses={getColorClasses}
                      variant="detailed"
                    />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListView({
  events,
  onEventClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getColorClasses,
}: {
  events: Event[]
  onEventClick: (event: Event) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const sortedEvents = [...events].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  )

  const groupedEvents = sortedEvents.reduce((acc, event) => {
    const dateKey = event.startTime.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(event)
    return acc
  }, {} as Record<string, Event[]>)

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div
          key={date}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {/* Header de fecha */}
          <div
            style={{
              padding: "6px 14px",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-3)",
            }}
          >
            {date}
          </div>

          {/* Eventos del día */}
          <div>
            {dateEvents.map((event, idx) => {
              const eventStyle = EVENT_STYLES[event.color] ?? EVENT_STYLES.blue
              return (
                <div
                  key={event.id}
                  onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                  className="cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    padding: "12px 14px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--border-soft)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Dot de color */}
                    <div
                      className="shrink-0"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: eventStyle.text,
                        marginTop: 5,
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* Título */}
                          <h4
                            className="truncate"
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--ink)",
                              lineHeight: 1.3,
                            }}
                          >
                            {event.title}
                          </h4>
                          {/* Descripción */}
                          {event.description && (
                            <p
                              className="line-clamp-2 mt-1"
                              style={{
                                fontSize: 12,
                                color: "var(--ink-2)",
                                lineHeight: 1.4,
                              }}
                            >
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Categoría a la derecha */}
                        {event.category && (
                          <div
                            className="shrink-0"
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: "var(--ink-3)",
                              background: "transparent",
                              border: "none",
                            }}
                          >
                            {event.category}
                          </div>
                        )}
                      </div>

                      {/* Hora + tags */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div
                          className="inline-flex items-center gap-1"
                          style={{ fontSize: 12, color: "var(--ink-2)" }}
                        >
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {event.startTime.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {event.endTime.toLocaleTimeString("es-ES", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {event.tags && event.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {event.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center"
                                style={{
                                  height: 18,
                                  padding: "0 8px",
                                  borderRadius: "var(--radius-pill)",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  border: "1px solid var(--border)",
                                  background: "var(--surface-2)",
                                  color: "var(--ink-2)",
                                  lineHeight: 1,
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {sortedEvents.length === 0 && (
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            fontSize: 14,
            color: "var(--ink-3)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          No hay eventos
        </div>
      )}
    </div>
  )
}
