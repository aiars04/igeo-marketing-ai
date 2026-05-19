'use client'

import { useState } from 'react'
import { Plus, Sparkles, MoreHorizontal, ArrowRight } from 'lucide-react'
import { cn, STAGE_CONFIG, CHANNEL_CONFIG, MARKET_CONFIG, STAGES } from '@/lib/utils'
import type { ContentItem, Stage } from '@/types/database'

// ─── Mock data until Supabase is wired ───
const MOCK_ITEMS: ContentItem[] = [
  { id:'1', stage:'ideas',     title:'5 señales de que tu empresa necesita un ERP especializado', channel:'linkedin',   market:'spain',   campaign:'Q2-awareness', content:null, status:'pending',     ai_generated:true,  clarity_pass:null,  clarity_summary:null, human_approved:false, approved_by:null, approved_at:null, scheduled_at:null, published_at:null, postiz_id:null, calendar_item_id:null, created_at:'2026-05-19', updated_at:'2026-05-19' },
  { id:'2', stage:'ideas',     title:'Cómo digitalizar una empresa de control de plagas sin complicaciones', channel:'instagram', market:'spain',   campaign:'Q2-awareness', content:null, status:'pending',     ai_generated:true,  clarity_pass:null,  clarity_summary:null, human_approved:false, approved_by:null, approved_at:null, scheduled_at:null, published_at:null, postiz_id:null, calendar_item_id:null, created_at:'2026-05-19', updated_at:'2026-05-19' },
  { id:'3', stage:'ideas',     title:'Newsletter: Novedades iGEO mayo 2026',                                channel:'newsletter',market:'spain',   campaign:'mayo-2026',    content:null, status:'pending',     ai_generated:false, clarity_pass:null,  clarity_summary:null, human_approved:false, approved_by:null, approved_at:null, scheduled_at:null, published_at:null, postiz_id:null, calendar_item_id:null, created_at:'2026-05-18', updated_at:'2026-05-18' },
  { id:'4', stage:'copy',      title:'Trazabilidad en legionella: guía completa',                           channel:'blog',     market:'spain',   campaign:'Q2-seo',       content:'# Intro...', status:'in_progress', ai_generated:true,  clarity_pass:true,  clarity_summary:'Pasa todos los tests', human_approved:false, approved_by:null, approved_at:null, scheduled_at:null, published_at:null, postiz_id:null, calendar_item_id:null, created_at:'2026-05-17', updated_at:'2026-05-19' },
  { id:'5', stage:'copy',      title:'Control operativo en 5 pasos — Carrusel Instagram',                  channel:'instagram',market:'spain',   campaign:'Q2-awareness', content:'Slide 1...', status:'approved',    ai_generated:true,  clarity_pass:true,  clarity_summary:'Ok', human_approved:true, approved_by:'Ramón', approved_at:'2026-05-19', scheduled_at:null, published_at:null, postiz_id:null, calendar_item_id:null, created_at:'2026-05-16', updated_at:'2026-05-19' },
  { id:'6', stage:'design',    title:'Imágenes carrusel — Control operativo en 5 pasos',                   channel:'instagram',market:'spain',   campaign:'Q2-awareness', content:null, status:'in_progress', ai_generated:true,  clarity_pass:null,  clarity_summary:null, human_approved:false, approved_by:null, approved_at:null, scheduled_at:null, published_at:null, postiz_id:null, calendar_item_id:null, created_at:'2026-05-18', updated_at:'2026-05-19' },
  { id:'7', stage:'scheduled', title:'LinkedIn: ERP para sanidad ambiental — por qué el sector importa', channel:'linkedin', market:'spain',   campaign:'Q2-decision',  content:'Post...', status:'approved',    ai_generated:true,  clarity_pass:true,  clarity_summary:'Ok', human_approved:true, approved_by:'Silvia', approved_at:'2026-05-18', scheduled_at:'2026-05-21T09:00:00', published_at:null, postiz_id:'ptz_123', calendar_item_id:null, created_at:'2026-05-15', updated_at:'2026-05-18' },
  { id:'8', stage:'published', title:'Software para control de plagas: qué buscar',                        channel:'blog',     market:'spain',   campaign:'Q2-seo',       content:'Article...', status:'approved', ai_generated:true,  clarity_pass:true,  clarity_summary:'Ok', human_approved:true, approved_by:'Silvia', approved_at:'2026-05-14', scheduled_at:null, published_at:'2026-05-15', postiz_id:null, calendar_item_id:null, created_at:'2026-05-10', updated_at:'2026-05-15' },
  { id:'9', stage:'analyzed',  title:'Post LinkedIn — Gestión documental en servicios técnicos',           channel:'linkedin', market:'spain',   campaign:'Q2-consideration', content:'Post...', status:'approved', ai_generated:true, clarity_pass:true, clarity_summary:'Ok', human_approved:true, approved_by:'Silvia', approved_at:'2026-05-08', scheduled_at:null, published_at:'2026-05-10', postiz_id:null, calendar_item_id:null, created_at:'2026-05-05', updated_at:'2026-05-17' },
]

const ITEMS = MOCK_ITEMS

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     'bg-slate-500',
    in_progress: 'bg-amber-400 animate-pulse-dot',
    approved:    'bg-emerald-400',
    rejected:    'bg-rose-400',
  }
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full', map[status] ?? 'bg-slate-500')} />
}

function ContentCard({ item }: { item: ContentItem }) {
  const ch = CHANNEL_CONFIG[item.channel]
  const mk = MARKET_CONFIG[item.market]

  return (
    <div className={cn(
      'group relative bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-3.5',
      'cursor-pointer card-hover animate-fade-in'
    )}>
      {/* Channel + market row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]">{ch.icon}</span>
          <span className={cn('text-[11px] font-medium', ch.color)}>{ch.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">{mk.flag}</span>
          <StatusDot status={item.status} />
        </div>
      </div>

      {/* Title */}
      <p className="text-[13px] text-[var(--text)] font-medium leading-snug line-clamp-2 mb-3">
        {item.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {item.ai_generated && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-full">
              <Sparkles size={9} /> IA
            </span>
          )}
          {item.clarity_pass === true && (
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">✓ Clarity</span>
          )}
          {item.clarity_pass === false && (
            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">⚠ Clarity</span>
          )}
        </div>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[var(--surface3)]">
          <MoreHorizontal size={13} className="text-[var(--muted)]" />
        </button>
      </div>

      {/* Scheduled indicator */}
      {item.scheduled_at && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] text-[11px] text-amber-400 flex items-center gap-1">
          <span>📅</span>
          {new Date(item.scheduled_at).toLocaleDateString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
      )}
    </div>
  )
}

function Column({ stage, items }: { stage: Stage; items: ContentItem[] }) {
  const cfg = STAGE_CONFIG[stage]
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col w-[280px] shrink-0 h-full">
      {/* Header */}
      <div
        className={cn('flex items-center gap-2 px-3 py-2.5 mb-3 rounded-xl border cursor-pointer select-none', cfg.bg, cfg.border)}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className={cn('text-[11px] font-bold tracking-wide uppercase', cfg.color)}>{cfg.label}</span>
        <span className={cn('ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
          {items.length}
        </span>
        <ArrowRight size={12} className={cn('transition-transform', cfg.color, collapsed ? '' : 'rotate-90')} />
      </div>

      {/* Cards */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {items.map(item => <ContentCard key={item.id} item={item} />)}

          {/* Add button */}
          <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border2)] transition-colors text-[12px]">
            <Plus size={13} /> Añadir
          </button>
        </div>
      )}
    </div>
  )
}

export function PipelineBoard() {
  const byStage = STAGES.reduce((acc, stage) => {
    acc[stage] = ITEMS.filter(i => i.stage === stage)
    return acc
  }, {} as Record<Stage, ContentItem[]>)

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4 px-6 pt-6 pipeline-scroll">
      {STAGES.map(stage => (
        <Column key={stage} stage={stage} items={byStage[stage]} />
      ))}
    </div>
  )
}
