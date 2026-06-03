/**
 * Pipeline store — ahora respaldado por Supabase via /api/content-items
 * (antes localStorage). Mantiene el evento custom 'pipeline:changed' para
 * que otras páginas (calendario) puedan notificar cambios al pipeline abierto.
 */
import type { ContentItem, Channel, Market } from '@/types/database'
import type { Event as CalendarEvent } from '@/components/ui/event-manager'

const EVENT_NAME = 'pipeline:changed'

/** Mapea un Evento del calendario a un payload listo para POST /api/content-items. */
export function calendarEventToContentItemInput(event: CalendarEvent): Partial<ContentItem> {
  const startISO =
    event.startTime instanceof Date
      ? event.startTime.toISOString()
      : new Date(event.startTime as unknown as string).toISOString()

  return {
    calendar_item_id: event.id,
    stage: 'ideas',
    title: event.title,
    channel: (event.channel as Channel) ?? 'linkedin',
    market: (event.market as Market) ?? 'spain',
    scheduled_at: startISO,
    ai_generated: false,
  }
}

/** Crea un ítem del pipeline desde el calendario. Dedup vía calendar_item_id en server. */
export async function addPipelineItemFromCalendar(event: CalendarEvent): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'server' }
  try {
    const payload = calendarEventToContentItemInput(event)
    const res = await fetch('/api/content-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 409) {
      return { ok: false, duplicate: true }
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { ok: false, error: j.error ?? `HTTP ${res.status}` }
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

export { EVENT_NAME as PIPELINE_CHANGED_EVENT }
