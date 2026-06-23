'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Plus, ArrowRight, ThumbsDown, Loader2, CheckCircle2,
  Search, Calendar as CalendarIcon, User as UserIcon,
} from 'lucide-react'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import { ALL_MARKETS, MARKET_LABELS, MARKET_CONFIG } from '@/lib/utils'
import type { Channel, Idea, Market } from '@/types/database'

// ─── Constants ──────────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  spain: '🇪🇸', latam: '🌎', uk: '🌐', france: '🇫🇷', italy: '🇮🇹', portugal: '🇵🇹', brasil: '🇧🇷', mexico: '🇲🇽',
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

const CHANNEL_COLORS: Record<Channel, string> = {
  linkedin:   '#0071e3',
  instagram:  '#e8388c',
  facebook:   '#0071e3',
  x:          '#6e6e73',
  blog:       '#ff9f0a',
  email:      '#ff9f0a',
  newsletter: '#34c759',
}

// MARKETS derivado de la fuente única (lib/utils). Mantiene el orden canónico
// y garantiza que TODOS los mercados activos están aquí — antes la lista local
// podía omitir alguno sin que tsc lo detectara.
const MARKETS: { value: Market; label: string }[] = ALL_MARKETS.map(m => ({
  value: m,
  label: MARKET_CONFIG[m].label,
}))
// MARKET_LABELS también viene de @/lib/utils (importado arriba).

const SUGGEST_COUNTS = [3, 5, 10] as const
type SuggestCount = typeof SUGGEST_COUNTS[number]

type FilterMode = 'all' | 'pending' | 'accepted' | 'converted'

// ─── Main page ───────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const router = useRouter()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAI, setLoadingAI] = useState(false)
  const [suggestCount, setSuggestCount] = useState<SuggestCount>(3)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newChannel, setNewChannel] = useState<Channel>('linkedin')
  const [newMarket, setNewMarket] = useState<Market>('spain')

  // Detail modal
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editChannel, setEditChannel] = useState<Channel | null>(null)
  const [editMarket, setEditMarket] = useState<Market>('spain')
  const [savingEdits, setSavingEdits] = useState(false)
  const [convertingFromModal, setConvertingFromModal] = useState(false)
  const [confirmDiscardModal, setConfirmDiscardModal] = useState(false)

  // Filters
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')

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

  // ── Stats (sobre el total real) ───────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      ideas.length,
    pending:    ideas.filter(i => i.status === 'pending').length,
    accepted:   ideas.filter(i => i.status === 'accepted').length,
    converted:  ideas.filter(i => i.status === 'converted').length,
  }), [ideas])

  // ── Lista filtrada — oculta rejected siempre ──────────────────────────────
  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ideas.filter(i => {
      if (i.status === 'rejected') return false
      if (filter === 'pending'   && i.status !== 'pending')   return false
      if (filter === 'accepted'  && i.status !== 'accepted')  return false
      if (filter === 'converted' && i.status !== 'converted') return false
      if (q) {
        const hay = (i.title + ' ' + (i.description ?? '')).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [ideas, filter, search])

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      return false
    }
    setIdeas(prev => prev.filter(i => i.id !== id))
    showToast('Idea descartada', 'info')
    return true
  }, [showToast])

  // Guard anti doble-submit: una idea no puede convertirse dos veces a la vez.
  // Sin esto, un doble-click rápido (antes de que la idea pase a 'converted')
  // creaba DOS content_items idénticos en el pipeline.
  const convertingRef = useRef<Set<string>>(new Set())

  const handleConvert = useCallback(async (idea: Idea): Promise<boolean> => {
    if (convertingRef.current.has(idea.id)) return false   // ya en curso
    if (idea.status === 'converted') {
      showToast('Esta idea ya está en el pipeline', 'info')
      return false
    }
    convertingRef.current.add(idea.id)
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
        return false
      }
      // 2) Marcar idea como converted
      const upRes = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'converted' }),
      })
      if (upRes.ok) {
        const updated = await upRes.json() as Idea
        setIdeas(prev => prev.map(i => i.id === idea.id ? updated : i))
      } else {
        showToast('Pipeline OK, pero falló marcar como convertida', 'error')
      }
      showToast('Añadida al pipeline ✓', 'success')
      return true
    } finally {
      convertingRef.current.delete(idea.id)
    }
  }, [showToast])

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

  // ── Detail modal ──────────────────────────────────────────────────────────
  const openDetail = (idea: Idea) => {
    setSelectedIdea(idea)
    setEditTitle(idea.title)
    setEditDescription(idea.description ?? '')
    setEditChannel(idea.channel)
    setEditMarket(idea.market)
    setConfirmDiscardModal(false)
  }
  const closeDetail = () => {
    if (savingEdits || convertingFromModal) return
    setSelectedIdea(null)
    setConfirmDiscardModal(false)
  }

  const isDirty = !!selectedIdea && (
    editTitle.trim() !== selectedIdea.title ||
    (editDescription.trim() || null) !== (selectedIdea.description ?? null) ||
    editChannel !== selectedIdea.channel ||
    editMarket !== selectedIdea.market
  )

  const handleSaveEdits = useCallback(async (silent = false): Promise<boolean> => {
    if (!selectedIdea) return false
    if (!editTitle.trim()) {
      if (!silent) showToast('El título no puede estar vacío', 'error')
      return false
    }
    setSavingEdits(true)
    const patch: Record<string, unknown> = {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      channel: editChannel,
      market: editMarket,
    }
    const res = await fetch(`/api/ideas/${selectedIdea.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSavingEdits(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      if (!silent) showToast(`Error guardando: ${j.error ?? res.statusText}`, 'error')
      return false
    }
    const updated = await res.json() as Idea
    setIdeas(prev => prev.map(i => i.id === updated.id ? updated : i))
    setSelectedIdea(updated)
    if (!silent) showToast('Cambios guardados', 'success')
    return true
  }, [selectedIdea, editTitle, editDescription, editChannel, editMarket, showToast])

  const handleConvertFromModal = useCallback(async () => {
    if (!selectedIdea) return
    setConvertingFromModal(true)
    try {
      // Si hay cambios sin guardar, guardarlos primero (silencioso)
      if (isDirty) {
        const ok = await handleSaveEdits(true)
        if (!ok) {
          showToast('No se pudieron guardar los cambios — convertir cancelado', 'error')
          return
        }
      }
      // Convertir usa el estado actualizado (selectedIdea ya tendría los edits aplicados)
      const idea = isDirty
        ? { ...selectedIdea, title: editTitle.trim(), description: editDescription.trim() || null, channel: editChannel, market: editMarket }
        : selectedIdea
      const ok = await handleConvert(idea)
      if (ok) closeDetail()
    } finally {
      setConvertingFromModal(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdea, isDirty, editTitle, editDescription, editChannel, editMarket, handleSaveEdits, handleConvert, showToast])

  const handleDiscardFromModal = useCallback(async () => {
    if (!selectedIdea) return
    const ok = await handleDiscard(selectedIdea.id)
    if (ok) closeDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdea, handleDiscard])

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* ─── Header ─── */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1, margin: 0 }}>
              Ideas
            </h1>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', margin: '3px 0 0', letterSpacing: '0.01em' }}>
              Agente Marketing · iGEO
            </p>
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
                <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Generando…</>
              ) : (
                <><Sparkles size={13} aria-hidden="true" /> Sugerir con IA</>
              )}
            </button>
            <button onClick={() => setAddModalOpen(true)} className="btn-cta">
              <Plus size={13} aria-hidden="true" /> Nueva idea
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 16 }}>
          {[
            { label: 'Total',       value: stats.total,     color: 'var(--ink)' },
            { label: 'Pendientes',  value: stats.pending,   color: '#b25000' },
            { label: 'Aceptadas',   value: stats.accepted,  color: 'var(--green-2)' },
            { label: 'Convertidas', value: stats.converted, color: 'var(--ink-3)' },
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
        </div>
      </div>

      {/* ─── Filter bar ─── */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ padding: '12px 32px', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          {([
            { value: 'all',        label: 'Todas' },
            { value: 'pending',    label: 'Pendientes' },
            { value: 'accepted',   label: 'Aceptadas' },
            { value: 'converted',  label: 'Convertidas' },
          ] as const).map(p => {
            const active = filter === p.value
            return (
              <button
                key={p.value}
                onClick={() => setFilter(p.value)}
                style={{
                  height: 28, padding: '0 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search
            size={13}
            aria-hidden="true"
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--ink-3)', pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o descripción…"
            className="input"
            style={{ height: 30, paddingLeft: 30, fontSize: 12 }}
          />
        </div>

        {(filter !== 'all' || search) && (
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
            {filteredIdeas.length} de {ideas.filter(i => i.status !== 'rejected').length}
          </span>
        )}
      </div>

      {/* ─── Lista ─── */}
      <div className="flex-1 overflow-auto" style={{ padding: '24px 32px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--ink-3)' }}>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            <span className="text-[13px]">Cargando ideas…</span>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center animate-fade-up">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
            >
              <Sparkles size={20} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                {ideas.length === 0
                  ? 'No hay ideas todavía'
                  : 'Sin resultados con este filtro'}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                {ideas.length === 0
                  ? 'Genera nuevas ideas con IA o añade una manualmente'
                  : 'Prueba a ampliar el filtro o cambiar la búsqueda'}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredIdeas.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onClick={() => openDetail(idea)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Modal nueva idea manual ─── */}
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
            <select value={newMarket} onChange={e => setNewMarket(e.target.value as Market)} className="input">
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

      {/* ─── Modal detalle idea ─── */}
      <Modal
        open={!!selectedIdea}
        onClose={closeDetail}
        title="Detalle de idea"
        size="lg"
      >
        {selectedIdea && (
          <div className="flex flex-col gap-4">
            {/* Badges arriba */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIdea.channel
                ? <ChannelBadge channel={selectedIdea.channel} />
                : <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>Sin canal</span>}
              <span
                className="inline-flex items-center gap-1"
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink-2)',
                }}
              >
                {FLAGS[selectedIdea.market]} {MARKET_LABELS[selectedIdea.market]}
              </span>
              {selectedIdea.source === 'ai' && (
                <span className="badge badge-muted" style={{ fontSize: 10 }}>
                  <Sparkles size={10} aria-hidden="true" /> Sugerido por IA
                </span>
              )}
              {selectedIdea.status === 'accepted' && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--green-2)', background: 'var(--green-soft)',
                    border: '1px solid var(--green-border)',
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                  }}
                >
                  ✓ Aceptada
                </span>
              )}
              {selectedIdea.status === 'converted' && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--ink-3)', background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                  }}
                >
                  → Convertida
                </span>
              )}
            </div>

            {/* Título */}
            <div>
              <span className="section-label block mb-1.5">Título</span>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="input"
                disabled={selectedIdea.status === 'converted'}
              />
            </div>

            {/* Descripción */}
            <div>
              <span className="section-label block mb-1.5">Descripción</span>
              <textarea
                rows={4}
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Detalla la idea: contexto, mensaje, CTA, referencias…"
                className="input"
                disabled={selectedIdea.status === 'converted'}
              />
            </div>

            {/* Canal + Mercado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="section-label block mb-1.5">Canal</span>
                <select
                  value={editChannel ?? ''}
                  onChange={e => setEditChannel((e.target.value || null) as Channel | null)}
                  className="input"
                  disabled={selectedIdea.status === 'converted'}
                >
                  <option value="">— Sin canal —</option>
                  {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <span className="section-label block mb-1.5">Mercado</span>
                <select
                  value={editMarket}
                  onChange={e => setEditMarket(e.target.value as Market)}
                  className="input"
                  disabled={selectedIdea.status === 'converted'}
                >
                  {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {/* Metadatos read-only */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                rowGap: 12, columnGap: 24,
                padding: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <span className="section-label block mb-1">Fuente</span>
                <div className="flex items-center gap-1.5">
                  {selectedIdea.source === 'ai'
                    ? <Sparkles size={11} aria-hidden="true" style={{ color: 'var(--accent-2)' }} />
                    : <UserIcon size={11} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {selectedIdea.source === 'ai' ? 'IA (Gemini)' : 'Manual'}
                  </span>
                </div>
              </div>
              <div>
                <span className="section-label block mb-1">Creada</span>
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={11} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {new Date(selectedIdea.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <div>
                <span className="section-label block mb-1">Estado</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>
                  {selectedIdea.status === 'pending' ? 'Pendiente'
                    : selectedIdea.status === 'accepted' ? 'Aceptada'
                    : selectedIdea.status === 'converted' ? 'Convertida'
                    : selectedIdea.status}
                </span>
              </div>
            </div>

            {/* Footer acciones */}
            <div
              className="flex items-center justify-between pt-3 flex-wrap gap-2"
              style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}
            >
              {selectedIdea.status === 'converted' ? (
                <>
                  <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                    <CheckCircle2 size={14} aria-hidden="true" style={{ color: 'var(--green-2)' }} />
                    Esta idea ya está en el pipeline.
                  </span>
                  <button
                    className="btn-cta"
                    onClick={() => { closeDetail(); router.push('/pipeline') }}
                  >
                    Ver pipeline <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  {/* Izquierda: Descartar */}
                  <div>
                    {confirmDiscardModal ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px]" style={{ color: 'var(--red-2)' }}>¿Descartar esta idea?</span>
                        <button
                          className="btn-secondary"
                          onClick={() => setConfirmDiscardModal(false)}
                          disabled={busyId === selectedIdea.id}
                          style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          className="btn-destructive"
                          onClick={handleDiscardFromModal}
                          disabled={busyId === selectedIdea.id}
                          style={{ height: 28, fontSize: 11, padding: '0 10px' }}
                        >
                          {busyId === selectedIdea.id
                            ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                            : <ThumbsDown size={11} aria-hidden="true" />}
                          Sí, descartar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-pill-secondary"
                        onClick={() => setConfirmDiscardModal(true)}
                        style={{ color: 'var(--red-2)' }}
                      >
                        <ThumbsDown size={13} aria-hidden="true" /> Descartar
                      </button>
                    )}
                  </div>

                  {/* Derecha: Guardar + Convertir */}
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary"
                      onClick={() => handleSaveEdits(false)}
                      disabled={savingEdits || convertingFromModal || !isDirty || !editTitle.trim()}
                    >
                      {savingEdits
                        ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Guardando…</>
                        : 'Guardar cambios'}
                    </button>
                    <button
                      className="btn-cta"
                      onClick={handleConvertFromModal}
                      disabled={savingEdits || convertingFromModal || !editTitle.trim()}
                    >
                      {convertingFromModal
                        ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Convirtiendo…</>
                        : <><ArrowRight size={13} aria-hidden="true" /> Pipeline</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}

// ─── IdeaCard ────────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  onClick,
}: {
  idea: Idea
  onClick: () => void
}) {
  const isConverted = idea.status === 'converted'
  const channelColor = idea.channel ? CHANNEL_COLORS[idea.channel] : null
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="animate-fade-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${channelColor ?? 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        cursor: 'pointer',
        opacity: isConverted ? 0.65 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={e => {
        if (isConverted) return
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Fila 1: badge canal + mercado a la izquierda, badges estado a la derecha */}
      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <div className="flex items-center gap-2 min-w-0">
          {idea.channel
            ? <ChannelBadge channel={idea.channel} />
            : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sin canal</span>}
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {FLAGS[idea.market] ?? '🌐'} {MARKET_LABELS[idea.market] ?? idea.market}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {idea.source === 'ai' && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                fontSize: 10, fontWeight: 600,
                color: 'var(--ink-2)', background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                padding: '1px 7px', borderRadius: 'var(--radius-sm)',
              }}
            >
              <Sparkles size={9} aria-hidden="true" /> Sugerido por IA
            </span>
          )}
          {idea.status === 'accepted' && (
            <span
              style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--green-2)', background: 'var(--green-soft)',
                border: '1px solid var(--green-border)',
                padding: '1px 7px', borderRadius: 'var(--radius-sm)',
              }}
            >
              ✓ Aceptada
            </span>
          )}
          {isConverted && (
            <span
              style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--ink-3)', background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                padding: '1px 7px', borderRadius: 'var(--radius-sm)',
              }}
            >
              → Convertida
            </span>
          )}
        </div>
      </div>

      {/* Fila 2: título */}
      <p
        className="line-clamp-2"
        style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, margin: 0, letterSpacing: '-0.01em' }}
      >
        {idea.title}
      </p>

      {/* Fila 3: descripción (2 líneas máx) */}
      {idea.description && (
        <p
          className="line-clamp-2"
          style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 6 }}
        >
          {idea.description}
        </p>
      )}

      {/* Fila 4: fecha creación */}
      <p
        className="tabular-nums"
        style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, letterSpacing: '0.01em' }}
      >
        {new Date(idea.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
    </div>
  )
}
