'use client'

import { PipelineBoard } from '@/components/pipeline/PipelineBoard'
import { Sparkles, Filter } from 'lucide-react'

function StatPill({
  value,
  label,
  variant = 'default',
}: {
  value: string | number
  label: string
  variant?: 'default' | 'amber' | 'emerald' | 'blue'
}) {
  const styles = {
    default: {
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      color: 'var(--text)',
    },
    amber: {
      background: 'rgba(251,191,36,0.08)',
      border: '1px solid rgba(251,191,36,0.2)',
      color: '#fbbf24',
    },
    emerald: {
      background: 'rgba(52,211,153,0.08)',
      border: '1px solid rgba(52,211,153,0.2)',
      color: '#34d399',
    },
    blue: {
      background: 'rgba(56,189,248,0.08)',
      border: '1px solid rgba(56,189,248,0.2)',
      color: 'var(--accent2)',
    },
  }
  const s = styles[variant]

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium"
      style={s}
    >
      <span className="font-bold text-[13px]" style={{ color: s.color }}>{value}</span>
      <span style={{ color: variant === 'default' ? 'var(--muted)' : s.color, opacity: 0.75 }}>{label}</span>
    </div>
  )
}

export default function PipelinePage() {
  return (
    <div className="flex flex-col h-screen">

      {/* ── Topbar ── */}
      <div className="flex items-center justify-between px-6 h-[62px] border-b border-[var(--border)] shrink-0 gap-4">

        {/* Izquierda: título + stats */}
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 className="text-[15px] font-bold text-white leading-none">Pipeline</h1>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 hidden sm:block">
              Ideas → Copy → Diseño → Programado → Análisis
            </p>
          </div>

          {/* Stat pills */}
          <div className="hidden md:flex items-center gap-2">
            <StatPill value="9"  label="piezas"       variant="default" />
            <StatPill value="2"  label="en revisión"  variant="amber" />
            <StatPill value="1"  label="programado"   variant="emerald" />
          </div>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-white transition-colors"
                  style={{ border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <Filter size={13} /> Filtrar
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), #1a55a8)',
                    boxShadow: '0 3px 16px rgba(29,111,200,0.35)',
                  }}>
            <Sparkles size={13} /> Generar con IA
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 overflow-hidden">
        <PipelineBoard />
      </div>
    </div>
  )
}
