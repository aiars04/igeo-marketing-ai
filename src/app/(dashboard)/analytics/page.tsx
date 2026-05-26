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
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div
        className="w-20 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--surface3)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
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
            <h1 className="text-[16px] font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
              Análisis
            </h1>
            <p className="text-[11.5px] mt-1 leading-none" style={{ color: 'var(--muted)' }}>
              Evaluación IA · 7 días post-publicación
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-medium"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', color: 'var(--success)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: 'var(--success)' }} />
            Datos actualizados
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5 stagger">

          {/* Section heading */}
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Rendimiento del último periodo
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
              Métricas globales
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up">
            {MOCK_STATS.map(s => (
              <div
                key={s.label}
                className="p-4 rounded-lg"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <s.icon size={15} className={s.color} />
                </div>
                <div className="text-[24px] font-bold tracking-tight leading-none tabular-nums" style={{ color: 'var(--text)' }}>
                  {s.value}
                </div>
                <div className="text-[11px] font-medium mt-1.5" style={{ color: 'var(--muted)' }}>
                  {s.label}
                </div>
                <div className="flex items-center gap-1 mt-2 text-[11px] font-medium tabular-nums" style={{ color: 'var(--success)' }}>
                  <ArrowUpRight size={11} />
                  {s.delta} vs mes anterior
                </div>
              </div>
            ))}
          </div>

          {/* Top posts */}
          <div
            className="p-4 animate-fade-up rounded-lg"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <TrendingUp size={15} style={{ color: 'var(--text2)' }} />
              <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                Top contenido publicado
              </h2>
            </div>
            <div className="space-y-2">
              {MOCK_POSTS.map((p, i) => (
                <div
                  key={p.title}
                  className="flex items-center gap-4 p-3 transition-colors rounded-md"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <span
                    className="text-[12px] font-semibold w-6 h-6 rounded-full flex items-center justify-center shrink-0 tabular-nums"
                    style={{
                      background: i === 0 ? 'var(--orange)' : 'var(--surface3)',
                      color: i === 0 ? 'white' : 'var(--text2)',
                      border: i === 0 ? 'none' : '1px solid var(--border2)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{p.title}</p>
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
            className="p-8 text-center animate-fade-up rounded-lg"
            style={{
              background: 'var(--surface2)',
              border: '1px dashed var(--border2)',
            }}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--surface3)', border: '1px solid var(--border)' }}
            >
              <BarChart3 size={22} style={{ color: 'var(--text2)' }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
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
