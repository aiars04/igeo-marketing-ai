'use client'

import { Sparkles, Plus, ArrowRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn, MARKET_CONFIG } from '@/lib/utils'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import type { Channel } from '@/types/database'

const MOCK_IDEAS = [
  { id:'1', title:'Hilo X: 4 señales de que tu empresa de calidad del agua necesita un ERP',                 channel:'x'          as Channel, market:'spain', source:'ai',    status:'pending' },
  { id:'2', title:'Instagram: El proceso de una visita de legionella en 6 slides',                           channel:'instagram'  as Channel, market:'spain', source:'ai',    status:'pending' },
  { id:'3', title:'Blog: Comparativa ERP genérico vs ERP especializado para servicios técnicos',              channel:'blog'       as Channel, market:'spain', source:'human', status:'pending' },
  { id:'4', title:'LinkedIn: Caso práctico — cómo una empresa de plagas redujo su papeleo un 70%',           channel:'linkedin'   as Channel, market:'spain', source:'ai',    status:'accepted' },
  { id:'5', title:'Newsletter UK: Field service trends in environmental health 2026',                         channel:'newsletter' as Channel, market:'uk',    source:'ai',    status:'pending' },
  { id:'6', title:'Facebook: ¿Qué es un ERP especializado y por qué importa para tu empresa de servicios?', channel:'facebook'   as Channel, market:'spain', source:'human', status:'pending' },
]

export default function IdeasPage() {
  return (
    <div className="flex flex-col h-screen">

      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[62px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-bold text-white leading-none">Ideas</h1>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">La IA sugiere, tú decides</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-white transition-colors"
            style={{ border: '1px solid var(--border)' }}
          >
            <Plus size={13} /> Nueva idea
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #1a55a8)',
              boxShadow:  '0 3px 16px rgba(29,111,200,0.3)',
            }}
          >
            <Sparkles size={13} /> Sugerir con IA
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {MOCK_IDEAS.map(idea => {
            const mk = MARKET_CONFIG[idea.market as keyof typeof MARKET_CONFIG]
            return (
              <div
                key={idea.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] card-hover group animate-fade-in"
                style={{ background: 'var(--surface)' }}
              >
                {/* Canal badge vertical */}
                <div className="shrink-0">
                  <ChannelBadge channel={idea.channel} />
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-[var(--text)] leading-snug">{idea.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-[var(--muted)]">{mk.flag} {mk.label}</span>

                    {idea.source === 'ai' && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ color: 'var(--accent2)', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.18)' }}>
                        <Sparkles size={8} /> IA
                      </span>
                    )}

                    {idea.status === 'accepted' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-emerald-400"
                            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                        ✓ Aceptada
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button className="p-2 rounded-lg hover:bg-emerald-500/10 text-[var(--muted)] hover:text-emerald-400 transition-colors">
                    <ThumbsUp size={14} />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-rose-500/10 text-[var(--muted)] hover:text-rose-400 transition-colors">
                    <ThumbsDown size={14} />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-[var(--surface3)] text-[var(--muted)] hover:text-white transition-colors">
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
