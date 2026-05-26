'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Plus, ArrowRight, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { cn, MARKET_CONFIG } from '@/lib/utils'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { Channel, Market } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

type IdeaStatus = 'pending' | 'accepted' | 'rejected' | 'converted'
type IdeaSource = 'ai' | 'human'

interface Idea {
  id: string
  title: string
  channel: Channel
  market: string
  source: IdeaSource
  status: IdeaStatus
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  spain: '🇪🇸',
  latam: '🌎',
  uk: '🇬🇧',
  france: '🇫🇷',
  italy: '🇮🇹',
  portugal: '🇵🇹',
  brasil: '🇧🇷',
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

const INITIAL_IDEAS: Idea[] = [
  { id: '1', title: 'Hilo X: 4 señales de que tu empresa de calidad del agua necesita un ERP', channel: 'x', market: 'spain', source: 'ai', status: 'pending' },
  { id: '2', title: 'Instagram: El proceso de una visita de legionella en 6 slides', channel: 'instagram', market: 'spain', source: 'ai', status: 'pending' },
  { id: '3', title: 'Blog: Comparativa ERP genérico vs ERP especializado para servicios técnicos', channel: 'blog', market: 'spain', source: 'human', status: 'pending' },
  { id: '4', title: 'LinkedIn: Caso práctico — cómo una empresa de plagas redujo su papeleo un 70%', channel: 'linkedin', market: 'spain', source: 'ai', status: 'accepted' },
  { id: '5', title: 'Newsletter UK: Field service trends in environmental health 2026', channel: 'newsletter', market: 'uk', source: 'ai', status: 'pending' },
  { id: '6', title: 'Facebook: ¿Qué es un ERP especializado y por qué importa para tu empresa de servicios?', channel: 'facebook', market: 'spain', source: 'human', status: 'pending' },
]

const AI_SUGGESTIONS: Omit<Idea, 'id'>[] = [
  { title: 'LinkedIn: 3 razones por las que los ERPs genéricos no sirven para servicios técnicos', channel: 'linkedin', market: 'spain', source: 'ai', status: 'pending' },
  { title: 'Instagram: ¿Cuánto tiempo pierden tus técnicos en papeleo innecesario?', channel: 'instagram', market: 'spain', source: 'ai', status: 'pending' },
  { title: 'X: Hilo — El día a día de una empresa de control de plagas digitalizada', channel: 'x', market: 'spain', source: 'ai', status: 'pending' },
]

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>(INITIAL_IDEAS)
  const [loadingAI, setLoadingAI] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newChannel, setNewChannel] = useState<Channel>('linkedin')
  const [newMarket, setNewMarket] = useState('spain')
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  const handleAccept = useCallback((id: string) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'accepted' as IdeaStatus } : i))
    showToast('Idea aceptada', 'success')
  }, [showToast])

  const handleDiscard = useCallback((id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id))
    showToast('Idea descartada', 'info')
  }, [showToast])

  const handleConvert = useCallback((id: string) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'converted' as IdeaStatus } : i))
    showToast('Añadida al pipeline', 'success')
    setTimeout(() => {
      setIdeas(prev => prev.filter(i => i.id !== id))
    }, 400)
  }, [showToast])

  const handleSuggestAI = useCallback(async () => {
    setLoadingAI(true)
    await new Promise(r => setTimeout(r, 1800))
    const newIdeas: Idea[] = AI_SUGGESTIONS.map(s => ({
      ...s,
      id: Math.random().toString(36).slice(2),
    }))
    setIdeas(prev => [...newIdeas, ...prev])
    setLoadingAI(false)
    showToast('3 nuevas ideas generadas', 'success')
  }, [showToast])

  const handleAddIdea = useCallback(() => {
    if (!newTitle.trim()) return
    const idea: Idea = {
      id: Math.random().toString(36).slice(2),
      title: newTitle.trim(),
      channel: newChannel,
      market: newMarket,
      source: 'human',
      status: 'pending',
    }
    setIdeas(prev => [idea, ...prev])
    setAddModalOpen(false)
    setNewTitle('')
    setNewChannel('linkedin')
    setNewMarket('spain')
    showToast('Idea añadida', 'success')
  }, [newTitle, newChannel, newMarket, showToast])

  const visibleIdeas = ideas.filter(i => i.status !== 'converted')

  const inputStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 className="text-[16px] font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
              Ideas
            </h1>
            <p className="text-[11.5px] mt-1 leading-none" style={{ color: 'var(--muted)' }}>
              {visibleIdeas.length} {visibleIdeas.length === 1 ? 'idea en revisión' : 'ideas en revisión'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSuggestAI}
            disabled={loadingAI}
            className="btn-ghost flex items-center gap-1.5 disabled:opacity-60"
          >
            {loadingAI ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Sugerir con IA
              </>
            )}
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={13} />
            Nueva idea
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-2 stagger">
          {visibleIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-up">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              >
                <Sparkles size={20} style={{ color: 'var(--muted)' }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                  No hay ideas pendientes
                </p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
                  Genera nuevas ideas con IA o añade una manualmente
                </p>
              </div>
            </div>
          ) : (
            visibleIdeas.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onAccept={handleAccept}
                onDiscard={handleDiscard}
                onConvert={handleConvert}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Nueva idea"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Título
            </span>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddIdea() }}
              placeholder="Ej: LinkedIn: 5 errores comunes en gestión de plagas"
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-colors"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--orange)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          <div>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Canal
            </span>
            <select
              value={newChannel}
              onChange={e => setNewChannel(e.target.value as Channel)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={inputStyle}
            >
              {CHANNELS.map(c => (
                <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide block mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Mercado
            </span>
            <select
              value={newMarket}
              onChange={e => setNewMarket(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
              style={inputStyle}
            >
              {MARKETS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setAddModalOpen(false)}
              className="btn-ghost flex-1"
            >
              Cancelar
            </button>
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
  idea,
  onAccept,
  onDiscard,
  onConvert,
}: {
  idea: Idea
  onAccept: (id: string) => void
  onDiscard: (id: string) => void
  onConvert: (id: string) => void
}) {
  return (
    <div
      className="flex items-center gap-4 p-4 group animate-fade-up transition-colors duration-150 rounded-lg"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div className="shrink-0">
        <ChannelBadge channel={idea.channel} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium leading-snug" style={{ color: 'var(--text)' }}>
          {idea.title}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>{FLAGS[idea.market] ?? '🌐'} {idea.market}</span>
          {idea.source === 'ai' && (
            <span className="badge badge-blue">
              <Sparkles size={9} /> Sugerido por IA
            </span>
          )}
          {idea.status === 'accepted' && (
            <span className="badge badge-green">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}
              />
              Aceptada
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {idea.status !== 'accepted' && (
          <button
            onClick={() => onAccept(idea.id)}
            title="Aceptar"
            className="p-2 rounded-full transition-colors hover:bg-emerald-500/10 text-[var(--muted)] hover:text-emerald-400"
          >
            <ThumbsUp size={14} />
          </button>
        )}
        <button
          onClick={() => onDiscard(idea.id)}
          title="Descartar"
          className="p-2 rounded-full transition-colors hover:bg-rose-500/10 text-[var(--muted)] hover:text-rose-400"
        >
          <ThumbsDown size={14} />
        </button>
        <button
          onClick={() => onConvert(idea.id)}
          title="Añadir al pipeline"
          className="p-2 rounded-full transition-colors text-[var(--muted)]"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,88,12,0.10)'; e.currentTarget.style.color = 'var(--orange3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
        >
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
