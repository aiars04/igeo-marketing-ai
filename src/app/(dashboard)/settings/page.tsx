import { Globe, Users, Key } from 'lucide-react'
import Link from 'next/link'
import { cn, MARKET_CONFIG } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database'

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Admin', manager: 'Manager', user: 'Usuario' }
const ROLE_BG: Record<UserRole, string> = {
  admin: 'var(--accent)',
  manager: 'var(--green)',
  user: 'var(--ink-3)',
}

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabaseAdmin = createAdminClient()
  const { data: usersData } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .returns<Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'active'>[]>()
  const users = usersData ?? []

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
        <div className="max-w-3xl mx-auto space-y-4">

          {/* API Keys */}
          <div className="card animate-fade-up">
            <div className="flex items-center gap-2.5 mb-4">
              <Key size={15} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
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
                    className="settings-item justify-between"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                        {item.label}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>{item.desc}</div>
                    </div>
                    <span className={cn('badge shrink-0 ml-3', configured ? 'badge-green' : 'badge-amber')}>
                      <span
                        aria-hidden="true"
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
              <Globe size={15} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
              <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                Mercados activos
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(MARKET_CONFIG).map(([key, mk]) => (
                <div
                  key={key}
                  className="settings-item"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span className="text-base">{mk.flag}</span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{mk.label}</span>
                  <span
                    aria-hidden="true"
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--green)' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="card animate-fade-up">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2.5">
                <Users size={15} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
                <h2 className="section-title" style={{ fontSize: 15, fontWeight: 600 }}>
                  Usuarios activos
                </h2>
              </div>
              <Link
                href="/users"
                className="text-[12px]"
                style={{ color: 'var(--accent-2)', fontWeight: 600 }}
              >
                Gestionar →
              </Link>
            </div>
            {users.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                No hay usuarios activos.
              </p>
            ) : (
              <div className="space-y-2">
                {users.map(u => {
                  const display = u.full_name || u.email.split('@')[0]
                  return (
                    <div
                      key={u.id}
                      className="settings-item"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-[13px]"
                        style={{ background: ROLE_BG[u.role], color: '#ffffff' }}
                      >
                        {display.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                          {display}
                        </div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                          {u.email}
                        </div>
                      </div>
                      <span className="badge badge-muted">
                        {ROLE_LABEL[u.role]}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
