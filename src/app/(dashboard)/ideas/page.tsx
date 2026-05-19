'use client'

import { Lightbulb, Sparkles, Plus, ArrowRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn, CHANNEL_CONFIG, MARKET_CONFIG } from '@/lib/utils'

const MOCK_IDEAS = [
  { id:'1', title:'Hilo X: 4 señales de que tu empresa de calidad del agua necesita un ERP', channel:'x', market:'spain', source:'ai', status:'pending' },
  { id:'2', title:'Instagram: El proceso de una visita de legionella en 6 slides', channel:'instagram', market:'spain', source:'ai', status:'pending' },
  { id:'3', title:'Blog: Comparativa ERP genérico vs ERP especializado para servicios técnicos', channel:'blog', market:'spain', source:'human', status:'pending' },
  { id:'4', title:'LinkedIn: Caso práctico — cómo una empresa de plagas redujo su papeleo un 70%', channel:'linkedin', market:'spain', source:'ai', status:'accepted' },
  { id:'5', title:'Newsletter UK: Field service trends in environmental health 2026', channel:'newsletter', market:'uk', source:'ai', status:'pending' },
  { id:'6', title:'Facebook: ¿Qué es un ERP especializado y por qué importa?', channel:'facebook', market:'spain', source:'human', status:'pending' },
]

export default function IdeasPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Ideas</h1>
          <p className="text-[12px] text-[var(--muted)]">Pipeline de ideas — la IA sugiere, tú decides</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <Plus size={13} /> Nueva idea
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-[12px] hover:opacity-90 transition-opacity">
            <Sparkles size={13} /> Sugerir con IA
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {MOCK_IDEAS.map(idea => {
            const ch = CHANNEL_CONFIG[idea.channel as keyof typeof CHANNEL_CONFIG]
            const mk = MARKET_CONFIG[idea.market as keyof typeof MARKET_CONFIG]
            return (
              <div key={idea.id} className="flex items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl card-hover group">
                <div className="w-9 h-9 rounded-lg bg-[var(--surface3)] flex items-center justify-center text-lg shrink-0">
                  {ch.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-[var(--text)] leading-snug">{idea.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn('text-[11px] font-medium', ch.color)}>{ch.label}</span>
                    <span className="text-[var(--muted)] text-[11px]">·</span>
                    <span className="text-[11px] text-[var(--muted)]">{mk.flag} {mk.label}</span>
                    {idea.source === 'ai' && (
                      <>
                        <span className="text-[var(--muted)] text-[11px]">·</span>
                        <span className="flex items-center gap-1 text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-full">
                          <Sparkles size={9} /> IA
                        </span>
                      </>
                    )}
                    {idea.status === 'accepted' && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">Aceptada</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-[var(--muted)] hover:text-emerald-400 transition-colors">
                    <ThumbsUp size={14} />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--muted)] hover:text-rose-400 transition-colors">
                    <ThumbsDown size={14} />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-[var(--surface3)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
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
