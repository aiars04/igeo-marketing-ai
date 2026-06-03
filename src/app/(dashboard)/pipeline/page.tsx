'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { PipelineBoard } from '@/components/pipeline/PipelineBoard'
import { Sparkles, Filter, X, Loader2 } from 'lucide-react'
import { cn, STAGE_CONFIG, STAGES } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { ContentItem, Stage, Channel } from '@/types/database'
import { PIPELINE_CHANGED_EVENT } from '@/lib/stores/pipeline-store'

const ALL_CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  x: 'X / Twitter', blog: 'Blog', email: 'Email', newsletter: 'Newsletter',
}

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  value, label, variant = 'default',
}: {
  value: string | number
  label: string
  variant?: 'default' | 'amber' | 'emerald'
}) {
  const styles = {
    default: { bg: 'var(--surface-2)',  color: 'var(--ink-2)' },
    amber:   { bg: 'var(--amber-soft)', color: '#b25000'      },
    emerald: { bg: 'var(--green-soft)', color: '#248a3d'      },
  }[variant]

  return (
    <div
      className="inline-flex items-center gap-1.5 tabular-nums"
      style={{
        height: 24,
        padding: '0 10px',
        background: styles.bg,
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        fontSize: 11,
        fontWeight: 600,
        color: styles.color,
        lineHeight: 1,
      }}
    >
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [itemImageMap, setItemImageMap] = useState<Record<string, string>>({}) // content_item_id → url
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterChannels, setFilterChannels] = useState<Channel[]>([])
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Carga inicial: items + map de imágenes asignadas ──────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const [iRes, aRes] = await Promise.all([
        fetch('/api/content-items'),
        fetch('/api/images'),
      ])
      if (iRes.ok) {
        const data = await iRes.json() as ContentItem[]
        setItems(data)
      } else {
        showToast(`Error cargando pipeline: HTTP ${iRes.status}`, 'error')
      }
      if (aRes.ok) {
        const assets = await aRes.json() as Array<{ url: string; content_item_id: string | null }>
        const map: Record<string, string> = {}
        for (const a of assets) {
          if (a.content_item_id && !map[a.content_item_id]) {
            map[a.content_item_id] = a.url
          }
        }
        setItemImageMap(map)
      }
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchItems() }, [fetchItems])

  // ── Sincronización con cambios externos (calendar→pipeline) ───────────────
  useEffect(() => {
    const onChanged = () => fetchItems()
    window.addEventListener(PIPELINE_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PIPELINE_CHANGED_EVENT, onChanged)
  }, [fetchItems])

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalItems = items.length
  const inRevision = useMemo(() => items.filter(i => i.status === 'in_progress').length, [items])
  const scheduled  = useMemo(() => items.filter(i => i.stage === 'scheduled').length, [items])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (stage: Stage, data: { title: string; channel: Channel }) => {
    const res = await fetch('/api/content-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: data.title, channel: data.channel, stage }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    const item = await res.json() as ContentItem
    setItems(prev => [item, ...prev])
    showToast(`Añadido a ${STAGE_CONFIG[stage].label}`, 'success')
  }, [showToast])

  const handleMove = useCallback(async (id: string, newStage: Stage) => {
    const prev = items.find(i => i.id === id)
    if (!prev) return
    // Optimistic
    setItems(p => p.map(i => i.id === id ? { ...i, stage: newStage } : i))
    const res = await fetch(`/api/content-items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      setItems(p => p.map(i => i.id === id ? { ...i, stage: prev.stage } : i))
      return
    }
    showToast(`Movido a ${STAGE_CONFIG[newStage].label}`, 'info')
  }, [items, showToast])

  const handleDelete = useCallback(async (id: string) => {
    const prev = items
    setItems(p => p.filter(i => i.id !== id))
    const res = await fetch(`/api/content-items/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      setItems(prev)
      return
    }
    showToast('Elemento eliminado', 'info')
  }, [items, showToast])

  const handleApprove = useCallback(async (id: string, currentStage: Stage) => {
    const currentIdx = STAGES.indexOf(currentStage)
    const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null
    if (!nextStage) return
    const now = new Date().toISOString()
    const patch = {
      human_approved: true,
      approved_at: now,
      status: 'approved' as const,
      stage: nextStage,
    }
    setItems(p => p.map(i => i.id === id ? { ...i, ...patch } : i))
    const res = await fetch(`/api/content-items/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      fetchItems()
      return
    }
    showToast(`✓ Aprobado → ${STAGE_CONFIG[nextStage].label}`, 'success')
  }, [showToast, fetchItems])

  const handleGenerateAI = useCallback(async () => {
    setAiLoading(true)
    // Stub demo — crea 2 ideas básicas en BD. Sustituir por LLM real más adelante.
    const drafts = [
      { title: 'LinkedIn: Transformación digital en empresas de control de plagas — caso real iGEO', channel: 'linkedin' as Channel },
      { title: 'Instagram: 5 pasos para digitalizar tu equipo de campo en 30 días',                  channel: 'instagram' as Channel },
    ]
    const created: ContentItem[] = []
    for (const d of drafts) {
      const res = await fetch('/api/content-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, stage: 'ideas', ai_generated: true }),
      })
      if (res.ok) created.push(await res.json())
    }
    if (created.length) setItems(prev => [...created, ...prev])
    setAiLoading(false)
    setAiModalOpen(false)
    showToast(`IA generó ${created.length} ideas`, 'success')
  }, [showToast])

  const toggleFilterChannel = (ch: Channel) => {
    setFilterChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header pipeline */}
      <header
        className="shrink-0"
        style={{
          padding: '20px 20px 16px 20px',
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div className="shrink-0 min-w-0 flex flex-col">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Pipeline
          </h1>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', margin: '3px 0 0', letterSpacing: '0.01em' }}>
            Agente Marketing · iGEO
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2" style={{ marginLeft: 4 }}>
          <StatPill value={totalItems} label="piezas"      variant="default" />
          <StatPill value={inRevision} label="en revisión" variant="amber"   />
          <StatPill value={scheduled}  label="programado"  variant="emerald" />
        </div>

        <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={cn('btn-pill-secondary relative', filterOpen && 'is-active')}
          >
            <Filter size={13} aria-hidden="true" />
            Filtrar
            {filterChannels.length > 0 && (
              <span
                className="absolute -top-1 -right-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white tabular-nums"
                style={{ width: 16, height: 16, background: 'var(--accent)' }}
              >
                {filterChannels.length}
              </span>
            )}
          </button>

          <button onClick={() => setAiModalOpen(true)} className="btn-cta">
            <Sparkles size={13} aria-hidden="true" />
            Generar con IA
          </button>
        </div>
      </header>

      {/* Filter bar */}
      {filterOpen && (
        <div
          className="flex items-center gap-2 px-5 py-3 flex-wrap shrink-0 animate-fade-up"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <span className="section-label mr-2">Canal</span>
          {ALL_CHANNELS.map(ch => (
            <button
              key={ch}
              onClick={() => toggleFilterChannel(ch)}
              className={cn(
                'px-2.5 rounded-md text-[11px] font-semibold transition-all',
                filterChannels.includes(ch) ? 'text-white' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              )}
              style={{
                height: 28,
                ...(filterChannels.includes(ch)
                  ? { background: 'var(--accent)', border: '1px solid var(--accent)' }
                  : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
                ),
              }}
            >
              {CHANNEL_LABELS[ch]}
            </button>
          ))}
          {filterChannels.length > 0 && (
            <button
              onClick={() => setFilterChannels([])}
              className="flex items-center gap-1 px-2.5 rounded-md text-[11px] font-medium transition-colors"
              style={{
                height: 28,
                background: 'var(--red-soft)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: 'var(--red-2)',
              }}
            >
              <X size={11} />
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--ink-3)' }}>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            <span className="text-[13px]">Cargando pipeline…</span>
          </div>
        ) : (
          <PipelineBoard
            items={items}
            filterChannels={filterChannels}
            onAdd={handleAdd}
            onMove={handleMove}
            onDelete={handleDelete}
            onApprove={handleApprove}
            itemImageMap={itemImageMap}
          />
        )}
      </div>

      {/* AI Modal */}
      <Modal
        open={aiModalOpen}
        onClose={() => { if (!aiLoading) setAiModalOpen(false) }}
        title="Generar ideas con IA"
        size="sm"
      >
        {aiLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-2)' }} />
            <div className="text-center">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Generando ideas con IA...
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                Analizando contexto de marca y mercado
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              La IA analizará tu contexto de marca y generará nuevas ideas de contenido para tu pipeline.
            </p>
            <div className="rounded-lg p-3 flex flex-col gap-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-3)' }}>
                Canales objetivo
              </p>
              {(['linkedin', 'instagram', 'x'] as Channel[]).map(ch => (
                <div key={ch} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink)' }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent-2)', flexShrink: 0 }}
                  />
                  {CHANNEL_LABELS[ch]}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAiModalOpen(false)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button
                onClick={handleGenerateAI}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} />
                Generar ahora
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
