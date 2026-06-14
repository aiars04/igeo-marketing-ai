'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventManager, type Event, type PlaybookSummary } from '@/components/ui/event-manager'
import { addPipelineItemFromCalendar } from '@/lib/stores/pipeline-store'
import { useToast, Toasts } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { AlertCircle, Check, X, Upload } from 'lucide-react'
import type { ContentItem, CalendarEvent } from '@/types/database'

// ─── CSV helpers ─────────────────────────────────────────────────────────────

/** Parsea una línea CSV respetando comillas dobles ("" como escape). */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result.map(v => v.trim().replace(/^"|"$/g, ''))
}

const CSV_CHANNEL_TO_COLOR: Record<string, string> = {
  linkedin: 'blue', instagram: 'pink', newsletter: 'green',
  blog: 'orange', x: 'purple', facebook: 'blue',
}

// Clave del localStorage legacy — sólo se usa para detectar eventos pendientes de migrar
const LEGACY_STORAGE_KEY = 'igeo_cal_events_v2'
const MIGRATION_DONE_KEY = 'igeo_cal_migration_done_v1'

// Colores por canal para eventos del pipeline
const PIPELINE_CHANNEL_COLORS: Record<string, string> = {
  linkedin: 'blue', instagram: 'pink', newsletter: 'green',
  blog: 'orange', x: 'purple', facebook: 'blue', email: 'green',
}

/** Convierte un ContentItem con scheduled_at a un Event del calendario */
function pipelineItemToEvent(item: ContentItem): Event {
  const start = new Date(item.scheduled_at!)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    id: `pipeline-${item.id}`,
    title: item.title,
    description: item.description ?? undefined,
    startTime: start,
    endTime: end,
    color: PIPELINE_CHANNEL_COLORS[item.channel] ?? 'blue',
    category: 'Contenido',
    tags: [],
    eventType: 'digital',
    channel: item.channel,
    market: item.market,
  }
}

/** Convierte una fila de Supabase a un Event del UI */
function dbEventToUI(row: CalendarEvent): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    color: row.color,
    category: row.category ?? undefined,
    tags: row.tags ?? [],
    allDay: row.all_day || undefined,
    eventType: row.event_type ?? undefined,
    location: row.location ?? undefined,
    channel: row.channel ?? undefined,
    market: row.market ?? undefined,
  }
}

/** Convierte un Event del UI a payload para Supabase */
function uiEventToDB(ev: Event): Partial<CalendarEvent> {
  return {
    title: ev.title,
    description: ev.description ?? null,
    start_time: (ev.startTime instanceof Date ? ev.startTime : new Date(ev.startTime as unknown as string)).toISOString(),
    end_time:   (ev.endTime   instanceof Date ? ev.endTime   : new Date(ev.endTime   as unknown as string)).toISOString(),
    all_day:    !!ev.allDay,
    color:      ev.color ?? 'blue',
    category:   ev.category ?? null,
    tags:       Array.isArray(ev.tags) ? ev.tags : [],
    event_type: (ev.eventType ?? null) as CalendarEvent['event_type'],
    location:   ev.location ?? null,
    channel:    ev.channel ?? null,
    market:     ev.market ?? null,
  }
}

/** Deserializa eventos legacy de localStorage para migración */
function deserializeLegacy(raw: string | null): Event[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((e: { startTime: string; endTime: string } & Omit<Event, 'startTime' | 'endTime'>) => ({
      ...e,
      startTime: new Date(e.startTime),
      endTime: new Date(e.endTime),
    }))
  } catch {
    return []
  }
}

const PLAYBOOK_MARKETS = [
  { value: 'spain',    label: '🇪🇸 España'       },
  { value: 'latam',    label: 'LATAM'            },
  { value: 'uk',       label: '🌐 Internacional' },
  { value: 'france',   label: '🇫🇷 Francia'      },
  { value: 'italy',    label: '🇮🇹 Italia'       },
  { value: 'portugal', label: '🇵🇹 Portugal'     },
  { value: 'brasil',   label: '🇧🇷 Brasil'       },
  { value: 'mexico',   label: '🇲🇽 México'       },
]

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [pipelineEvents, setPipelineEvents] = useState<Event[]>([])
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()
  const [csvPreview, setCsvPreview] = useState<{
    fileName: string
    parsed: Event[]
    skipped: number
    errors: string[]
  } | null>(null)
  const [pendingMigration, setPendingMigration] = useState<Event[] | null>(null)
  const [migrating, setMigrating] = useState(false)

  // ── Carga eventos de Supabase ─────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar-events')
      if (!res.ok) {
        showToast(`Error cargando eventos: HTTP ${res.status}`, 'error')
        return
      }
      const rows = await res.json() as CalendarEvent[]
      setEvents(rows.map(dbEventToUI))
    } catch (e) {
      showToast(`Error de red: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ── Carga items del pipeline con scheduled_at ─────────────────────────────
  const loadPipelineEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/content-items')
      if (!res.ok) return
      const items = await res.json() as ContentItem[]
      const mapped = items
        .filter(i => i.scheduled_at && !i.calendar_item_id)
        .map(pipelineItemToEvent)
      setPipelineEvents(mapped)
    } catch {}
  }, [])

  // ── Detección de migración pendiente desde localStorage ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const migrationDone = localStorage.getItem(MIGRATION_DONE_KEY)
    if (migrationDone) return
    const legacy = deserializeLegacy(localStorage.getItem(LEGACY_STORAGE_KEY))
    if (legacy.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingMigration(legacy)
    }
  }, [])

  // ── Carga playbooks activos para el selector del modal "Nuevo evento" ─────
  const loadPlaybooks = useCallback(async () => {
    try {
      const res = await fetch('/api/playbooks?active=true')
      if (!res.ok) return
      const data = await res.json() as Array<{ id: string; name: string; type: string; description: string | null }>
      setPlaybooks(data.map(p => ({
        id: p.id, name: p.name, type: p.type, description: p.description,
      })))
    } catch {}
  }, [])

  // ── Carga inicial + escucha cambios del pipeline ──────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents()
    loadPipelineEvents()
    loadPlaybooks()
    const onPipelineChanged = () => loadPipelineEvents()
    window.addEventListener('pipeline:changed', onPipelineChanged)
    return () => window.removeEventListener('pipeline:changed', onPipelineChanged)
  }, [loadEvents, loadPipelineEvents, loadPlaybooks])

  // ── Instancia un playbook desde el modal del calendario ──────────────────
  const instantiatePlaybook = useCallback(async (
    playbookId: string,
    payload: { title: string; anchor_date: string; market?: string; objective?: string },
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        showToast(`Error instanciando playbook: ${j.error ?? res.statusText}`, 'error')
        return { ok: false, error: j.error }
      }
      showToast('Playbook instanciado — tarjetas creadas en el pipeline', 'success')
      // Refrescar pipeline events para que aparezcan los nuevos content_items con fecha
      await loadPipelineEvents()
      window.dispatchEvent(new CustomEvent('pipeline:changed'))
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'desconocido'
      showToast(`Error de red: ${msg}`, 'error')
      return { ok: false, error: msg }
    }
  }, [showToast, loadPipelineEvents])

  // ── Migración one-shot de localStorage → Supabase ─────────────────────────
  const runMigration = async () => {
    if (!pendingMigration || pendingMigration.length === 0) return
    setMigrating(true)
    try {
      const payload = {
        events: pendingMigration.map(uiEventToDB),
      }
      const res = await fetch('/api/calendar-events/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error migrando: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const data = await res.json() as { inserted: number }
      localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
      setPendingMigration(null)
      await loadEvents()
      showToast(`${data.inserted} eventos migrados a Supabase`, 'success')
    } catch (e) {
      showToast(`Error de red: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setMigrating(false)
    }
  }

  const dismissMigration = () => {
    localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
    setPendingMigration(null)
    showToast('Migración descartada — los eventos locales no se subirán', 'info')
  }

  // ── CSV handlers ──────────────────────────────────────────────────────────
  const commitImport = async (parsed: Event[]) => {
    if (parsed.length === 0) return
    const payload = { events: parsed.map(uiEventToDB) }
    try {
      const res = await fetch('/api/calendar-events/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error importando: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const data = await res.json() as { inserted: number; events: CalendarEvent[] }
      setEvents(prev => [...prev, ...data.events.map(dbEventToUI)])

      // Crear tarjetas en pipeline para eventos digitales
      for (const ev of parsed) {
        if (ev.eventType === 'digital') {
          addPipelineItemFromCalendar(ev).catch(() => {})
        }
      }
      showToast(`${data.inserted} eventos importados`, 'success')
    } catch (e) {
      showToast(`Error de red: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    }
  }

  const handleCSVImport = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) {
        showToast('CSV vacío o sin filas de datos', 'error')
        return
      }
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase())
      const parsed: Event[] = []
      let skipped = 0
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i])
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })

          if (!row.titulo) { skipped++; continue }

          const eventType = row.tipo_evento as 'presential' | 'digital'
          if (eventType !== 'presential' && eventType !== 'digital') {
            errors.push(`Línea ${i + 1}: tipo_evento inválido "${row.tipo_evento}"`)
            skipped++
            continue
          }
          const allDay = row.todo_el_dia?.toLowerCase() === 'true'

          const parseDate = (s: string, endOfDay = false): Date | undefined => {
            if (!s) return undefined
            const d = new Date(s.includes('T') ? s : `${s}T${endOfDay ? '23:59:59' : '00:00:00'}`)
            return isNaN(d.getTime()) ? undefined : d
          }
          const startTime = parseDate(row.fecha_inicio)
          if (!startTime) {
            errors.push(`Línea ${i + 1}: fecha_inicio inválida`)
            skipped++
            continue
          }
          const endTime =
            parseDate(row.fecha_fin, allDay) ??
            (allDay ? parseDate(row.fecha_inicio, true) : new Date(startTime.getTime() + 3600_000))

          const channelLower = row.canal?.toLowerCase() || undefined
          const marketLower = (row.mercado || row.market || '').toLowerCase() || undefined
          const autoColor =
            eventType === 'digital' && channelLower
              ? (CSV_CHANNEL_TO_COLOR[channelLower] ?? 'blue')
              : 'blue'
          const color = row.color || autoColor

          parsed.push({
            id: Math.random().toString(36).slice(2, 11),
            title: row.titulo,
            eventType,
            startTime,
            endTime: endTime!,
            color,
            allDay: allDay || undefined,
            description: row.descripcion || undefined,
            tags: [],
            location: eventType === 'presential' ? (row.ubicacion || undefined) : undefined,
            channel:  eventType === 'digital'    ? channelLower : undefined,
            market:   eventType === 'digital'    ? marketLower  : undefined,
          })
        } catch (err) {
          errors.push(`Línea ${i + 1}: ${err instanceof Error ? err.message : 'error de parseo'}`)
          skipped++
        }
      }

      if (errors.length === 0 && parsed.length <= 20) {
        await commitImport(parsed)
      } else {
        setCsvPreview({ fileName: file.name, parsed, skipped, errors })
      }
    } catch (e) {
      showToast(`Error leyendo CSV: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    }
  }

  const downloadCSVTemplate = () => {
    const template = [
      'titulo,tipo_evento,canal,mercado,fecha_inicio,fecha_fin,todo_el_dia,ubicacion,descripcion,color',
      '"Feria TECNA Madrid",presential,,,2026-06-15,2026-06-19,true,"Madrid, España","Stand B12 — sector agua",blue',
      '"Post LinkedIn — ERP sanidad ambiental",digital,linkedin,spain,2026-06-10T10:00,,false,,,',
      '"Newsletter mensual junio",digital,newsletter,spain,2026-06-30T09:00,,false,,,green',
    ].join('\n')
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_calendario_igeo.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

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

      {/* ── Banner de migración pendiente ── */}
      {pendingMigration && pendingMigration.length > 0 && (
        <div
          className="flex items-center gap-3 mb-4"
          style={{
            padding: '12px 16px',
            background: 'var(--amber-soft)',
            border: '1px solid var(--amber-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Upload size={16} aria-hidden="true" style={{ color: 'var(--amber-2)', flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber-2)', lineHeight: 1.3 }}>
              {pendingMigration.length} evento{pendingMigration.length === 1 ? '' : 's'} guardado{pendingMigration.length === 1 ? '' : 's'} localmente
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              Importa estos eventos a Supabase para acceder a ellos desde cualquier dispositivo.
            </p>
          </div>
          <button
            onClick={dismissMigration}
            disabled={migrating}
            className="btn-secondary"
            style={{ height: 32, fontSize: 12 }}
          >
            Descartar
          </button>
          <button
            onClick={runMigration}
            disabled={migrating}
            className="btn-cta"
            style={{ height: 32, fontSize: 12 }}
          >
            {migrating ? 'Importando…' : `Importar ${pendingMigration.length}`}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Cargando eventos…
        </div>
      ) : (
        <EventManager
          events={[...events, ...pipelineEvents]}
          onEventCreate={async (ev) => {
            // 1) Optimistic — añadir al estado con id temporal
            const tempId = ev.id
            setEvents(prev => [...prev, ev])
            try {
              const res = await fetch('/api/calendar-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uiEventToDB(ev)),
              })
              if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                showToast(`Error: ${j.error ?? res.statusText}`, 'error')
                setEvents(prev => prev.filter(e => e.id !== tempId))
                return
              }
              const row = await res.json() as CalendarEvent
              // Reemplazar el evento temporal con el real (con id de Supabase)
              setEvents(prev => prev.map(e => e.id === tempId ? dbEventToUI(row) : e))

              // Si es evento digital → crear tarjeta en pipeline
              if (ev.eventType === 'digital') {
                const result = await addPipelineItemFromCalendar(ev)
                if (result.ok) {
                  showToast('Evento creado · Tarjeta añadida a Pipeline', 'success')
                  await loadPipelineEvents()
                } else if (result.duplicate) {
                  showToast('Evento creado (ya existía la tarjeta en Pipeline)', 'info')
                } else {
                  showToast('Evento creado', 'success')
                }
              } else {
                showToast('Evento creado', 'success')
              }
            } catch (e) {
              showToast(`Error de red: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
              setEvents(prev => prev.filter(e => e.id !== tempId))
            }
          }}
          onEventUpdate={async (id, partial) => {
            // Pipeline events — PATCH a content-items
            if (id.startsWith('pipeline-')) {
              const itemId = id.replace('pipeline-', '')
              if (partial.startTime) {
                await fetch(`/api/content-items/${itemId}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scheduled_at: new Date(partial.startTime).toISOString() }),
                }).catch(() => null)
                await loadPipelineEvents()
              } else {
                setPipelineEvents(prev => prev.map(e => e.id === id ? { ...e, ...partial } : e))
              }
              return
            }

            // Calendar events — optimistic + PATCH
            const prev = events.find(e => e.id === id)
            if (!prev) return
            setEvents(p => p.map(e => e.id === id ? { ...e, ...partial } : e))
            try {
              const merged = { ...prev, ...partial } as Event
              const res = await fetch(`/api/calendar-events/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uiEventToDB(merged)),
              })
              if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                showToast(`Error: ${j.error ?? res.statusText}`, 'error')
                setEvents(p => p.map(e => e.id === id ? prev : e))
              }
            } catch (e) {
              showToast(`Error de red: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
              setEvents(p => p.map(e => e.id === id ? prev : e))
            }
          }}
          onEventDelete={async (id) => {
            // Pipeline events — PATCH scheduled_at: null
            if (id.startsWith('pipeline-')) {
              const itemId = id.replace('pipeline-', '')
              await fetch(`/api/content-items/${itemId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduled_at: null }),
              }).catch(() => null)
              setPipelineEvents(prev => prev.filter(e => e.id !== id))
              return
            }

            // Calendar events — optimistic + DELETE
            const prev = events.find(e => e.id === id)
            if (!prev) return
            setEvents(p => p.filter(e => e.id !== id))
            try {
              const res = await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                showToast(`Error: ${j.error ?? res.statusText}`, 'error')
                setEvents(p => [...p, prev])
              }
            } catch (e) {
              showToast(`Error de red: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
              setEvents(p => [...p, prev])
            }
          }}
          categories={['Contenido', 'Acontecimiento', 'Reunión', 'Tarea', 'Personal']}
          availableTags={['Importante', 'Urgente', 'Trabajo', 'Cliente', 'Equipo', 'Personal']}
          defaultView="month"
          onImportCSV={handleCSVImport}
          onDownloadTemplate={downloadCSVTemplate}
          playbooks={playbooks}
          playbookMarkets={PLAYBOOK_MARKETS}
          onPlaybookInstantiate={instantiatePlaybook}
        />
      )}

      {/* ─── Modal preview import CSV (solo si hay errores o >20 eventos) ─── */}
      <Modal
        open={!!csvPreview}
        onClose={() => setCsvPreview(null)}
        title="Importar CSV"
        size="md"
      >
        {csvPreview && (
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              Archivo:{' '}
              <code style={{
                fontSize: 11, padding: '1px 6px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                {csvPreview.fileName}
              </code>
            </p>

            <div className="flex flex-col gap-2">
              <div
                className="flex items-center gap-2"
                style={{ padding: '8px 12px', background: 'var(--green-soft)', borderRadius: 'var(--radius-sm)' }}
              >
                <Check size={14} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-2)' }}>
                  {csvPreview.parsed.length} evento{csvPreview.parsed.length === 1 ? '' : 's'} válido{csvPreview.parsed.length === 1 ? '' : 's'}
                </span>
              </div>
              {csvPreview.skipped > 0 && (
                <div
                  className="flex items-center gap-2"
                  style={{ padding: '8px 12px', background: 'var(--amber-soft)', borderRadius: 'var(--radius-sm)' }}
                >
                  <AlertCircle size={14} aria-hidden="true" style={{ color: '#b25000' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#b25000' }}>
                    {csvPreview.skipped} fila{csvPreview.skipped === 1 ? '' : 's'} omitida{csvPreview.skipped === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>

            {csvPreview.errors.length > 0 && (
              <div
                style={{
                  background: 'var(--red-soft)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 12,
                }}
              >
                <p
                  style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--red-2)', marginBottom: 6,
                  }}
                >
                  Errores ({csvPreview.errors.length})
                </p>
                <ul style={{
                  fontSize: 12, color: 'var(--red-2)', lineHeight: 1.6,
                  margin: 0, paddingLeft: 16, maxHeight: 200, overflowY: 'auto',
                }}>
                  {csvPreview.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                </ul>
              </div>
            )}

            <div
              className="flex items-center justify-end gap-2 pt-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button className="btn-secondary" onClick={() => setCsvPreview(null)}>
                <X size={13} aria-hidden="true" /> Cancelar
              </button>
              <button
                className="btn-cta"
                onClick={async () => {
                  await commitImport(csvPreview.parsed)
                  setCsvPreview(null)
                }}
                disabled={csvPreview.parsed.length === 0}
              >
                <Check size={13} aria-hidden="true" /> Importar {csvPreview.parsed.length}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
