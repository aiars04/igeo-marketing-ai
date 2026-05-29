import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2, ArrowUpRight } from 'lucide-react'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import type { Channel } from '@/types/database'

const MOCK_STATS = [
  { label: 'Impresiones',   value: '12.4K', delta: '+18%', icon: Eye,           color: 'var(--accent-2)', bg: 'var(--accent-soft)', border: 'rgba(99,102,241,0.25)' },
  { label: 'Interacciones', value: '847',   delta: '+24%', icon: Heart,         color: 'var(--red-2)',    bg: 'var(--red-soft)',    border: 'rgba(239,68,68,0.25)'  },
  { label: 'Comentarios',   value: '63',    delta: '+9%',  icon: MessageCircle, color: 'var(--blue-2)',   bg: 'var(--blue-soft)',   border: 'rgba(59,130,246,0.25)' },
  { label: 'Compartidos',   value: '124',   delta: '+31%', icon: Share2,        color: 'var(--green-2)',  bg: 'var(--green-soft)',  border: 'rgba(16,185,129,0.25)' },
]

const MOCK_POSTS = [
  { title: 'Software para control de plagas: qué buscar', channel: 'blog'      as Channel, date: '15 may', impressions: '3.2K', interactions: '218', score: 92 },
  { title: 'Gestión documental en servicios técnicos',    channel: 'linkedin'  as Channel, date: '10 may', impressions: '2.8K', interactions: '195', score: 87 },
  { title: 'De la operación diaria al control directivo', channel: 'linkedin'  as Channel, date: '5 may',  impressions: '2.1K', interactions: '143', score: 74 },
]

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'var(--green)' : score >= 70 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div
        className="w-20 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--surface-3)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color, transition: 'width 0.15s ease' }}
        />
      </div>
      <span
        className="text-[13px] font-semibold tabular-nums w-7 text-right"
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
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--ink)',
              lineHeight: 1,
              margin: 0,
            }}>
              Análisis IA
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
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge badge-green">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: 'var(--green)' }} />
            Datos actualizados
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5 stagger">

          {/* Section heading */}
          <div>
            <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
              Rendimiento del último periodo
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
              Métricas globales
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up">
            {MOCK_STATS.map(s => (
              <div
                key={s.label}
                className="card"
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <s.icon size={15} style={{ color: s.color }} />
                </div>
                <div className="metric-value">
                  {s.value}
                </div>
                <div className="section-label mt-2">
                  {s.label}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[11px] font-medium tabular-nums" style={{ color: 'var(--green-2)' }}>
                  <ArrowUpRight size={11} />
                  {s.delta} vs mes anterior
                </div>
              </div>
            ))}
          </div>

          {/* Top posts */}
          <div className="card animate-fade-up">
            <div className="flex items-center gap-2.5 mb-4">
              <TrendingUp size={15} style={{ color: 'var(--ink-2)' }} />
              <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                Top contenido publicado
              </h2>
            </div>
            <div className="space-y-2">
              {MOCK_POSTS.map((p, i) => (
                <div
                  key={p.title}
                  className="flex items-center gap-4 p-3 rounded-lg"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <span
                    className="text-[12px] font-semibold w-6 h-6 rounded-full flex items-center justify-center shrink-0 tabular-nums"
                    style={{
                      background: i === 0 ? 'var(--orange)' : 'var(--surface-3)',
                      color: i === 0 ? '#ffffff' : 'var(--ink-2)',
                      border: i === 0 ? '1px solid var(--orange-deep)' : '1px solid var(--border)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate" style={{ color: 'var(--ink)' }}>{p.title}</p>
                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                      <ChannelBadge channel={p.channel} />
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>{p.date}</span>
                      <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
                        <Eye size={11} /> {p.impressions}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
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
            className="p-8 text-center animate-fade-up"
            style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border-hover)',
              borderRadius: 12,
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <BarChart3 size={22} style={{ color: 'var(--ink-2)' }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
              Análisis IA automático a los 7 días de publicar
            </p>
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-2)' }}>
              Se activa al conectar Postiz — Fase 2
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
