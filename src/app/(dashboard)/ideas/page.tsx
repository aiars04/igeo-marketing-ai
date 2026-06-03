'use client'

import { useState, useCallback, useEffect } from 'react'
import { Sparkles, Plus, ArrowRight, ThumbsUp, ThumbsDown, Loader2, CheckCircle2 } from 'lucide-react'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { Channel, Idea } from '@/types/database'

// ─── Constants ──────────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  spain: '🇪🇸', latam: '🌎', uk: '🇬🇧', france: '🇫🇷', italy: '🇮🇹', portugal: '🇵🇹', brasil: '🇧🇷',
}

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  blog: 'Blog',
  email: 'Email',
  newsletter: 'Newsletter',
}

const MARKETS = [
  { value: 'spain', label: 'España' },
  { value: 'uk', label: 'UK' },
  { value: 'latam', label: 'LATAM' },
  { value: 'france', label: 'Francia' },
  { value: 'portugal', label: 'Portugal' },
]

const SUGGEST_COUNTS = [3, 5, 10] as const
type SuggestCount = typeof SUGGEST_COUNTS[number]

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAI, setLoadingAI] = useState(false)
  const [suggestCount, setSuggestCount] = useState<SuggestCount>(3)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newChannel, setNewChannel] = useState<Channel>('linkedin')
  const [newMarket, setNewMarket] = useState('spain')
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ideas')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as Idea[]
        if (!cancelled) setIdeas(data)
      } catch (e) {
        if (!cancelled) showToast(`Error cargando ideas: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAccept = useCallback(async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/ideas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' }),
    })
    setBusyId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    const updated = await res.json() as Idea
    setIdeas(prev => prev.map(i => i.id === id ? updated : i))
    showToast('Idea aceptada', 'success')
  }, [showToast])

  const handleDiscard = useCallback(async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/ideas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    setBusyId(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    setIdeas(prev => prev.filter(i => i.id !== id))
    showToast('Idea descartada', 'info')
  }, [showToast])

  const handleConvert = useCallback(async (id: string) => {
    const idea = ideas.find(i => i.id === id)
    if (!idea) return
    setBusyId(id)
    try {
      // 1) Crear ítem en pipeline
      const piRes = await fetch('/api/content-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: idea.title,
          channel: idea.channel ?? 'linkedin',
          stage: 'ideas',
          market: idea.market,
          description: idea.description,
          ai_generated: idea.source === 'ai',
        }),
      })
      if (!piRes.ok) {
        const j = await piRes.json().catch(() => ({}))
        showToast(`Error añadiendo al pipeline: ${j.error ?? piRes.statusText}`, 'error')
        return
      }

      // 2) Marcar idea como converted
      const upRes = await fetch(`/api/ideas/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted' }),
      })
      if (!upRes.ok) {
        showToast('Pipeline OK, pero falló marcar la idea como convertida', 'error')
      } else {
        const updated = await upRes.json() as Idea
        setIdeas(prev => prev.map(i => i.id === id ? updated : i))
      }
      showToast('Añadida al pipeline ✓', 'success')
    } finally {
      setBusyId(null)
    }
  }, [ideas, showToast])

  const handleAddIdea = useCallback(async () => {
    if (!newTitle.trim()) return
    const res = await fetch('/api/ideas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        channel: newChannel,
        market: newMarket,
        source: 'human',
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    const created = await res.json() as Idea
    setIdeas(prev => [created, ...prev])
    setAddModalOpen(false)
    setNewTitle('')
    setNewChannel('linkedin')
    setNewMarket('spain')
    showToast('Idea añadida', 'success')
  }, [newTitle, newChannel, newMarket, showToast])

  const handleSuggestAI = useCallback(async () => {
    setLoadingAI(true)
    try {
      const res = await fetch('/api/ideas/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: suggestCount, market: 'spain' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error generando: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const data = await res.json() as { ideas: Idea[] }
      setIdeas(prev => [...data.ideas, ...prev])
      showToast(`${data.ideas.length} nuevas ideas generadas`, 'success')
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setLoadingAI(false)
    }
  }, [suggestCount, showToast])

  // ── Lista visible: ocultar 'rejected'; mostrar 'converted' con badge gris ──
  const visibleIdeas = ideas.filter(i => i.status !== 'rejected')

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 style={{
              fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em',
              color: 'var(--ink)', lineHeight: 1, margin: 0,
            }}>
              Ideas
            </h1>
            <p style={{
              fontSize: '12px', fontWeight: 500, color: 'var(--ink-3)',
              margin: '3px 0 0', letterSpacing: '0.01em',
            }}>
              Agente Marketing · iGEO
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Selector cantidad sugerencias */}
          <div
            className="flex items-center gap-1"
            style={{
              height: 28, padding: 2,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            {SUGGEST_COUNTS.map(n => {
              const active = suggestCount === n
              return (
                <button
                  key={n}
                  onClick={() => setSuggestCount(n)}
                  disabled={loadingAI}
                  style={{
                    height: 22, minWidth: 26, padding: '0 8px',
                    fontSize: 11, fontWeight: 700,
                    borderRadius: 'var(--radius-pill)',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--ink-2)',
                    border: 'none', cursor: 'pointer',
                  }}
                  title={`Generar ${n} ideas`}
                >
                  {n}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleSuggestAI}
            disabled={loadingAI}
            className="btn-pill-secondary disabled:opacity-60"
          >
            {loadingAI ? (
              <>
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                Generando…
              </>
            ) : (
              <>
                <Sparkles size={13} aria-hidden="true" />
                Sugerir con IA
              </>
            )}
          </button>
          <button onClick={() => setAddModalOpen(true)} className="btn-cta">
            <Plus size={13} aria-hidden="true" />
            Nueva idea
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--ink-3)' }}>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span className="text-[13px]">Cargando ideas…</span>
            </div>
          ) : visibleIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-up">
              <div
                className="w-12 h-12 flex items-center justify-center"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
              >
                <Sparkles size={20} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                  No hay ideas todavía
                </p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                  Genera nuevas ideas con IA o añade una manualmente
                </p>
              </div>
            </div>
          ) : (
            visibleIdeas.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                busy={busyId === idea.id}
                onAccept={handleAccept}
                onDiscard={handleDiscard}
                onConvert={handleConvert}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal nueva idea manual */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Nueva idea"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div>
            <span className="section-label block mb-1.5">Título</span>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddIdea() }}
              placeholder="Ej: LinkedIn: 5 errores comunes en gestión de plagas"
              className="input"
            />
          </div>

          <div>
            <span className="section-label block mb-1.5">Canal</span>
            <select value={newChannel} onChange={e => setNewChannel(e.target.value as Channel)} className="input">
              {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
          </div>

          <div>
            <span className="section-label block mb-1.5">Mercado</span>
            <select value={newMarket} onChange={e => setNewMarket(e.target.value)} className="input">
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setAddModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={handleAddIdea}
              disabled={!newTitle.trim()}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              Añadir idea
            </button>
          </div>
        </div>
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}

// ─── IdeaCard ────────────────────────────────────────────────────────────────

function IdeaCard({
  idea, busy, onAccept, onDiscard, onConvert,
}: {
  idea: Idea
  busy: boolean
  onAccept: (id: string) => void
  onDiscard: (id: string) => void
  onConvert: (id: string) => void
}) {
  const isConverted = idea.status === 'converted'
  return (
    <div
      className="flex items-center gap-4 group animate-fade-up card"
      style={{ padding: 16, opacity: isConverted ? 0.6 : 1 }}
    >
      <div className="shrink-0">
        {idea.channel
          ? <ChannelBadge channel={idea.channel} />
          : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>—</span>}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>
          {idea.title}
        </p>
        {idea.description && (
          <p className="text-[12px] line-clamp-1 mt-0.5" style={{ color: 'var(--ink-2)' }}>
            {idea.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
            {FLAGS[idea.market] ?? '🌐'} {idea.market}
          </span>
          {idea.source === 'ai' && (
            <span className="badge badge-muted">
              <Sparkles size={9} aria-hidden="true" style={{ color: 'var(--ink-3)' }} /> Sugerido por IA
            </span>
          )}
          {idea.status === 'accepted' && (
            <span
              className="inline-flex items-center"
              style={{
                gap: 5, height: 20, padding: '0 8px', fontSize: 11, fontWeight: 500,
                borderRadius: 'var(--radius-pill)',
                color: 'var(--green-2)', background: 'var(--green-soft)', border: '1px solid var(--green-border)',
                lineHeight: 1,
              }}
            >
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
              Aceptada
            </span>
          )}
          {isConverted && (
            <span
              className="inline-flex items-center"
              style={{
                gap: 5, height: 20, padding: '0 8px', fontSize: 11, fontWeight: 500,
                borderRadius: 'var(--radius-pill)',
                color: 'var(--ink-2)', background: 'var(--surface-2)', border: '1px solid var(--border)',
                lineHeight: 1,
              }}
              title="Esta idea ya está en el pipeline"
            >
              <CheckCircle2 size={11} aria-hidden="true" />
              Convertida
            </span>
          )}
        </div>
      </div>

      {!isConverted && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {idea.status !== 'accepted' && (
            <button
              onClick={() => onAccept(idea.id)}
              disabled={busy}
              className="idea-action idea-action-accept"
              aria-label="Aceptar idea"
              title="Aceptar"
            >
              <ThumbsUp size={14} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => onDiscard(idea.id)}
            disabled={busy}
            className="idea-action idea-action-reject"
            aria-label="Descartar idea"
            title="Descartar"
          >
            <ThumbsDown size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => onConvert(idea.id)}
            disabled={busy}
            className="idea-action idea-action-convert"
            aria-label="Convertir al pipeline"
            title="Añadir al pipeline"
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  )
}
