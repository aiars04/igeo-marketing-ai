"use client"

import { useState, useCallback, useMemo, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Clock,
  Grid3x3,
  List,
  Search,
  Filter,
  X,
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
}

export interface EventManagerProps {
  events?: Event[]
  onEventCreate?: (event: Omit<Event, "id">) => void
  onEventUpdate?: (id: string, event: Partial<Event>) => void
  onEventDelete?: (id: string) => void
  categories?: string[]
  colors?: { name: string; value: string; bg: string; text: string }[]
  defaultView?: "month" | "week" | "day" | "list"
  className?: string
  availableTags?: string[]
}

// Paleta Apple apagada para las píldoras de evento
const defaultColors = [
  { name: "Azul",    value: "blue",   bg: "bg-[#0071e3]", text: "text-[#0055b3]" },
  { name: "Verde",   value: "green",  bg: "bg-[#34c759]", text: "text-[#1a7a36]" },
  { name: "Morado",  value: "purple", bg: "bg-[#af52de]", text: "text-[#7b2fa8]" },
  { name: "Naranja", value: "orange", bg: "bg-[#ff9f0a]", text: "text-[#b25000]" },
  { name: "Rosa",    value: "pink",   bg: "bg-[#e8388c]", text: "text-[#c0245a]" },
  { name: "Rojo",    value: "red",    bg: "bg-[#ff3b30]", text: "text-[#c0392b]" },
]

// Estilos apagados (background+text) usados en EventCard
const EVENT_STYLES: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "rgba(0, 113, 227, 0.12)",  text: "#0055b3" },
  green:  { bg: "rgba(52, 199, 89, 0.10)",  text: "#1a7a36" },
  purple: { bg: "rgba(175, 82, 222, 0.10)", text: "#7b2fa8" },
  orange: { bg: "rgba(255, 159, 10, 0.12)", text: "#b25000" },
  pink:   { bg: "rgba(232, 56, 140, 0.10)", text: "#c0245a" },
  red:    { bg: "rgba(255, 59, 48, 0.10)",  text: "#c0392b" },
}

export function EventManager({
  events: initialEvents = [],
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  categories = ["Reunión", "Tarea", "Recordatorio", "Personal"],
  colors = defaultColors,
  defaultView = "month",
  className,
  availableTags = ["Importante", "Urgente", "Trabajo", "Personal", "Equipo", "Cliente"],
}: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "day" | "list">(defaultView)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null)
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: "",
    description: "",
    color: colors[0].value,
    category: categories[0],
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

  const handleCreateEvent = useCallback(() => {
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime) return
    const event: Event = {
      id: Math.random().toString(36).substr(2, 9),
      title: newEvent.title,
      description: newEvent.description,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      color: newEvent.color || colors[0].value,
      category: newEvent.category,
      attendees: newEvent.attendees,
      tags: newEvent.tags || [],
    }
    setEvents((prev) => [...prev, event])
    onEventCreate?.(event)
    setIsDialogOpen(false)
    setIsCreating(false)
    setNewEvent({
      title: "",
      description: "",
      color: colors[0].value,
      category: categories[0],
      tags: [],
    })
  }, [newEvent, colors, categories, onEventCreate])

  const handleUpdateEvent = useCallback(() => {
    if (!selectedEvent) return
    setEvents((prev) => prev.map((e) => (e.id === selectedEvent.id ? selectedEvent : e)))
    onEventUpdate?.(selectedEvent.id, selectedEvent)
    setIsDialogOpen(false)
    setSelectedEvent(null)
  }, [selectedEvent, onEventUpdate])

  const handleDeleteEvent = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      onEventDelete?.(id)
      setIsDialogOpen(false)
      setSelectedEvent(null)
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
      setEvents((prev) => prev.map((e) => (e.id === draggedEvent.id ? updatedEvent : e)))
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

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              lineHeight: 1.15,
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
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateDate("prev")}
              className="inline-flex items-center justify-center transition-colors"
              style={{
                height: 32,
                width: 32,
                borderRadius: 980,
                border: "1px solid var(--border)",
                background: "#ffffff",
                color: "var(--ink)",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="inline-flex items-center justify-center transition-colors"
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 980,
                border: "1px solid var(--border)",
                background: "#ffffff",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => navigateDate("next")}
              className="inline-flex items-center justify-center transition-colors"
              style={{
                height: 32,
                width: 32,
                borderRadius: 980,
                border: "1px solid var(--border)",
                background: "#ffffff",
                color: "var(--ink)",
              }}
            >
              <ChevronRight className="h-4 w-4" />
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
                    <Calendar className="h-4 w-4" /> Mes
                  </div>
                </SelectItem>
                <SelectItem value="week">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="h-4 w-4" /> Semana
                  </div>
                </SelectItem>
                <SelectItem value="day">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Día
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" /> Lista
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
              borderRadius: 980,
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
                  className="inline-flex items-center transition-colors"
                  style={{
                    height: 28,
                    padding: "0 12px",
                    gap: 5,
                    borderRadius: 980,
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#ffffff" : "var(--ink-2)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    border: "none",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => {
              setIsCreating(true)
              setIsDialogOpen(true)
            }}
            className="inline-flex items-center justify-center w-full sm:w-auto transition-all"
            style={{
              height: 36,
              padding: "0 18px",
              borderRadius: 980,
              background: "var(--accent)",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              gap: 6,
              boxShadow: "0 1px 4px rgba(0,113,227,0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--orange-hover)"
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,113,227,0.35)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)"
              e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,113,227,0.25)"
            }}
          >
            <Plus className="h-4 w-4" />
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
          />
          <input
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full transition-colors focus:outline-none"
            style={{
              height: 38,
              padding: "0 14px 0 38px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontSize: 13,
            }}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center transition-colors"
              style={{
                height: 24,
                width: 24,
                borderRadius: 980,
                background: "transparent",
                color: "var(--ink-3)",
                border: "none",
              }}
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center transition-colors"
                style={{
                  height: 30,
                  padding: "0 12px",
                  gap: 5,
                  borderRadius: 980,
                  border: "1px solid var(--border)",
                  background: "#ffffff",
                  color: "var(--ink-2)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                Colores
                {selectedColors.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 6px",
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: 980,
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
                className="inline-flex items-center transition-colors"
                style={{
                  height: 30,
                  padding: "0 12px",
                  gap: 5,
                  borderRadius: 980,
                  border: "1px solid var(--border)",
                  background: "#ffffff",
                  color: "var(--ink-2)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                Etiquetas
                {selectedTags.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 6px",
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: 980,
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
                className="inline-flex items-center transition-colors"
                style={{
                  height: 30,
                  padding: "0 12px",
                  gap: 5,
                  borderRadius: 980,
                  border: "1px solid var(--border)",
                  background: "#ffffff",
                  color: "var(--ink-2)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                Categorías
                {selectedCategories.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 6px",
                      height: 18,
                      lineHeight: "18px",
                      borderRadius: 980,
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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtros activos:</span>
          {selectedColors.map((colorValue) => {
            const color = getColorClasses(colorValue)
            return (
              <Badge key={colorValue} variant="secondary" className="gap-1">
                <div className={cn("h-2 w-2 rounded-full", color.bg)} />
                {color.name}
                <button
                  onClick={() => setSelectedColors((prev) => prev.filter((c) => c !== colorValue))}
                  className="ml-1 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedCategories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              {category}
              <button
                onClick={() => setSelectedCategories((prev) => prev.filter((c) => c !== category))}
                className="ml-1 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={(event) => {
            setSelectedEvent(event)
            setIsDialogOpen(true)
          }}
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
            setIsDialogOpen(true)
          }}
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
            setIsDialogOpen(true)
          }}
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
            setIsDialogOpen(true)
          }}
          getColorClasses={getColorClasses}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Crear evento" : "Detalle del evento"}</DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Añade un nuevo evento al calendario"
                : "Visualiza y edita los detalles del evento"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={isCreating ? newEvent.title : selectedEvent?.title}
                onChange={(e) =>
                  isCreating
                    ? setNewEvent((prev) => ({ ...prev, title: e.target.value }))
                    : setSelectedEvent((prev) => (prev ? { ...prev, title: e.target.value } : null))
                }
                placeholder="Título del evento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={isCreating ? newEvent.description : selectedEvent?.description}
                onChange={(e) =>
                  isCreating
                    ? setNewEvent((prev) => ({ ...prev, description: e.target.value }))
                    : setSelectedEvent((prev) => (prev ? { ...prev, description: e.target.value } : null))
                }
                placeholder="Descripción del evento"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Inicio</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={
                    isCreating
                      ? newEvent.startTime
                        ? new Date(
                            newEvent.startTime.getTime() -
                              newEvent.startTime.getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                      : selectedEvent
                      ? new Date(
                          selectedEvent.startTime.getTime() -
                            selectedEvent.startTime.getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const date = new Date(e.target.value)
                    if (isCreating) setNewEvent((prev) => ({ ...prev, startTime: date }))
                    else setSelectedEvent((prev) => (prev ? { ...prev, startTime: date } : null))
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">Fin</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={
                    isCreating
                      ? newEvent.endTime
                        ? new Date(
                            newEvent.endTime.getTime() -
                              newEvent.endTime.getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                      : selectedEvent
                      ? new Date(
                          selectedEvent.endTime.getTime() -
                            selectedEvent.endTime.getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const date = new Date(e.target.value)
                    if (isCreating) setNewEvent((prev) => ({ ...prev, endTime: date }))
                    else setSelectedEvent((prev) => (prev ? { ...prev, endTime: date } : null))
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={isCreating ? newEvent.category : selectedEvent?.category}
                  onValueChange={(value) =>
                    isCreating
                      ? setNewEvent((prev) => ({ ...prev, category: value }))
                      : setSelectedEvent((prev) => (prev ? { ...prev, category: value } : null))
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select
                  value={isCreating ? newEvent.color : selectedEvent?.color}
                  onValueChange={(value) =>
                    isCreating
                      ? setNewEvent((prev) => ({ ...prev, color: value }))
                      : setSelectedEvent((prev) => (prev ? { ...prev, color: value } : null))
                  }
                >
                  <SelectTrigger id="color">
                    <SelectValue placeholder="Selecciona color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-4 w-4 rounded", color.bg)} />
                          {color.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = isCreating
                    ? newEvent.tags?.includes(tag)
                    : selectedEvent?.tags?.includes(tag)
                  return (
                    <Badge
                      key={tag}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => toggleTag(tag, isCreating)}
                    >
                      {tag}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            {!isCreating && (
              <Button
                variant="destructive"
                onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)}
              >
                Eliminar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setIsCreating(false)
                setSelectedEvent(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={isCreating ? handleCreateEvent : handleUpdateEvent}>
              {isCreating ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
  const colorClasses = getColorClasses(event.color)

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
        draggable
        onDragStart={() => onDragStart(event)}
        onDragEnd={onDragEnd}
        onClick={() => onEventClick(event)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative cursor-pointer"
      >
        <div
          className={cn("transition-all duration-200 truncate", isHovered && "scale-[1.02] z-10")}
          style={{
            borderRadius: 5,
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
          <div className="absolute left-0 top-full z-50 mt-1 w-64">
            <Card className="border-2 p-3 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm leading-tight">{event.title}</h4>
                  <div className={cn("h-3 w-3 rounded-full flex-shrink-0", colorClasses.bg)} />
                </div>
                {event.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatTime(event.startTime)} - {formatTime(event.endTime)}
                  </span>
                  <span className="text-[10px]">({getDuration()})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {event.category && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {event.category}
                    </Badge>
                  )}
                  {event.tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] h-5">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    )
  }

  if (variant === "detailed") {
    return (
      <div
        draggable
        onDragStart={() => onDragStart(event)}
        onDragEnd={onDragEnd}
        onClick={() => onEventClick(event)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn("cursor-pointer transition-all duration-200", isHovered && "scale-[1.01] shadow-lg")}
        style={{
          borderRadius: 10,
          padding: 12,
          background: eventStyle.bg,
          color: eventStyle.text,
          border: `1px solid ${eventStyle.bg.replace("0.12", "0.25").replace("0.10", "0.20")}`,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13 }}>{event.title}</div>
        {event.description && (
          <div className="mt-1 line-clamp-2" style={{ fontSize: 12, opacity: 0.85 }}>
            {event.description}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5" style={{ fontSize: 11, opacity: 0.8 }}>
          <Clock className="h-3 w-3" />
          {formatTime(event.startTime)} - {formatTime(event.endTime)}
        </div>
        {isHovered && (
          <div className="mt-2 flex flex-wrap gap-1">
            {event.category && (
              <Badge variant="secondary" className="text-xs">
                {event.category}
              </Badge>
            )}
            {event.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(event)}
      onDragEnd={onDragEnd}
      onClick={() => onEventClick(event)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      <div
        className={cn("cursor-pointer transition-all duration-200", isHovered && "scale-[1.02] z-10")}
        style={{
          borderRadius: 5,
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
    </div>
  )
}

function MonthView({
  currentDate,
  events,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDrop,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  onEventClick: (event: Event) => void
  onDragStart: (event: Event) => void
  onDragEnd: () => void
  onDrop: (date: Date) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const days: Date[] = []
  const currentDay = new Date(startDate)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDay))
    currentDay.setDate(currentDay.getDate() + 1)
  }

  const getEventsForDay = (date: Date) =>
    events.filter((event) => {
      const eventDate = new Date(event.startTime)
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      )
    })

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

  return (
    <div
      className="overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: 12,
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

          return (
            <div
              key={index}
              className="min-h-20 sm:min-h-24 transition-colors"
              style={{
                padding: 6,
                background: isToday
                  ? "var(--accent-soft)"
                  : isCurrentMonth
                  ? "#ffffff"
                  : "rgba(0,0,0,0.02)",
                borderRight: isLastCol ? "none" : "1px solid var(--border)",
                borderBottom: isLastRow ? "none" : "1px solid var(--border)",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(day)}
              onMouseEnter={(e) => {
                if (!isToday) e.currentTarget.style.background = "rgba(0,0,0,0.02)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isToday
                  ? "var(--accent-soft)"
                  : isCurrentMonth
                  ? "#ffffff"
                  : "rgba(0,0,0,0.02)"
              }}
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
                  <div style={{ fontSize: 10, color: "var(--ink-3)", padding: "0 4px" }}>
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
  onDragStart,
  onDragEnd,
  onDrop,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  onEventClick: (event: Event) => void
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
    <Card className="overflow-auto">
      <div className="grid grid-cols-8 border-b">
        <div className="border-r p-2 text-center text-xs font-medium sm:text-sm">Hora</div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="border-r p-2 text-center text-xs font-medium last:border-r-0 sm:text-sm"
          >
            <div className="hidden sm:block">
              {day.toLocaleDateString("es-ES", { weekday: "short" })}
            </div>
            <div className="sm:hidden">
              {day.toLocaleDateString("es-ES", { weekday: "narrow" })}
            </div>
            <div className="text-[10px] text-muted-foreground sm:text-xs">
              {day.toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-8">
        {hours.map((hour) => (
          <Fragment key={`row-${hour}`}>
            <div className="border-b border-r p-1 text-[10px] text-muted-foreground sm:p-2 sm:text-xs">
              {hour.toString().padStart(2, "0")}:00
            </div>
            {weekDays.map((day) => {
              const dayEvents = getEventsForDayAndHour(day, hour)
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="min-h-12 border-b border-r p-0.5 transition-colors hover:bg-accent/50 last:border-r-0 sm:min-h-16 sm:p-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(day, hour)}
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
    </Card>
  )
}

function DayView({
  currentDate,
  events,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDrop,
  getColorClasses,
}: {
  currentDate: Date
  events: Event[]
  onEventClick: (event: Event) => void
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
    <Card className="overflow-auto">
      <div className="space-y-0">
        {hours.map((hour) => {
          const hourEvents = getEventsForHour(hour)
          return (
            <div
              key={hour}
              className="flex border-b last:border-b-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(currentDate, hour)}
            >
              <div className="w-14 flex-shrink-0 border-r p-2 text-xs text-muted-foreground sm:w-20 sm:p-3 sm:text-sm">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="min-h-16 flex-1 p-1 transition-colors hover:bg-accent/50 sm:min-h-20 sm:p-2">
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
    </Card>
  )
}

function ListView({
  events,
  onEventClick,
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
    <Card className="p-3 sm:p-4">
      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground sm:text-sm">{date}</h3>
            <div className="space-y-2">
              {dateEvents.map((event) => {
                const colorClasses = getColorClasses(event.color)
                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="group cursor-pointer rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:scale-[1.01] sm:p-4"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div
                        className="mt-1 h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 shrink-0"
                        style={{ background: EVENT_STYLES[event.color]?.text ?? "#0055b3" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm group-hover:text-primary transition-colors sm:text-base truncate">
                              {event.title}
                            </h4>
                            {event.description && (
                              <p className="mt-1 text-xs text-muted-foreground sm:text-sm line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {event.category && (
                              <Badge variant="secondary" className="text-xs">
                                {event.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground sm:gap-4 sm:text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
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
                            <div className="flex flex-wrap gap-1">
                              {event.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-[10px] h-4 sm:text-xs sm:h-5"
                                >
                                  {tag}
                                </Badge>
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
          <div className="py-12 text-center text-sm text-muted-foreground sm:text-base">
            No hay eventos
          </div>
        )}
      </div>
    </Card>
  )
}
