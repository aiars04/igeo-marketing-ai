'use client'

import { useEffect, useState } from 'react'
import { EventManager, type Event } from '@/components/ui/event-manager'
import { addPipelineItemFromCalendar } from '@/lib/stores/pipeline-store'
import { useToast, Toasts } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { AlertCircle, Check, X } from 'lucide-react'

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
  const [csvPreview, setCsvPreview] = useState<{
    fileName: string
    parsed: Event[]
    skipped: number
    errors: string[]
  } | null>(null)

  // ── CSV handlers ──────────────────────────────────────────────────────────
  const commitImport = (parsed: Event[]) => {
    if (parsed.length === 0) return
    setEvents(prev => [...prev, ...parsed])
    for (const ev of parsed) {
      if (ev.eventType === 'digital') {
        addPipelineItemFromCalendar(ev).catch(() => {})
      }
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
        commitImport(parsed)
        showToast(
          `${parsed.length} evento${parsed.length === 1 ? '' : 's'} importado${parsed.length === 1 ? '' : 's'}`,
          'success',
        )
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

  // Cargar de localStorage al montar (sync con external storage)
  useEffect(() => {
    const saved = deserialize(localStorage.getItem(STORAGE_KEY))
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        onEventCreate={async (ev) => {
          setEvents(prev => [...prev, ev])
          // Si es evento digital → crear tarjeta en pipeline (fase Ideas)
          if (ev.eventType === 'digital') {
            const result = await addPipelineItemFromCalendar(ev)
            if (result.ok) {
              showToast('Evento creado · Tarjeta añadida a Pipeline (Ideas)', 'success')
            } else if (result.duplicate) {
              showToast('Evento creado (ya existía la tarjeta en Pipeline)', 'info')
            } else {
              showToast(`Evento creado, pero falló el Pipeline: ${result.error ?? 'error'}`, 'error')
            }
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
        onImportCSV={handleCSVImport}
        onDownloadTemplate={downloadCSVTemplate}
      />

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
                onClick={() => {
                  commitImport(csvPreview.parsed)
                  showToast(`${csvPreview.parsed.length} eventos importados`, 'success')
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
