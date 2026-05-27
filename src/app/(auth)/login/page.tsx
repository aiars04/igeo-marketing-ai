'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
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
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Background paths */}
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <FloatingPaths />
      </div>

      {/* Warm bloom from top */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[140px]"
          style={{ background: 'rgba(234,88,12,0.15)' }}
        />
        <div
          className="absolute -bottom-32 -right-20 w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: 'rgba(37,99,235,0.10)' }}
        />
      </div>

      {/* Card */}
      <motion.div
        className="relative w-full max-w-[420px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl text-white font-bold text-[22px] mb-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--orange-2) 0%, var(--orange-deep) 100%)',
              boxShadow:
                '0 0 0 1px rgba(253,186,116,0.35), 0 12px 32px rgba(234,88,12,0.30), 0 0 0 6px rgba(234,88,12,0.08)',
            }}
          >
            i
          </div>
          <div className="text-center">
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              iGEO <span className="font-serif italic" style={{ color: 'var(--orange-3)' }}>Marketing</span>
            </h1>
            <p
              className="font-mono text-[10px] mt-1.5 uppercase tracking-[0.22em]"
              style={{ color: 'var(--orange-3)' }}
            >
              — AI · Workspace
            </p>
          </div>
        </div>

        {/* Form card */}
        <div
          className="relative rounded-xl overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--line2)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(234,88,12,0.06)',
          }}
        >
          {/* Top accent strip */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, var(--orange), var(--orange-3) 50%, transparent 100%)',
            }}
          />

          <div className="p-6">
            <div className="mb-6">
              <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] mb-1.5" style={{ color: 'var(--orange-3)' }}>
                — Acceso
              </div>
              <h2 className="text-[17px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--text)' }}>
                Acceder al panel
              </h2>
              <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--muted)' }}>
                Introduce tus credenciales para continuar
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="block font-mono text-[10px] font-semibold mb-2 uppercase tracking-[0.12em]"
                  style={{ color: 'var(--muted)' }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="hola@igeoerp.com"
                  className="w-full rounded-md px-3.5 py-3 text-[13.5px] outline-none transition-all"
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--line2)',
                    color: 'var(--text)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--orange)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(234,88,12,0.14)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--line2)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = 'var(--surface2)'
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className="block font-mono text-[10px] font-semibold mb-2 uppercase tracking-[0.12em]"
                  style={{ color: 'var(--muted)' }}
                >
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
                    className="w-full rounded-md px-3.5 py-3 pr-11 text-[13.5px] outline-none transition-all"
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--line2)',
                      color: 'var(--text)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--orange)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(234,88,12,0.14)'
                      e.currentTarget.style.background = 'var(--surface)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--line2)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = 'var(--surface2)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors p-1"
                    style={{ color: 'var(--muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
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
                  className="flex items-center gap-2 text-[12.5px] rounded-md px-3 py-2.5"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: 'var(--danger-2)',
                  }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email || !pass}
                className="w-full btn-primary justify-center !py-3 !text-[13px] mt-2 group"
              >
                {loading ? (
                  <>
                    <Sparkles size={14} className="animate-pulse" />
                    Accediendo...
                  </>
                ) : (
                  <>
                    Acceder al panel
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer note */}
        <p
          className="text-center font-mono text-[10px] mt-6 uppercase tracking-[0.14em]"
          style={{ color: 'var(--muted)' }}
        >
          ¿Problemas para acceder? Contacta con{' '}
          <span className="font-semibold" style={{ color: 'var(--orange-3)' }}>Adrián</span>
        </p>
      </motion.div>
    </div>
  )
}
