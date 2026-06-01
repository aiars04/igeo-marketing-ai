'use client'

import { useState, useCallback, useEffect } from 'react'
import { PipelineBoard } from '@/components/pipeline/PipelineBoard'
import { Sparkles, Filter, X, Loader2 } from 'lucide-react'
import { cn, STAGE_CONFIG, STAGES } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { ContentItem, Stage, Channel } from '@/types/database'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ITEMS: ContentItem[] = [
  { id:'1', stage:'ideas',     title:'5 señales de que tu empresa necesita un ERP especializado',            channel:'linkedin',   market:'spain', campaign:'Q2-awareness',     content:null,       status:'pending',     ai_generated:true,  clarity_pass:null,  clarity_summary:null,                  human_approved:false, approved_by:null,    approved_at:null,     scheduled_at:null,              published_at:null,       postiz_id:null, calendar_item_id:null, created_at:'2026-05-19', updated_at:'2026-05-19' },
  { id:'2', stage:'ideas',     title:'Cómo digitalizar una empresa de control de plagas sin complicaciones', channel:'instagram',  market:'spain', campaign:'Q2-awareness',     content:null,       status:'pending',     ai_generated:true,  clarity_pass:null,  clarity_summary:null,                  human_approved:false, approved_by:null,    approved_at:null,     scheduled_at:null,              published_at:null,       postiz_id:null, calendar_item_id:null, created_at:'2026-05-19', updated_at:'2026-05-19' },
  { id:'3', stage:'ideas',     title:'Newsletter: Novedades iGEO mayo 2026',                                channel:'newsletter', market:'spain', campaign:'mayo-2026',         content:null,       status:'pending',     ai_generated:false, clarity_pass:null,  clarity_summary:null,                  human_approved:false, approved_by:null,    approved_at:null,     scheduled_at:null,              published_at:null,       postiz_id:null, calendar_item_id:null, created_at:'2026-05-18', updated_at:'2026-05-18' },
  { id:'4', stage:'copy',      title:'Trazabilidad en legionella: guía completa para empresas de SAL',      channel:'blog',       market:'spain', campaign:'Q2-seo',            content:'# Intro…', status:'in_progress', ai_generated:true,  clarity_pass:true,  clarity_summary:'Pasa todos los tests', human_approved:false, approved_by:null,    approved_at:null,     scheduled_at:null,              published_at:null,       postiz_id:null, calendar_item_id:null, created_at:'2026-05-17', updated_at:'2026-05-19' },
  { id:'5', stage:'copy',      title:'Control operativo en 5 pasos — Carrusel Instagram',                   channel:'instagram',  market:'spain', campaign:'Q2-awareness',     content:'Slide 1…', status:'approved',    ai_generated:true,  clarity_pass:true,  clarity_summary:'Ok',                  human_approved:true,  approved_by:'Ramón', approved_at:'2026-05-19', scheduled_at:null,              published_at:null,       postiz_id:null, calendar_item_id:null, created_at:'2026-05-16', updated_at:'2026-05-19' },
  { id:'6', stage:'design',    title:'Imágenes carrusel — Control operativo en 5 pasos',                    channel:'instagram',  market:'spain', campaign:'Q2-awareness',     content:null,       status:'in_progress', ai_generated:true,  clarity_pass:null,  clarity_summary:null,                  human_approved:false, approved_by:null,    approved_at:null,     scheduled_at:null,              published_at:null,       postiz_id:null, calendar_item_id:null, created_at:'2026-05-18', updated_at:'2026-05-19' },
  { id:'7', stage:'scheduled', title:'LinkedIn: ERP para sanidad ambiental — por qué el sector importa',   channel:'linkedin',   market:'spain', campaign:'Q2-decision',      content:'Post…',    status:'approved',    ai_generated:true,  clarity_pass:true,  clarity_summary:'Ok',                  human_approved:true,  approved_by:'Silvia',approved_at:'2026-05-18', scheduled_at:'2026-05-21T09:00:00', published_at:null,       postiz_id:'ptz_123', calendar_item_id:null, created_at:'2026-05-15', updated_at:'2026-05-18' },
  { id:'9', stage:'analyzed',  title:'Post LinkedIn — Gestión documental en servicios técnicos',            channel:'linkedin',   market:'spain', campaign:'Q2-consideration', content:'Post…',    status:'approved',    ai_generated:true,  clarity_pass:true,  clarity_summary:'Ok',                  human_approved:true,  approved_by:'Silvia',approved_at:'2026-05-08', scheduled_at:null,              published_at:'2026-05-10', postiz_id:null,      calendar_item_id:null, created_at:'2026-05-05', updated_at:'2026-05-17' },
]

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
    default: { bg: 'var(--surface-2)',  border: 'var(--border)',           color: 'var(--ink-2)' },
    amber:   { bg: 'var(--amber-soft)', border: 'rgba(255, 159, 10, 0.25)', color: '#b25000'      },
    emerald: { bg: 'var(--green-soft)', border: 'var(--green-border)',     color: '#248a3d'      },
  }[variant]

  return (
    <div
      className="inline-flex items-center gap-1.5 tabular-nums"
      style={{
        height: 24,
        padding: '0 10px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
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
  const [items, setItems] = useState<ContentItem[]>(MOCK_ITEMS)
  const [hydrated, setHydrated] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // ── LocalStorage persistence ───────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('igeo_pipeline_v1')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem('igeo_pipeline_v1', JSON.stringify(items)) } catch {}
  }, [items, hydrated])
  const [filterChannels, setFilterChannels] = useState<Channel[]>([])
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalItems = items.length
  const inRevision = items.filter(i => i.status === 'in_progress').length
  const scheduled  = items.filter(i => i.stage === 'scheduled').length

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback((stage: Stage, data: { title: string; channel: Channel }) => {
    const now = new Date().toISOString().split('T')[0]
    const newItem: ContentItem = {
      id: Math.random().toString(36).slice(2),
      calendar_item_id: null,
      stage,
      title: data.title,
      channel: data.channel,
      market: 'spain',
      campaign: null,
      content: null,
      status: 'pending',
      ai_generated: false,
      clarity_pass: null,
      clarity_summary: null,
      human_approved: false,
      approved_by: null,
      approved_at: null,
      scheduled_at: null,
      published_at: null,
      postiz_id: null,
      created_at: now,
      updated_at: now,
    }
    setItems(prev => [...prev, newItem])
    showToast(`Añadido a ${STAGE_CONFIG[stage].label}`, 'success')
  }, [showToast])

  const handleMove = useCallback((id: string, newStage: Stage) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, stage: newStage, updated_at: new Date().toISOString().split('T')[0] } : i))
    showToast(`Movido a ${STAGE_CONFIG[newStage].label}`, 'info')
  }, [showToast])

  const handleDelete = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    showToast('Elemento eliminado', 'info')
  }, [showToast])

  const handleApprove = useCallback((id: string, currentStage: Stage) => {
    const currentIdx = STAGES.indexOf(currentStage)
    const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null
    if (!nextStage) return
    const now = new Date().toISOString().split('T')[0]
    setItems(prev => prev.map(i => i.id === id
      ? { ...i, human_approved: true, approved_by: 'Ramón', approved_at: now, status: 'approved' as const, stage: nextStage, updated_at: now }
      : i
    ))
    showToast(`✓ Aprobado → ${STAGE_CONFIG[nextStage].label}`, 'success')
  }, [showToast])

  const handleGenerateAI = useCallback(async () => {
    setAiLoading(true)
    await new Promise(r => setTimeout(r, 2000))
    const now = new Date().toISOString().split('T')[0]
    const aiItems: ContentItem[] = [
      {
        id: Math.random().toString(36).slice(2),
        calendar_item_id: null,
        stage: 'ideas',
        title: 'LinkedIn: Transformación digital en empresas de control de plagas — caso real iGEO',
        channel: 'linkedin',
        market: 'spain',
        campaign: 'Q2-awareness',
        content: null,
        status: 'pending',
        ai_generated: true,
        clarity_pass: null,
        clarity_summary: null,
        human_approved: false,
        approved_by: null,
        approved_at: null,
        scheduled_at: null,
        published_at: null,
        postiz_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: Math.random().toString(36).slice(2),
        calendar_item_id: null,
        stage: 'ideas',
        title: 'Instagram: 5 pasos para digitalizar tu equipo de campo en 30 días',
        channel: 'instagram',
        market: 'spain',
        campaign: 'Q2-awareness',
        content: null,
        status: 'pending',
        ai_generated: true,
        clarity_pass: null,
        clarity_summary: null,
        human_approved: false,
        approved_by: null,
        approved_at: null,
        scheduled_at: null,
        published_at: null,
        postiz_id: null,
        created_at: now,
        updated_at: now,
      },
    ]
    setItems(prev => [...aiItems, ...prev])
    setAiLoading(false)
    setAiModalOpen(false)
    showToast('IA generó 2 nuevas ideas', 'success')
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
        {/* Bloque título + subtítulo */}
        <div className="shrink-0 min-w-0 flex flex-col">
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            Pipeline
          </h1>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-3)',
              margin: '3px 0 0',
              letterSpacing: '0.01em',
            }}
          >
            Agente Marketing · iGEO
          </p>
        </div>

        {/* Stat pills — 3 estilos distintos según tipo */}
        <div
          className="hidden md:flex items-center gap-2"
          style={{ marginLeft: 4 }}
        >
          <StatPill value={totalItems} label="piezas"      variant="default" />
          <StatPill value={inRevision} label="en revisión" variant="amber"   />
          <StatPill value={scheduled}  label="programado"  variant="emerald" />
        </div>

        {/* Acciones — pegadas a la derecha */}
        <div
          className="flex items-center gap-2 shrink-0"
          style={{ marginLeft: 'auto' }}
        >
          {/* Filtrar */}
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

          {/* Generar con IA */}
          <button
            onClick={() => setAiModalOpen(true)}
            className="btn-cta"
          >
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
        <PipelineBoard
          items={items}
          filterChannels={filterChannels}
          onAdd={handleAdd}
          onMove={handleMove}
          onDelete={handleDelete}
          onApprove={handleApprove}
        />
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
