'use client'

import { Globe, Users, Key } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_CONFIG } from '@/lib/utils'

export default function SettingsPage() {
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
              Ajustes
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
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4 stagger">

          {/* API Keys */}
          <div className="card animate-fade-up">
            <div className="flex items-center gap-2.5 mb-4">
              <Key size={15} style={{ color: 'var(--ink-2)' }} />
              <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
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
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                        {item.label}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>{item.desc}</div>
                    </div>
                    <span className={cn('badge shrink-0 ml-3', configured ? 'badge-green' : 'badge-amber')}>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: configured ? 'var(--green)' : 'var(--amber)',
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
          <div className="card animate-fade-up">
            <div className="flex items-center gap-2.5 mb-4">
              <Globe size={15} style={{ color: 'var(--ink-2)' }} />
              <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                Mercados activos
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MARKET_CONFIG).map(([key, mk]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <span className="text-base">{mk.flag}</span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{mk.label}</span>
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--green)' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="card animate-fade-up">
            <div className="flex items-center gap-2.5 mb-4">
              <Users size={15} style={{ color: 'var(--ink-2)' }} />
              <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                Usuarios
              </h2>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Adrián Ruiz',   role: 'Superadmin', color: 'from-[var(--orange)] to-[var(--orange-deep)]' },
                { name: 'Silvia',        role: 'Aprobador',  color: 'from-[var(--accent)] to-[var(--accent-2)]' },
                { name: 'Ramón',         role: 'Editor',     color: 'from-[var(--amber)] to-[var(--red)]' },
              ].map(u => (
                <div
                  key={u.name}
                  className="flex items-center gap-3 p-2.5 rounded-lg"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div
                    className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-[12px] font-semibold', u.color)}
                    style={{ color: '#ffffff' }}
                  >
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                      {u.name}
                    </div>
                  </div>
                  <span className="badge badge-muted">
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
