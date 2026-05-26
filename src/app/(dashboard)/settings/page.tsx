'use client'

import { Globe, Users, Key } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_CONFIG } from '@/lib/utils'

export default function SettingsPage() {
  const cardStyle = {
    background: 'linear-gradient(180deg, rgba(255,246,235,0.025), transparent 50%), var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="topbar shrink-0 gap-4 justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <div className="text-eyebrow mb-1" style={{ color: 'var(--orange3)' }}>
              <span className="inline-block w-3 h-px mr-1.5 align-middle" style={{ background: 'var(--orange)' }} />
              Preferencias
            </div>
            <h1 className="font-display text-[22px] font-bold leading-none tracking-[-0.025em]" style={{ color: 'var(--text)' }}>
              Ajustes
            </h1>
          </div>
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-sm"
            style={{ background: 'rgba(255,246,235,0.025)', border: '1px solid var(--border2)', color: 'var(--text2)' }}
          >
            Integraciones · mercados · usuarios
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-7">
        <div className="max-w-3xl mx-auto space-y-5 stagger">

          {/* API Keys */}
          <div className="p-6 animate-fade-up" style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid var(--border-warm)' }}
              >
                <Key size={15} style={{ color: 'var(--orange3)' }} />
              </div>
              <div>
                <div className="text-eyebrow mb-0.5">Conexiones</div>
                <h2 className="font-display text-[16px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
                  Integraciones
                </h2>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Gemini API Key', key: 'GEMINI_API_KEY', status: 'configured', desc: 'Generación de contenido e imágenes' },
                { label: 'Nano Banana Pro', key: 'INFSH_TOKEN', status: 'configured', desc: 'Generación avanzada de imágenes' },
                { label: 'Postiz API', key: 'POSTIZ_API_KEY', status: 'pending', desc: 'Publicación automática multi-red social' },
              ].map(item => {
                const configured = item.status === 'configured'
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3.5 transition-colors"
                    style={{
                      background: 'rgba(7,7,13,0.4)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-display text-[13px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--text)' }}>
                        {item.label}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{item.desc}</div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full shrink-0 ml-3',
                      )}
                      style={configured
                        ? { background: 'rgba(52,211,153,0.12)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.30)' }
                        : { background: 'rgba(251,191,36,0.12)', color: 'var(--warning)', border: '1px solid rgba(251,191,36,0.28)' }
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: configured ? 'var(--success)' : 'var(--warning)',
                          boxShadow: `0 0 8px ${configured ? 'var(--success)' : 'var(--warning)'}`,
                        }}
                      />
                      {configured ? 'Configurado' : 'Pendiente'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Markets */}
          <div className="p-6 animate-fade-up" style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid var(--border-warm)' }}
              >
                <Globe size={15} style={{ color: 'var(--orange3)' }} />
              </div>
              <div>
                <div className="text-eyebrow mb-0.5">Cobertura</div>
                <h2 className="font-display text-[16px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
                  Mercados activos
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {Object.entries(MARKET_CONFIG).map(([key, mk]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                  style={{
                    background: 'rgba(7,7,13,0.4)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <span className="text-base">{mk.flag}</span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{mk.label}</span>
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="p-6 animate-fade-up" style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid var(--border-warm)' }}
              >
                <Users size={15} style={{ color: 'var(--orange3)' }} />
              </div>
              <div>
                <div className="text-eyebrow mb-0.5">Equipo</div>
                <h2 className="font-display text-[16px] font-bold tracking-[-0.02em]" style={{ color: 'var(--text)' }}>
                  Usuarios
                </h2>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Adrián Ruiz',   role: 'Superadmin', color: 'from-[var(--orange2)] to-[var(--orange)]' },
                { name: 'Silvia',        role: 'Aprobador',  color: 'from-violet-500 to-pink-500' },
                { name: 'Ramón',         role: 'Editor',     color: 'from-amber-500 to-red-500' },
              ].map(u => (
                <div
                  key={u.name}
                  className="flex items-center gap-3 p-2.5"
                  style={{
                    background: 'rgba(7,7,13,0.4)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div
                    className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center font-display text-[12px] font-bold text-white', u.color)}
                    style={{ boxShadow: '0 0 12px rgba(234,88,12,0.20)' }}
                  >
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[13px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--text)' }}>
                      {u.name}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,246,235,0.04)', color: 'var(--text2)', border: '1px solid var(--border2)' }}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
