'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'

export default function LoginPage() {
  const router  = useRouter()
  const [show,    setShow]    = useState(false)
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/pipeline')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4 relative overflow-hidden">

      {/* ── Ambient glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full opacity-[0.07] blur-[130px]"
             style={{ background: 'var(--accent)' }} />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-[120px]"
             style={{ background: 'var(--accent2)' }} />
        <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[100px]"
             style={{ background: 'var(--accent)' }} />
      </div>

      {/* ── Dot grid decorativo ── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.8) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative w-full max-w-[380px] animate-fade-in-scale">

        {/* ── Logo ── */}
        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        {/* ── Card ── */}
        <div
          className="rounded-2xl p-6 shadow-2xl shadow-black/60"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
          }}
        >
          <div className="mb-5">
            <h2 className="text-[16px] font-bold text-white leading-none">Acceder al panel</h2>
            <p className="text-[12px] text-[var(--muted)] mt-1.5">Introduce tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="hola@igeoerp.com"
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] placeholder:text-[var(--muted)] text-[var(--text)] transition-all outline-none"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(29,111,200,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-[13px] placeholder:text-[var(--muted)] text-[var(--text)] transition-all outline-none"
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(29,111,200,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-[12px] text-rose-400 rounded-xl px-3 py-2.5"
                   style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !pass}
              className="w-full flex items-center justify-center gap-2 font-semibold text-[13px] py-2.5 rounded-xl transition-all disabled:opacity-40 group"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #1a55a8)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(29,111,200,0.35)',
              }}
            >
              {loading ? (
                'Accediendo...'
              ) : (
                <>
                  Acceder al panel
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>

          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--muted)] mt-5">
          ¿Problemas para acceder? Contacta con{' '}
          <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Adrián</span>
        </p>
      </div>
    </div>
  )
}
