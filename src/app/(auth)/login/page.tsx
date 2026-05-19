'use client'

import { useState } from 'react'
import { Zap, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // TODO: Supabase auth
    setTimeout(() => setLoading(false), 1000)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--accent)] opacity-[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] flex items-center justify-center mb-3 shadow-lg shadow-[var(--accent)]/20">
            <Zap size={22} className="text-black" strokeWidth={2.5} />
          </div>
          <h1 className="text-[18px] font-bold text-white">iGEO Marketing AI</h1>
          <p className="text-[12px] text-[var(--muted)] mt-1">Cerebro iGEO — Módulo de Marketing</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hola@igeoerp.com"
              className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-2.5 pr-10 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
              />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-black font-semibold text-[13px] py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[var(--muted)] mt-4">
          ¿Problemas para acceder? Contacta con Adrián
        </p>
      </div>
    </div>
  )
}
