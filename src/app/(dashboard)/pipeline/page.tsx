import { PipelineBoard } from '@/components/pipeline/PipelineBoard'
import { Sparkles, Filter, Search } from 'lucide-react'

export default function PipelinePage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Pipeline de contenido</h1>
          <p className="text-[12px] text-[var(--muted)]">Ideas → Copy → Diseño → Programado → Publicado → Análisis</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border2)] transition-colors">
            <Filter size={13} /> Filtrar
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-[12px] hover:opacity-90 transition-opacity">
            <Sparkles size={13} /> Generar contenido
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        <PipelineBoard />
      </div>
    </div>
  )
}
