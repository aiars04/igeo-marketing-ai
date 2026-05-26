import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2, ArrowUpRight } from 'lucide-react'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import type { Channel } from '@/types/database'

const MOCK_STATS = [
  { label: 'Impresiones',   value: '12.4K', delta: '+18%', icon: Eye,           color: 'text-blue-400',    bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.18)' },
  { label: 'Interacciones', value: '847',   delta: '+24%', icon: Heart,         color: 'text-pink-400',    bg: 'rgba(236,72,153,0.08)',   border: 'rgba(236,72,153,0.18)' },
  { label: 'Comentarios',   value: '63',    delta: '+9%',  icon: MessageCircle, color: 'text-violet-400',  bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.18)' },
  { label: 'Compartidos',   value: '124',   delta: '+31%', icon: Share2,        color: 'text-emerald-400', bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.18)' },
]

const MOCK_POSTS = [
  { title: 'Software para control de plagas: qué buscar', channel: 'blog'      as Channel, date: '15 may', impressions: '3.2K', interactions: '218', score: 92 },
  { title: 'Gestión documental en servicios técnicos',    channel: 'linkedin'  as Channel, date: '10 may', impressions: '2.8K', interactions: '195', score: 87 },
  { title: 'De la operación diaria al control directivo', channel: 'linkedin'  as Channel, date: '5 may',  impressions: '2.1K', interactions: '143', score: 74 },
]

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'var(--success)' : score >= 70 ? 'var(--warning)' : 'var(--danger)'
  const glow  = score >= 85 ? 'rgba(52,211,153,0.55)' : score >= 70 ? 'rgba(251,191,36,0.55)' : 'rgba(248,113,113,0.55)'
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div
        className="w-20 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,246,235,0.04)', border: '1px solid var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color, boxShadow: `0 0 8px ${glow}` }}
        />
      </div>
      <span
        className="font-display text-[14px] font-bold tracking-[-0.02em] tabular-nums w-7 text-right"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-screen">

      {/* Topbar */}
      <div className="topbar shrink-0 gap-4 justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <div className="text-eyebrow mb-1" style={{ color: 'var(--orange3)' }}>
              <span className="inline-block w-3 h-px mr-1.5 align-middle" style={{ background: 'var(--orange)' }} />
              Performance
            </div>
            <h1 className="font-display text-[22px] font-bold leading-none tracking-[-0.025em]" style={{ color: 'var(--text)' }}>
              Análisis
            </h1>
          </div>
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-sm"
            style={{ background: 'rgba(255,246,235,0.025)', border: '1px solid var(--border2)', color: 'var(--text2)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}
            />
            Evaluación IA · 7 días post-publicación
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold backdrop-blur-sm"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.30)', color: 'var(--success)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            Datos actualizados
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-7">
        <div className="max-w-5xl mx-auto space-y-6 stagger">

          {/* Section eyebrow */}
          <div>
            <div className="text-eyebrow mb-1.5">
              <span className="inline-block w-3 h-px mr-1.5 align-middle" style={{ background: 'var(--orange)' }} />
              Métricas globales
            </div>
            <h2 className="font-display text-[18px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
              Rendimiento del último periodo
            </h2>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up">
            {MOCK_STATS.map(s => (
              <div
                key={s.label}
                className="card card-glow p-5"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,246,235,0.025), transparent 50%), var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <s.icon size={16} className={s.color} />
                </div>
                <div className="font-display text-[28px] font-bold tracking-[-0.035em] leading-none" style={{ color: 'var(--text)' }}>
                  {s.value}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mt-1.5" style={{ color: 'var(--muted)' }}>
                  {s.label}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--success)' }}>
                  <ArrowUpRight size={11} />
                  {s.delta} vs mes anterior
                </div>
              </div>
            ))}
          </div>

          {/* Top posts */}
          <div
            className="p-6 animate-fade-up"
            style={{
              background: 'linear-gradient(180deg, rgba(255,246,235,0.025), transparent 50%), var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid var(--border-warm)' }}
              >
                <TrendingUp size={15} style={{ color: 'var(--orange3)' }} />
              </div>
              <div>
                <div className="text-eyebrow mb-0.5">Ranking</div>
                <h2 className="font-display text-[16px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
                  Top contenido publicado
                </h2>
              </div>
            </div>
            <div className="space-y-2.5">
              {MOCK_POSTS.map((p, i) => (
                <div
                  key={p.title}
                  className="flex items-center gap-4 p-3.5 transition-colors"
                  style={{
                    background: 'rgba(7,7,13,0.35)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-warm)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <span
                    className="font-display text-[14px] font-bold tracking-[-0.02em] w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: i === 0 ? 'linear-gradient(135deg, var(--orange2), var(--orange))' : 'rgba(255,246,235,0.04)',
                      color: i === 0 ? 'white' : 'var(--text2)',
                      border: i === 0 ? '1px solid rgba(253,186,116,0.4)' : '1px solid var(--border2)',
                      boxShadow: i === 0 ? '0 0 12px rgba(234,88,12,0.35)' : 'none',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[13.5px] font-semibold tracking-[-0.015em] truncate" style={{ color: 'var(--text)' }}>{p.title}</p>
                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                      <ChannelBadge channel={p.channel} />
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>{p.date}</span>
                      <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>
                        <Eye size={11} /> {p.impressions}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>
                        <Heart size={11} /> {p.interactions}
                      </span>
                    </div>
                  </div>
                  <ScoreBar score={p.score} />
                </div>
              ))}
            </div>
          </div>

          {/* Coming soon */}
          <div
            className="p-10 text-center animate-fade-up"
            style={{
              background: 'rgba(7,7,13,0.4)',
              border: '1px dashed var(--border3)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid var(--border-warm)' }}
            >
              <BarChart3 size={24} style={{ color: 'var(--orange3)' }} />
            </div>
            <p className="font-display text-[15px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
              Análisis IA automático a los 7 días de publicar
            </p>
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--muted)' }}>
              Se activa al conectar Postiz — Fase 2
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
