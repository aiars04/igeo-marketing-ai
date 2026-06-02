import type { ContentItem } from '@/types/database'
import type { Event as CalendarEvent } from '@/components/ui/event-manager'

const KEY = 'igeo_pipeline_v1'
const EVENT_NAME = 'pipeline:changed'

export function loadPipelineItems(): ContentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function savePipelineItems(items: ContentItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {}
}

export function addPipelineItem(item: ContentItem): void {
  const items = loadPipelineItems()
  // dedup por calendar_item_id si existe
  if (item.calendar_item_id && items.some(i => i.calendar_item_id === item.calendar_item_id)) return
  savePipelineItems([item, ...items])
}

export function removePipelineItemsByCalendarId(calendarId: string): void {
  const items = loadPipelineItems()
  savePipelineItems(
    items.map(i =>
      i.calendar_item_id === calendarId
        ? { ...i, calendar_item_id: null } // huérfano, vida propia
        : i,
    ),
  )
}

export function calendarEventToContentItem(event: CalendarEvent): ContentItem {
  const today = new Date().toISOString().split('T')[0]
  const startISO =
    event.startTime instanceof Date
      ? event.startTime.toISOString()
      : new Date(event.startTime as unknown as string).toISOString()

  return {
    id: Math.random().toString(36).slice(2, 11),
    calendar_item_id: event.id,
    stage: 'ideas',
    title: event.title,
    channel: (event.channel as ContentItem['channel']) ?? 'linkedin',
    market: (event.market as ContentItem['market']) ?? 'spain',
    campaign: null,
    content: null,
    status: 'pending',
    ai_generated: false,
    clarity_pass: null,
    clarity_summary: null,
    human_approved: false,
    approved_by: null,
    approved_at: null,
    scheduled_at: startISO,
    published_at: null,
    postiz_id: null,
    created_at: today,
    updated_at: today,
  }
}

export { EVENT_NAME as PIPELINE_CHANGED_EVENT, KEY as PIPELINE_STORAGE_KEY }
