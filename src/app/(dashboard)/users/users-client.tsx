'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, Trash2, ToggleLeft, ToggleRight, X, Shield, ShieldCheck, User as UserIcon, Copy, Check,
} from 'lucide-react'
import type { Profile, UserRole } from '@/types/database'
import { useToast, Toasts } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Admin', manager: 'Manager', user: 'Usuario' }
const ROLE_COLOR: Record<UserRole, { bg: string; text: string; border: string; dot: string }> = {
  admin:   { bg: 'rgba(0,113,227,0.07)',   text: '#0071e3', border: 'rgba(0,113,227,0.25)',   dot: '#0071e3' },
  manager: { bg: 'rgba(52,199,89,0.08)',   text: '#248a3d', border: 'rgba(52,199,89,0.25)',   dot: '#248a3d' },
  user:    { bg: 'var(--surface-2)',       text: 'var(--ink-2)', border: 'var(--border)',      dot: 'var(--ink-3)' },
}
const ROLE_ICON: Record<UserRole, typeof Shield> = { admin: ShieldCheck, manager: Shield, user: UserIcon }

export function UsersClient({
  currentUserId,
  currentRole,
  initialProfiles,
}: {
  currentUserId: string
  currentRole: UserRole
  initialProfiles: Profile[]
}) {
  const router = useRouter()
  const { items: toasts, show: showToast, remove: removeToast } = useToast()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string; password: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const counts = useMemo(() => ({
    total:   profiles.length,
    admin:   profiles.filter(p => p.role === 'admin').length,
    manager: profiles.filter(p => p.role === 'manager').length,
    user:    profiles.filter(p => p.role === 'user').length,
    active:  profiles.filter(p => p.active).length,
  }), [profiles])

  const canActOn = (target: Profile): boolean => {
    if (target.id === currentUserId) return false
    if (currentRole === 'admin') return true
    if (currentRole === 'manager') return target.role === 'user'
    return false
  }

  const refresh = () => router.refresh()

  const handleToggleActive = async (p: Profile) => {
    if (!canActOn(p)) return
    setBusyId(p.id)
    const res = await fetch(`/api/users/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    setBusyId(null)
    if (!res.ok) { const j = await res.json().catch(() => ({})); showToast(`Error: ${j.error ?? res.statusText}`, 'error'); return }
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, active: !p.active } : x))
    showToast(`${p.email} ${!p.active ? 'activado' : 'desactivado'}`, 'success')
    refresh()
  }

  const handleChangeRole = async (p: Profile, newRole: UserRole) => {
    if (!canActOn(p)) return
    if (newRole === p.role) return
    setBusyId(p.id)
    const res = await fetch(`/api/users/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setBusyId(null)
    if (!res.ok) { const j = await res.json().catch(() => ({})); showToast(`Error: ${j.error ?? res.statusText}`, 'error'); return }
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, role: newRole } : x))
    showToast(`${p.email} → ${ROLE_LABEL[newRole]}`, 'success')
    refresh()
  }

  const handleDelete = async (p: Profile) => {
    if (currentRole !== 'admin') return
    if (p.id === currentUserId) return
    if (!confirm(`¿Eliminar definitivamente a ${p.email}?\nEsta acción no se puede deshacer.`)) return
    setBusyId(p.id)
    const res = await fetch(`/api/users/${p.id}`, { method: 'DELETE' })
    setBusyId(null)
    if (!res.ok) { const j = await res.json().catch(() => ({})); showToast(`Error: ${j.error ?? res.statusText}`, 'error'); return }
    setProfiles(prev => prev.filter(x => x.id !== p.id))
    showToast(`${p.email} eliminado`, 'success')
    refresh()
  }

  return (
    <div className="p-4 sm:p-6" style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1, margin: 0 }}>
            Usuarios
          </h1>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', margin: '3px 0 0', letterSpacing: '0.01em' }}>
            Agente Marketing · iGEO
          </p>
        </div>
        <button className="btn-cta" onClick={() => setInviteOpen(true)}>
          <UserPlus size={13} aria-hidden="true" />
          Invitar usuario
        </button>
      </div>

      {/* ── Stats bar ── */}
      <div
        className="flex gap-2 flex-wrap items-center"
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 14, paddingBottom: 14,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Total',    value: counts.total,   color: 'var(--ink)'    },
          { label: 'Admin',    value: counts.admin,   color: ROLE_COLOR.admin.text },
          { label: 'Managers', value: counts.manager, color: ROLE_COLOR.manager.text },
          { label: 'Usuarios', value: counts.user,    color: 'var(--ink-2)'  },
          { label: 'Activos',  value: counts.active,  color: 'var(--green-2)' },
        ].map(s => (
          <div
            key={s.label}
            className="flex items-baseline gap-1.5 px-3 py-1.5 text-[11px] font-medium tabular-nums"
            style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--radius-pill)' }}
          >
            <span className="font-semibold text-[12.5px]" style={{ color: s.color }}>{s.value}</span>
            <span style={{ color: 'var(--ink-2)' }}>{s.label}</span>
          </div>
        ))}
        {currentRole === 'manager' && (
          <span className="ml-auto text-[11px]" style={{ color: 'var(--ink-3)' }}>
            Como Manager solo puedes gestionar usuarios con rol Usuario.
          </span>
        )}
      </div>

      {/* ── Tabla ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {/* header row */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: '1fr 140px 110px 200px',
            columnGap: 24,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <div>Usuario</div>
          <div>Rol</div>
          <div>Estado</div>
          <div style={{ textAlign: 'right' }}>Acciones</div>
        </div>

        {profiles.length === 0 && (
          <div className="p-6 text-center" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            No hay usuarios todavía. Pulsa “Invitar usuario” para crear el primero.
          </div>
        )}

        {profiles.map(p => {
          const c = ROLE_COLOR[p.role]
          const Icon = ROLE_ICON[p.role]
          const isSelf = p.id === currentUserId
          const editable = canActOn(p)
          const initial = (p.full_name || p.email).trim().charAt(0).toUpperCase()

          return (
            <div
              key={p.id}
              className="grid items-center"
              style={{
                gridTemplateColumns: '1fr 140px 110px 200px',
            columnGap: 24,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                opacity: p.active ? 1 : 0.55,
              }}
            >
              {/* Usuario */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: c.dot, color: '#fff',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {p.full_name || p.email.split('@')[0]}
                    {isSelf && (
                      <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 6, color: 'var(--ink-3)' }}>
                        · tú
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--ink-2)' }}>{p.email}</div>
                </div>
              </div>

              {/* Rol */}
              <div>
                {editable && currentRole === 'admin' ? (
                  <select
                    className="input"
                    style={{ height: 30, fontSize: 12, padding: '0 8px' }}
                    value={p.role}
                    disabled={busyId === p.id}
                    onChange={e => handleChangeRole(p, e.target.value as UserRole)}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="user">Usuario</option>
                  </select>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${c.border}`, color: c.text, background: c.bg,
                    }}
                  >
                    <Icon size={11} aria-hidden="true" />
                    {ROLE_LABEL[p.role]}
                  </span>
                )}
              </div>

              {/* Estado */}
              <div>
                <button
                  className="inline-flex items-center gap-1.5"
                  style={{
                    fontSize: 11, fontWeight: 600,
                    color: p.active ? 'var(--green-2)' : 'var(--ink-3)',
                    background: 'transparent', border: 'none',
                    cursor: editable ? 'pointer' : 'default',
                    opacity: editable ? 1 : 0.5,
                  }}
                  disabled={!editable || busyId === p.id}
                  onClick={() => handleToggleActive(p)}
                  title={editable ? 'Activar / desactivar' : 'No puedes modificar este usuario'}
                >
                  {p.active
                    ? <ToggleRight size={16} aria-hidden="true" />
                    : <ToggleLeft size={16} aria-hidden="true" />}
                  {p.active ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-2">
                {currentRole === 'admin' && (
                  <button
                    className="admin-card-action admin-card-action-delete"
                    onClick={() => handleDelete(p)}
                    disabled={isSelf || busyId === p.id}
                    title={isSelf ? 'No puedes eliminarte a ti mismo' : 'Eliminar'}
                    aria-label="Eliminar usuario"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modal Invitar ── */}
      <InviteModal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteResult(null) }}
        currentRole={currentRole}
        onCreated={(p) => {
          setProfiles(prev => [...prev, p.profile])
          setInviteResult({ email: p.email, password: p.password })
          showToast(`Usuario ${p.email} creado`, 'success')
          refresh()
        }}
        result={inviteResult}
      />

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────

function InviteModal({
  open, onClose, currentRole, onCreated, result,
}: {
  open: boolean
  onClose: () => void
  currentRole: UserRole
  onCreated: (data: { email: string; password: string; profile: Profile }) => void
  result: { email: string; password: string } | null
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Manager NO puede asignar admin ni manager
  const availableRoles: UserRole[] = currentRole === 'admin'
    ? ['admin', 'manager', 'user']
    : ['user']

  const reset = () => {
    setEmail(''); setFullName(''); setRole('user'); setError(''); setLoading(false); setCopied(false)
  }

  const handleSubmit = async () => {
    setError('')
    if (!email.trim()) { setError('Email obligatorio'); return }
    setLoading(true)
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), full_name: fullName.trim() || null, role }),
    })
    setLoading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? `Error ${res.status}`)
      return
    }
    const data = await res.json() as { user_id: string; email: string; password: string; full_name: string | null; role: UserRole }
    onCreated({
      email: data.email,
      password: data.password,
      profile: {
        id: data.user_id, email: data.email, full_name: data.full_name, role: data.role,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Invitar usuario" size="sm">
      {result ? (
        <div className="flex flex-col gap-4">
          <div
            style={{
              background: 'var(--green-soft)', border: '1px solid var(--green-border)',
              borderRadius: 'var(--radius-md)', padding: 14,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Check size={14} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-2)' }}>Usuario creado</span>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--ink-2)' }}>
              Comparte estas credenciales con el usuario. La contraseña se genera una sola vez.
            </p>
            <div className="space-y-2">
              <CredentialRow label="Email" value={result.email} />
              <CredentialRow
                label="Password" value={result.password}
                onCopy={() => { navigator.clipboard.writeText(result.password); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                copied={copied}
              />
            </div>
          </div>
          <button className="btn-cta" onClick={() => { reset(); onClose() }}>Cerrar</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="section-label block mb-1.5">Email</label>
            <input className="input" type="email" placeholder="usuario@igeoerp.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="section-label block mb-1.5">Nombre completo</label>
            <input className="input" placeholder="Nombre Apellido" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="section-label block mb-1.5">Rol</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
              {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            {currentRole === 'manager' && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                Como Manager solo puedes crear usuarios con rol Usuario.
              </p>
            )}
          </div>
          {error && (
            <div
              style={{
                fontSize: 12, padding: '8px 10px',
                background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,0.25)',
                color: 'var(--red-2)', borderRadius: 'var(--radius-md)',
              }}
            >
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => { reset(); onClose() }} disabled={loading}>
              <X size={13} aria-hidden="true" /> Cancelar
            </button>
            <button className="btn-cta flex-1" onClick={handleSubmit} disabled={loading || !email.trim()}>
              <UserPlus size={13} aria-hidden="true" />
              {loading ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function CredentialRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70 }}>
        {label}
      </span>
      <code style={{
        flex: 1, fontSize: 12, fontFamily: 'ui-monospace, monospace',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '4px 8px',
      }}>{value}</code>
      {onCopy && (
        <button className="admin-card-action" onClick={onCopy} aria-label="Copiar" title="Copiar">
          {copied ? <Check size={12} aria-hidden="true" style={{ color: 'var(--green-2)' }} /> : <Copy size={12} aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
