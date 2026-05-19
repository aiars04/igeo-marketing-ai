'use client'

import { Settings, Globe, Users, Key, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_CONFIG } from '@/lib/utils'

const sections = [
  { id: 'brand',    icon: Zap,     label: 'Marca y contexto' },
  { id: 'markets',  icon: Globe,   label: 'Mercados' },
  { id: 'users',    icon: Users,   label: 'Usuarios' },
  { id: 'api',      icon: Key,     label: 'Integraciones' },
]

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center px-6 h-[60px] border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Configuración</h1>
          <p className="text-[12px] text-[var(--muted)]">Ajustes del sistema</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* API Keys */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Key size={15} className="text-[var(--accent)]" />
              <h2 className="text-[14px] font-semibold text-white">Integraciones</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Gemini API Key', key: 'GEMINI_API_KEY', status: 'configured', desc: 'Generación de contenido e imágenes' },
                { label: 'Nano Banana Pro', key: 'INFSH_TOKEN', status: 'configured', desc: 'Generación avanzada de imágenes' },
                { label: 'Postiz API', key: 'POSTIZ_API_KEY', status: 'pending', desc: 'Publicación automática multi-red social' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-[var(--surface2)] rounded-lg">
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text)]">{item.label}</div>
                    <div className="text-[11px] text-[var(--muted)]">{item.desc}</div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-1 rounded-full',
                    item.status === 'configured'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  )}>
                    {item.status === 'configured' ? 'Configurado' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Markets */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Globe size={15} className="text-[var(--accent)]" />
              <h2 className="text-[14px] font-semibold text-white">Mercados activos</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MARKET_CONFIG).map(([key, mk]) => (
                <div key={key} className="flex items-center gap-2 p-2.5 bg-[var(--surface2)] rounded-lg">
                  <span className="text-base">{mk.flag}</span>
                  <span className="text-[13px] text-[var(--text)]">{mk.label}</span>
                  <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Users size={15} className="text-[var(--accent)]" />
              <h2 className="text-[14px] font-semibold text-white">Usuarios</h2>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Adrián Ruiz',   role: 'Superadmin', color: 'from-[var(--accent)] to-[var(--accent2)]' },
                { name: 'Silvia',        role: 'Aprobador',  color: 'from-violet-500 to-pink-500' },
                { name: 'Ramón',         role: 'Editor',     color: 'from-amber-500 to-red-500' },
              ].map(u => (
                <div key={u.name} className="flex items-center gap-3 p-2.5 bg-[var(--surface2)] rounded-lg">
                  <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white', u.color)}>
                    {u.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-[var(--text)]">{u.name}</div>
                  </div>
                  <span className="text-[11px] text-[var(--muted)]">{u.role}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
