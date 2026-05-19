import { BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2 } from 'lucide-react'

const MOCK_STATS = [
  { label: 'Impresiones',  value: '12.4K', delta: '+18%', icon: Eye,           color: 'text-blue-400' },
  { label: 'Interacciones', value: '847',  delta: '+24%', icon: Heart,         color: 'text-pink-400' },
  { label: 'Comentarios',  value: '63',    delta: '+9%',  icon: MessageCircle, color: 'text-violet-400' },
  { label: 'Compartidos',  value: '124',   delta: '+31%', icon: Share2,        color: 'text-emerald-400' },
]

const MOCK_POSTS = [
  { title: 'Software para control de plagas: qué buscar', channel: '✍️ Blog',     date: '15 may', impressions: '3.2K', interactions: '218', score: 92 },
  { title: 'Gestión documental en servicios técnicos',    channel: '💼 LinkedIn',  date: '10 may', impressions: '2.8K', interactions: '195', score: 87 },
  { title: 'De la operación diaria al control directivo', channel: '💼 LinkedIn',  date: '5 may',  impressions: '2.1K', interactions: '143', score: 74 },
]

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Análisis de rendimiento</h1>
          <p className="text-[12px] text-[var(--muted)]">Evaluación IA a los 7 días de publicar</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MOCK_STATS.map(s => (
              <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <s.icon size={16} className={s.color + ' mb-2'} />
                <div className="text-[22px] font-bold text-white">{s.value}</div>
                <div className="text-[11px] text-[var(--muted)]">{s.label}</div>
                <div className="text-[11px] text-emerald-400 mt-1">{s.delta} vs mes anterior</div>
              </div>
            ))}
          </div>

          {/* Top posts */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-[var(--accent)]" /> Top contenido publicado
            </h2>
            <div className="space-y-3">
              {MOCK_POSTS.map(p => (
                <div key={p.title} className="flex items-center gap-4 p-3 bg-[var(--surface2)] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text)] truncate">{p.title}</p>
                    <div className="flex gap-3 mt-1 text-[11px] text-[var(--muted)]">
                      <span>{p.channel}</span>
                      <span>{p.date}</span>
                      <span>👁 {p.impressions}</span>
                      <span>❤️ {p.interactions}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-[13px] font-bold text-white">{p.score}</div>
                    <div className="text-[10px] text-[var(--muted)]">/100</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coming soon */}
          <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl p-8 text-center">
            <BarChart3 size={32} className="text-[var(--muted)] mx-auto mb-3 opacity-40" />
            <p className="text-[13px] text-[var(--muted)]">Análisis IA automático a los 7 días de publicar</p>
            <p className="text-[12px] text-[var(--muted)] opacity-60 mt-1">Se activa al conectar Postiz en Fase 2</p>
          </div>

        </div>
      </div>
    </div>
  )
}
