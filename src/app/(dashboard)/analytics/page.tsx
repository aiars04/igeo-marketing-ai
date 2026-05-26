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
  const color = score >= 85 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface3)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-screen">

      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[62px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-bold text-white leading-none">Análisis de rendimiento</h1>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">Evaluación IA a los 7 días de publicar</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot inline-block" />
          Datos actualizados
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MOCK_STATS.map(s => (
              <div
                key={s.label}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <s.icon size={15} className={s.color} />
                </div>
                <div className="text-[24px] font-bold text-white leading-none">{s.value}</div>
                <div className="text-[11px] text-[var(--muted)] mt-1">{s.label}</div>
                <div className="flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-400">
                  <ArrowUpRight size={11} />
                  {s.delta} vs mes anterior
                </div>
              </div>
            ))}
          </div>

          {/* Top posts */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-[13px] font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-[var(--accent2)]" />
              Top contenido publicado
            </h2>
            <div className="space-y-2">
              {MOCK_POSTS.map((p, i) => (
                <div
                  key={p.title}
                  className="flex items-center gap-4 p-3 rounded-lg"
                  style={{ background: 'var(--surface2)' }}
                >
                  <span className="text-[11px] font-bold text-[var(--muted)] w-4 shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text)] truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <ChannelBadge channel={p.channel} />
                      <span className="text-[11px] text-[var(--muted)]">{p.date}</span>
                      <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <Eye size={11} /> {p.impressions}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
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
            className="rounded-xl p-8 text-center"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'var(--surface2)' }}
            >
              <BarChart3 size={22} className="text-[var(--muted)]" />
            </div>
            <p className="text-[13px] font-medium text-[var(--muted)]">Análisis IA automático a los 7 días de publicar</p>
            <p className="text-[11px] text-[var(--muted)] opacity-60 mt-1">Se activa al conectar Postiz — Fase 2</p>
          </div>

        </div>
      </div>
    </div>
  )
}
