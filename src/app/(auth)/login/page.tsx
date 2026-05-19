'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import { FloatingPaths } from '@/components/ui/FloatingPaths'

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
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
         style={{ background: 'var(--bg)' }}>

      {/* ── Floating paths animados ── */}
      <FloatingPaths />

      {/* ── Ambient glows encima de los paths ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[140px]"
             style={{ background: 'rgba(29,111,200,0.08)' }} />
        <div className="absolute -bottom-32 -right-20 w-[400px] h-[400px] rounded-full blur-[120px]"
             style={{ background: 'rgba(56,189,248,0.05)' }} />
      </div>

      {/* ── Card ── */}
      <motion.div
        className="relative w-full max-w-[380px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="login" />
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-6 shadow-2xl shadow-black/60 backdrop-blur-sm"
          style={{
            background: 'rgba(9,15,30,0.85)',
            border: '1px solid rgba(59,130,246,0.18)',
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
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] placeholder:text-[var(--muted)] text-[var(--text)] outline-none transition-all"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                onFocus={e  => { e.currentTarget.style.borderColor = 'rgba(29,111,200,0.55)' }}
                onBlur={e   => { e.currentTarget.style.borderColor = 'var(--border)' }}
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
                  className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-[13px] placeholder:text-[var(--muted)] text-[var(--text)] outline-none transition-all"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(29,111,200,0.55)' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)' }}
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
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-[12px] text-rose-400 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}
              >
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading || !email || !pass}
              className="w-full flex items-center justify-center gap-2 font-semibold text-[13px] py-2.5 rounded-xl transition-all disabled:opacity-40 group text-white"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #1a55a8)',
                boxShadow:  '0 4px 20px rgba(29,111,200,0.35)',
              }}
            >
              {loading ? 'Accediendo...' : (
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
      </motion.div>
    </div>
  )
}
