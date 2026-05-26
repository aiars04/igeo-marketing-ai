'use client'

import { Globe, Users, Key } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_CONFIG } from '@/lib/utils'

export default function SettingsPage() {
  const cardStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 className="text-[16px] font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
              Ajustes
            </h1>
            <p className="text-[11.5px] mt-1 leading-none" style={{ color: 'var(--muted)' }}>
              Integraciones, mercados y usuarios
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4 stagger">

          {/* API Keys */}
          <div className="p-4 animate-fade-up" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <Key size={15} style={{ color: 'var(--text2)' }} />
              <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                Integraciones
              </h2>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Gemini API Key', key: 'GEMINI_API_KEY', status: 'configured', desc: 'Generación de contenido e imágenes' },
                { label: 'Nano Banana Pro', key: 'INFSH_TOKEN', status: 'configured', desc: 'Generación avanzada de imágenes' },
                { label: 'Postiz API', key: 'POSTIZ_API_KEY', status: 'pending', desc: 'Publicación automática multi-red social' },
              ].map(item => {
                const configured = item.status === 'configured'
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 transition-colors rounded-md"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                        {item.label}
                      </div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{item.desc}</div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ml-3',
                      )}
                      style={configured
                        ? { background: 'rgba(52,211,153,0.10)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.25)' }
                        : { background: 'rgba(251,191,36,0.10)', color: 'var(--warning)', border: '1px solid rgba(251,191,36,0.25)' }
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: configured ? 'var(--success)' : 'var(--warning)',
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
          <div className="p-4 animate-fade-up" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <Globe size={15} style={{ color: 'var(--text2)' }} />
              <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                Mercados activos
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MARKET_CONFIG).map(([key, mk]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 rounded-md"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span className="text-base">{mk.flag}</span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{mk.label}</span>
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--success)' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="p-4 animate-fade-up" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <Users size={15} style={{ color: 'var(--text2)' }} />
              <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                Usuarios
              </h2>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Adrián Ruiz',   role: 'Superadmin', color: 'from-[var(--orange2)] to-[var(--orange)]' },
                { name: 'Silvia',        role: 'Aprobador',  color: 'from-violet-500 to-pink-500' },
                { name: 'Ramón',         role: 'Editor',     color: 'from-amber-500 to-red-500' },
              ].map(u => (
                <div
                  key={u.name}
                  className="flex items-center gap-3 p-2.5 rounded-md"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-[12px] font-semibold text-white', u.color)}
                  >
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                      {u.name}
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface3)', color: 'var(--text2)', border: '1px solid var(--border2)' }}
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
