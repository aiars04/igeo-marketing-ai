'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, ArrowRight, Sparkles, Mail, Lock } from 'lucide-react'
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

      {/* Stack centrado — sin caja */}
      <motion.div
        className="relative login-wrap"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Brand mark */}
        <div className="flex flex-col items-center" style={{ marginBottom: 40 }}>
          <div
            className="mb-4 relative overflow-hidden"
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, var(--accent-2) 0%, var(--accent) 100%)',
              boxShadow:
                '0 0 0 1px rgba(96,165,250,0.35), 0 12px 32px rgba(0,113,227,0.30), 0 0 0 6px rgba(0,113,227,0.08)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            i
          </div>
          <div className="text-center">
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
              iGEO <span className="font-serif italic" style={{ color: 'var(--accent-2)' }}>Marketing</span>
            </h1>
            <p
              className="font-mono text-[10px] mt-1.5 uppercase tracking-[0.22em]"
              style={{ color: 'var(--accent-2)' }}
            >
              — AI · Workspace
            </p>
          </div>
        </div>

        {/* Title + subtitle — sin caja */}
        <h2 className="login-title">Acceder al panel</h2>
        <p className="login-subtitle">Introduce tus credenciales para continuar</p>

        {/* Form sin contenedor */}
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          {/* Email */}
          <div className="login-input-wrapper">
            <Mail size={16} aria-hidden="true" className="login-input-icon" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="hola@igeoerp.com"
              className="login-input"
            />
          </div>

          {/* Password */}
          <div className="login-input-wrapper">
            <Lock size={16} aria-hidden="true" className="login-input-icon" />
            <input
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="login-input login-input-password"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="login-input-toggle"
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>

          {/* Forgot password link — centrado */}
          <a href="#" className="login-forgot-link">¿Olvidaste tu contraseña?</a>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                marginBottom: 12,
                background: 'var(--red-soft)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: 'var(--red-2)',
              }}
            >
              <AlertCircle size={14} aria-hidden="true" className="shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email || !pass}
            className="login-submit"
          >
            {loading ? (
              <>
                <Sparkles size={14} aria-hidden="true" className="animate-pulse" />
                Accediendo...
              </>
            ) : (
              <>
                Acceder al panel
                <ArrowRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        {/* Footer note */}
        <p
          className="text-center"
          style={{ marginTop: 32, color: 'var(--ink-3)', fontSize: 12 }}
        >
          ¿Problemas para acceder? Contacta con{' '}
          <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>Adrián</span>
        </p>
      </motion.div>
    </div>
  )
}
