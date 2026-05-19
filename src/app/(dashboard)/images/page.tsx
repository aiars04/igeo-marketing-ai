'use client'

import { Image as ImageIcon, Sparkles, Plus, Check, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOCK_IMGS = [
  { id:'1', date:'2026-05-17', prompt:'Field technician in white uniform inspecting water treatment facility', approved:true,  channel:'linkedin' },
  { id:'2', date:'2026-05-17', prompt:'Operations manager reviewing digital dashboard in modern office',     approved:true,  channel:'linkedin' },
  { id:'3', date:'2026-05-15', prompt:'Pest control professional using tablet in commercial kitchen',        approved:false, channel:'instagram' },
  { id:'4', date:'2026-05-15', prompt:'Environmental health team meeting with digital workflow visible',     approved:false, channel:'instagram' },
  { id:'5', date:'2026-05-13', prompt:'Legionella technician taking water sample in industrial setting',     approved:true,  channel:'blog' },
  { id:'6', date:'2026-05-13', prompt:'Abstract minimalist corporate technology background teal gradient',  approved:false, channel:'linkedin' },
]

export default function ImagesPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Banco de imágenes</h1>
          <p className="text-[12px] text-[var(--muted)]">Activos visuales generados con IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <Plus size={13} /> Subir imagen
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-[12px] hover:opacity-90 transition-opacity">
            <Sparkles size={13} /> Generar imagen
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6 max-w-lg">
          {[
            { label: 'Total imágenes', value: '23' },
            { label: 'Aprobadas', value: '14' },
            { label: 'Pendientes', value: '9' },
          ].map(s => (
            <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
              <div className="text-[20px] font-bold text-white">{s.value}</div>
              <div className="text-[11px] text-[var(--muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MOCK_IMGS.map(img => (
            <div key={img.id} className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden card-hover">
              {/* Placeholder image */}
              <div className="aspect-square bg-gradient-to-br from-[var(--surface3)] to-[var(--surface2)] flex items-center justify-center">
                <ImageIcon size={32} className="text-[var(--muted)] opacity-30" />
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                <p className="text-[11px] text-white leading-snug line-clamp-2">{img.prompt}</p>
              </div>
              {/* Badges */}
              <div className="absolute top-2 right-2 flex gap-1">
                {img.approved && (
                  <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </span>
                )}
              </div>
              {/* Footer */}
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-[10px] text-[var(--muted)]">{img.date}</span>
                <button className="p-1 rounded hover:bg-[var(--surface3)] transition-colors opacity-0 group-hover:opacity-100">
                  <MoreHorizontal size={12} className="text-[var(--muted)]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
