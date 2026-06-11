'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search, FileText, Target, Sparkles, Loader2, Plus, Trash2,
  ArrowRight, ChevronRight, Copy as CopyIcon, ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast, Toasts } from '@/components/ui/Toast'
import type {
  Market, Channel,
  SeoResearchSession, SeoKeyword, SeoBrief,
  SeoIntent, SeoLevel, SeoBriefStatus,
} from '@/types/database'

const MARKETS: { value: Market; label: string; flag: string }[] = [
  { value: 'spain',    label: 'España',       flag: '🇪🇸' },
  { value: 'latam',    label: 'LATAM',        flag: '🌎' },
  { value: 'uk',       label: 'Reino Unido',  flag: '🇬🇧' },
  { value: 'france',   label: 'Francia',      flag: '🇫🇷' },
  { value: 'italy',    label: 'Italia',       flag: '🇮🇹' },
  { value: 'portugal', label: 'Portugal',     flag: '🇵🇹' },
  { value: 'brasil',   label: 'Brasil',       flag: '🇧🇷' },
]

const CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

const INTENT_LABEL: Record<SeoIntent, string> = {
  informational: 'Informacional',
  commercial:    'Comercial',
  transactional: 'Transaccional',
  navigational:  'Navegacional',
}

const INTENT_COLOR: Record<SeoIntent, { bg: string; fg: string }> = {
  informational: { bg: 'var(--accent-soft)',  fg: 'var(--accent-2)' },
  commercial:    { bg: 'var(--amber-soft)',   fg: '#b25000' },
  transactional: { bg: 'var(--green-soft)',   fg: 'var(--green-2)' },
  navigational:  { bg: 'var(--surface-2)',    fg: 'var(--ink-2)' },
}

const LEVEL_LABEL: Record<SeoLevel, string> = { high: 'Alto', medium: 'Medio', low: 'Bajo' }
const LEVEL_COLOR: Record<SeoLevel, string> = {
  high: 'var(--green-2)', medium: 'var(--amber-2)', low: 'var(--ink-3)',
}

type Tab = 'research' | 'briefs' | 'gaps'

export default function SeoPage() {
  const [tab, setTab] = useState<Tab>('research')
  const { items: toasts, show: toast, remove: removeToast } = useToast()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 h-[60px] shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em',
            color: 'var(--ink)', lineHeight: 1, margin: 0,
          }}>
            SEO Intelligence
          </h1>
          <p style={{
            fontSize: 12, fontWeight: 500, color: 'var(--ink-3)',
            margin: '3px 0 0', letterSpacing: '0.01em',
          }}>
            Research, briefs y análisis de gaps con IA
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 shrink-0" style={{ borderBottom: '1px solid var(--border)', paddingTop: 6 }}>
        {([
          { value: 'research', label: 'Investigación', icon: Search },
          { value: 'briefs',   label: 'Briefs SEO',    icon: FileText },
          { value: 'gaps',     label: 'Análisis de gaps', icon: Target },
        ] as const).map(t => {
          const active = tab === t.value
          const Icon = t.icon
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="inline-flex items-center gap-2"
              style={{
                height: 36, padding: '0 14px',
                fontSize: 12.5, fontWeight: active ? 700 : 500,
                color: active ? 'var(--accent)' : 'var(--ink-2)',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              <Icon size={13} aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
        {tab === 'research' && <ResearchTab toast={toast} />}
        {tab === 'briefs'   && <BriefsTab toast={toast} />}
        {tab === 'gaps'     && <GapsTab toast={toast} />}
      </div>

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1 — RESEARCH
// ═══════════════════════════════════════════════════════════════════════
function ResearchTab({ toast }: { toast: (m: string, k?: 'success' | 'error' | 'info') => void }) {
  const [sessions, setSessions] = useState<SeoResearchSession[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seo/sessions')
      if (res.ok) setSessions(await res.json() as SeoResearchSession[])
    } finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta sesión de research? Se borrarán las keywords asociadas.')) return
    const res = await fetch(`/api/seo/sessions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSessions(prev => prev.filter(s => s.id !== id))
      toast('Sesión eliminada', 'info')
    } else {
      toast('Error eliminando', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          Sesiones de investigación de keywords. Cada una genera ~10-20 keywords con intent, volumen y formato sugerido.
        </p>
        <button className="btn-cta" onClick={() => setCreateOpen(true)}>
          <Plus size={13} aria-hidden="true" /> Nueva investigación
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <Empty
          icon={<Search size={28} aria-hidden="true" style={{ opacity: 0.4 }} />}
          title="Aún no hay investigaciones"
          subtitle="Crea una sesión de research indicando un tema y mercado. Gemini te devolverá un cluster de keywords."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setDetailId(s.id)}
              style={{
                padding: '14px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <div style={{
                width: 36, height: 36, flexShrink: 0,
                background: 'var(--accent-soft)', color: 'var(--accent-2)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Search size={16} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  {s.topic}
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  {MARKETS.find(m => m.value === s.market)?.flag} {MARKETS.find(m => m.value === s.market)?.label}
                  {s.channel && ` · ${s.channel}`}
                  {' · '}{new Date(s.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                aria-label="Eliminar"
                style={{
                  width: 28, height: 28,
                  background: 'var(--surface-2)', border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer', color: 'var(--ink-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
              <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateResearchModal
          onClose={() => setCreateOpen(false)}
          onCreated={(s) => {
            setSessions(prev => [s, ...prev])
            setCreateOpen(false)
            setDetailId(s.id)
            toast(`Investigación generada — ${s.topic}`, 'success')
          }}
          toast={toast}
        />
      )}
      {detailId && (
        <SessionDetailModal
          sessionId={detailId}
          onClose={() => setDetailId(null)}
          toast={toast}
        />
      )}
    </div>
  )
}

function CreateResearchModal({
  onClose, onCreated, toast,
}: {
  onClose: () => void
  onCreated: (s: SeoResearchSession) => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [topic, setTopic] = useState('')
  const [market, setMarket] = useState<Market>('spain')
  const [channel, setChannel] = useState<Channel | ''>('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handle = async () => {
    if (!topic.trim()) { toast('Falta el tema', 'error'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/seo/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          market,
          channel: channel || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      const data = await res.json() as { session: SeoResearchSession }
      onCreated(data.session)
    } finally { setSubmitting(false) }
  }

  return (
    <Modal open onClose={onClose} title="Nueva investigación SEO" size="md">
      <div className="flex flex-col gap-4">
        <Field label="Tema principal">
          <input
            className="input" autoFocus value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder='Ej: "legionella en hospitales" o "control de plagas urbano"'
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mercado">
            <select className="input" value={market} onChange={e => setMarket(e.target.value as Market)}>
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.flag} {m.label}</option>)}
            </select>
          </Field>
          <Field label="Canal (opcional)">
            <select className="input" value={channel} onChange={e => setChannel(e.target.value as Channel | '')}>
              <option value="">Todos</option>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Contexto adicional (opcional)">
          <textarea
            className="input" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ej: enfoque comercial, buyer persona específico, etc."
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-cta" onClick={handle} disabled={submitting}>
            {submitting
              ? <><Loader2 size={13} className="animate-spin" /> Generando…</>
              : <><Sparkles size={13} /> Generar research</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SessionDetailModal({
  sessionId, onClose, toast,
}: {
  sessionId: string
  onClose: () => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  type Detail = SeoResearchSession & { keywords: SeoKeyword[] }
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefTarget, setBriefTarget] = useState<SeoKeyword | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/seo/sessions/${sessionId}`)
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: Detail) => { if (!cancelled) setData(d) })
      .catch(() => toast('Error cargando detalle', 'error'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId, toast])

  if (loading || !data) {
    return (
      <Modal open onClose={onClose} title="Cargando…" size="lg">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Loader2 size={20} className="animate-spin inline-block" />
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={`Research: ${data.topic}`} size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          <span>{MARKETS.find(m => m.value === data.market)?.flag} {MARKETS.find(m => m.value === data.market)?.label}</span>
          {data.channel && <span>· {data.channel}</span>}
          <span>· {data.keywords.length} keywords</span>
        </div>

        {data.notes && (
          <p style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
            {data.notes}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {data.keywords.map(kw => {
            const intentCfg = kw.intent ? INTENT_COLOR[kw.intent] : null
            return (
              <div
                key={kw.id}
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                        {kw.keyword}
                      </p>
                      {kw.intent && intentCfg && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 4,
                          background: intentCfg.bg, color: intentCfg.fg,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {INTENT_LABEL[kw.intent]}
                        </span>
                      )}
                      {kw.suggested_format && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 7px', borderRadius: 4,
                          background: 'var(--surface)', color: 'var(--ink-2)',
                          border: '1px solid var(--border)',
                        }}>
                          {kw.suggested_format}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {kw.estimated_volume && (
                        <span>Volumen <strong style={{ color: LEVEL_COLOR[kw.estimated_volume] }}>{LEVEL_LABEL[kw.estimated_volume]}</strong></span>
                      )}
                      {kw.difficulty && (
                        <span>Dificultad <strong style={{ color: LEVEL_COLOR[kw.difficulty] }}>{LEVEL_LABEL[kw.difficulty]}</strong></span>
                      )}
                    </div>
                    {kw.notes && (
                      <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.45 }}>
                        {kw.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setBriefTarget(kw)}
                    className="btn-pill-secondary"
                    style={{ flexShrink: 0, fontSize: 11 }}
                    title="Generar brief SEO para esta keyword"
                  >
                    <FileText size={11} aria-hidden="true" /> Brief
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {briefTarget && (
        <GenerateBriefModal
          primaryKeyword={briefTarget.keyword}
          defaultMarket={data.market}
          defaultChannel={data.channel}
          researchSessionId={data.id}
          allKeywords={data.keywords.map(k => k.keyword)}
          onClose={() => setBriefTarget(null)}
          onCreated={() => {
            setBriefTarget(null)
            toast('Brief SEO generado', 'success')
          }}
          toast={toast}
        />
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2 — BRIEFS
// ═══════════════════════════════════════════════════════════════════════
const STATUS_LABEL: Record<SeoBriefStatus, string> = {
  draft: 'Borrador', approved: 'Aprobado', converted: 'Convertido', archived: 'Archivado',
}
const STATUS_COLOR: Record<SeoBriefStatus, { bg: string; fg: string }> = {
  draft:     { bg: 'var(--surface-2)',   fg: 'var(--ink-2)' },
  approved:  { bg: 'var(--green-soft)',  fg: 'var(--green-2)' },
  converted: { bg: 'var(--accent-soft)', fg: 'var(--accent-2)' },
  archived:  { bg: 'var(--surface)',     fg: 'var(--ink-3)' },
}

function BriefsTab({ toast }: { toast: (m: string, k?: 'success' | 'error' | 'info') => void }) {
  const [briefs, setBriefs] = useState<SeoBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailBrief, setDetailBrief] = useState<SeoBrief | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/seo/briefs')
      if (res.ok) setBriefs(await res.json() as SeoBrief[])
    } finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          Briefs SEO listos para enviar al redactor o convertir directamente en piezas del pipeline.
        </p>
        <button className="btn-cta" onClick={() => setCreateOpen(true)}>
          <Plus size={13} aria-hidden="true" /> Nuevo brief
        </button>
      </div>

      {loading ? <Loading /> : briefs.length === 0 ? (
        <Empty
          icon={<FileText size={28} aria-hidden="true" style={{ opacity: 0.4 }} />}
          title="No hay briefs todavía"
          subtitle="Crea uno desde aquí o desde el detalle de una sesión de research."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {briefs.map(b => {
            const statusCfg = STATUS_COLOR[b.status]
            return (
              <div
                key={b.id}
                onClick={() => setDetailBrief(b)}
                style={{
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: statusCfg.bg, color: statusCfg.fg,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {STATUS_LABEL[b.status]}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600 }}>
                    {MARKETS.find(m => m.value === b.market)?.flag}
                  </span>
                  {b.channel && (
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>· {b.channel}</span>
                  )}
                  {b.target_length && (
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>· {b.target_length} palabras</span>
                  )}
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  {b.title}
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4 }}>
                  Keyword: <strong>{b.primary_keyword}</strong>
                  {b.secondary_keywords.length > 0 && ` · +${b.secondary_keywords.length} secundarias`}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {createOpen && (
        <GenerateBriefModal
          primaryKeyword=""
          onClose={() => setCreateOpen(false)}
          onCreated={(b) => {
            setBriefs(prev => [b, ...prev])
            setCreateOpen(false)
            setDetailBrief(b)
            toast('Brief generado', 'success')
          }}
          toast={toast}
        />
      )}

      {detailBrief && (
        <BriefDetailModal
          brief={detailBrief}
          onClose={() => setDetailBrief(null)}
          onUpdated={(b) => {
            setBriefs(prev => prev.map(x => x.id === b.id ? b : x))
            setDetailBrief(b)
          }}
          onDeleted={(id) => {
            setBriefs(prev => prev.filter(x => x.id !== id))
            setDetailBrief(null)
          }}
          toast={toast}
        />
      )}
    </div>
  )
}

function GenerateBriefModal({
  primaryKeyword: initialKw,
  defaultMarket = 'spain',
  defaultChannel,
  researchSessionId,
  allKeywords,
  onClose, onCreated, toast,
}: {
  primaryKeyword: string
  defaultMarket?: Market
  defaultChannel?: Channel | null
  researchSessionId?: string
  allKeywords?: string[]
  onClose: () => void
  onCreated: (b: SeoBrief) => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [primaryKw, setPrimaryKw] = useState(initialKw)
  const [secondary, setSecondary] = useState('')
  const [market, setMarket] = useState<Market>(defaultMarket)
  const [channel, setChannel] = useState<Channel | ''>(defaultChannel ?? 'blog')
  const [submitting, setSubmitting] = useState(false)

  const handle = async () => {
    if (!primaryKw.trim()) { toast('Falta la keyword principal', 'error'); return }
    setSubmitting(true)
    try {
      const secs = secondary.split(',').map(s => s.trim()).filter(Boolean)
      const res = await fetch('/api/seo/briefs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_keyword: primaryKw.trim(),
          secondary_keywords: secs,
          market,
          channel: channel || undefined,
          research_session_id: researchSessionId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      const brief = await res.json() as SeoBrief
      onCreated(brief)
    } finally { setSubmitting(false) }
  }

  return (
    <Modal open onClose={onClose} title="Generar brief SEO" size="md">
      <div className="flex flex-col gap-4">
        <Field label="Keyword principal">
          <input
            className="input" value={primaryKw} autoFocus
            onChange={e => setPrimaryKw(e.target.value)}
            placeholder='Ej: "control de legionella en hospitales"'
          />
        </Field>
        <Field label="Keywords secundarias (opcional, separadas por comas)">
          <textarea
            className="input" rows={2} value={secondary}
            onChange={e => setSecondary(e.target.value)}
            placeholder="prevención legionella, normativa real decreto 487, ..."
          />
          {allKeywords && allKeywords.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
              Disponibles en esta sesión: {allKeywords.slice(0, 5).join(', ')}{allKeywords.length > 5 ? '…' : ''}
            </p>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mercado">
            <select className="input" value={market} onChange={e => setMarket(e.target.value as Market)}>
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.flag} {m.label}</option>)}
            </select>
          </Field>
          <Field label="Canal">
            <select className="input" value={channel} onChange={e => setChannel(e.target.value as Channel | '')}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-cta" onClick={handle} disabled={submitting}>
            {submitting
              ? <><Loader2 size={13} className="animate-spin" /> Generando…</>
              : <><Sparkles size={13} /> Generar brief</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function BriefDetailModal({
  brief, onClose, onUpdated, onDeleted, toast,
}: {
  brief: SeoBrief
  onClose: () => void
  onUpdated: (b: SeoBrief) => void
  onDeleted: (id: string) => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [converting, setConverting] = useState(false)

  const updateStatus = async (status: SeoBriefStatus) => {
    const res = await fetch(`/api/seo/briefs/${brief.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      onUpdated(await res.json() as SeoBrief)
      toast(`Estado actualizado: ${STATUS_LABEL[status]}`, 'success')
    } else toast('Error actualizando', 'error')
  }

  const handleConvert = async () => {
    setConverting(true)
    try {
      const res = await fetch(`/api/seo/briefs/${brief.id}/convert`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      toast('Convertido a pipeline (Ideas)', 'success')
      onUpdated({ ...brief, status: 'converted' })
    } finally { setConverting(false) }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este brief?')) return
    const res = await fetch(`/api/seo/briefs/${brief.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDeleted(brief.id)
      toast('Brief eliminado', 'info')
    } else toast('Error eliminando', 'error')
  }

  const copyOutline = () => {
    if (!brief.content_outline) return
    navigator.clipboard.writeText(brief.content_outline).catch(() => {})
    toast('Outline copiado al portapapeles', 'success')
  }

  return (
    <Modal open onClose={onClose} title={brief.title} size="lg">
      <div className="flex flex-col gap-4">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
            background: STATUS_COLOR[brief.status].bg,
            color: STATUS_COLOR[brief.status].fg,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {STATUS_LABEL[brief.status]}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {MARKETS.find(m => m.value === brief.market)?.flag} {MARKETS.find(m => m.value === brief.market)?.label}
          </span>
          {brief.channel && <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>· {brief.channel}</span>}
          {brief.intent && <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>· {INTENT_LABEL[brief.intent]}</span>}
          {brief.target_length && <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>· {brief.target_length} palabras</span>}
        </div>

        {/* Keywords */}
        <div style={{
          padding: 12, background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 4 }}>
            Keyword principal
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {brief.primary_keyword}
          </p>
          {brief.secondary_keywords.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 4 }}>
                Secundarias
              </p>
              <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {brief.secondary_keywords.join(', ')}
              </p>
            </>
          )}
        </div>

        {/* H2 sugeridos */}
        {brief.suggested_h2.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6 }}>
              Estructura sugerida (H2)
            </p>
            <ul style={{ fontSize: 12.5, color: 'var(--ink)', paddingLeft: 18, margin: 0 }}>
              {brief.suggested_h2.map((h, i) => (
                <li key={i} style={{ marginBottom: 3 }}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        {brief.cta && (
          <div style={{ padding: '10px 12px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-2)', marginBottom: 3 }}>
              CTA
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {brief.cta}
            </p>
          </div>
        )}

        {/* Outline */}
        {brief.content_outline && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>
                Outline
              </p>
              <button
                onClick={copyOutline}
                className="btn-pill-secondary"
                style={{ fontSize: 10 }}
              >
                <CopyIcon size={11} aria-hidden="true" /> Copiar
              </button>
            </div>
            <pre style={{
              padding: 12, background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5, color: 'var(--ink-2)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 280, overflowY: 'auto',
              fontFamily: 'inherit', lineHeight: 1.6, margin: 0,
            }}>
              {brief.content_outline}
            </pre>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleDelete}
            style={{
              padding: '0 12px', height: 32, fontSize: 12,
              background: 'var(--surface)', color: 'var(--red-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Trash2 size={11} aria-hidden="true" /> Eliminar
          </button>
          <div style={{ flex: 1 }} />
          {brief.status === 'draft' && (
            <button className="btn-secondary" onClick={() => updateStatus('approved')}>
              <CheckCircle2 size={13} aria-hidden="true" /> Aprobar
            </button>
          )}
          {brief.status !== 'converted' && (
            <button className="btn-cta" onClick={handleConvert} disabled={converting}>
              {converting
                ? <><Loader2 size={13} className="animate-spin" /> Convirtiendo…</>
                : <><ArrowRight size={13} /> Convertir a pipeline</>}
            </button>
          )}
          {brief.status === 'converted' && brief.related_content_item_id && (
            <a
              href="/pipeline"
              className="btn-cta"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={13} aria-hidden="true" /> Ver en pipeline
            </a>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3 — GAPS
// ═══════════════════════════════════════════════════════════════════════
interface GapsResult {
  gaps: Array<{
    topic: string
    intent: string | null
    priority: 'high' | 'medium' | 'low' | null
    rationale: string | null
    suggested_format: string | null
    buyer_persona: string | null
  }>
  summary: string | null
  context: {
    market: Market
    channel: Channel | null
    items_analyzed: number
  }
}

const PRIORITY_COLOR = {
  high:   { bg: 'var(--red-soft)',   fg: 'var(--red-2)',   label: 'Alta' },
  medium: { bg: 'var(--amber-soft)', fg: '#b25000',         label: 'Media' },
  low:    { bg: 'var(--surface-2)',  fg: 'var(--ink-2)',   label: 'Baja' },
}

function GapsTab({ toast }: { toast: (m: string, k?: 'success' | 'error' | 'info') => void }) {
  const [market, setMarket] = useState<Market>('spain')
  const [channel, setChannel] = useState<Channel | ''>('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<GapsResult | null>(null)
  const [briefTarget, setBriefTarget] = useState<string | null>(null)

  const handleRun = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/seo/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, channel: channel || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      setResult(await res.json() as GapsResult)
      toast('Gap analysis completado', 'success')
    } finally { setRunning(false) }
  }

  return (
    <div>
      <div
        style={{
          padding: 16, marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <p style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--ink-3)', marginBottom: 10,
        }}>
          Análisis de gaps de contenido
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 12 }}>
          Gemini Pro analiza el contenido publicado y detecta temas relevantes para el sector iGEO que aún no están cubiertos.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mercado" small>
            <select className="input" value={market} onChange={e => setMarket(e.target.value as Market)} style={{ height: 32 }}>
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.flag} {m.label}</option>)}
            </select>
          </Field>
          <Field label="Canal (opcional)" small>
            <select className="input" value={channel} onChange={e => setChannel(e.target.value as Channel | '')} style={{ height: 32 }}>
              <option value="">Todos</option>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn-cta" onClick={handleRun} disabled={running} style={{ width: '100%' }}>
              {running
                ? <><Loader2 size={13} className="animate-spin" /> Analizando…</>
                : <><Target size={13} /> Analizar gaps</>}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <>
          {result.summary && (
            <div
              style={{
                padding: '12px 14px', marginBottom: 12,
                background: 'var(--accent-soft)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12.5, color: 'var(--ink)',
              }}
            >
              <strong>Patrón detectado:</strong> {result.summary}
            </div>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10 }}>
            {result.gaps.length} gaps detectados · {result.context.items_analyzed} piezas analizadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.gaps.map((gap, i) => {
              const pri = gap.priority ? PRIORITY_COLOR[gap.priority] : null
              return (
                <div
                  key={i}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {pri && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: pri.bg, color: pri.fg,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            Prioridad {pri.label}
                          </span>
                        )}
                        {gap.suggested_format && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                            background: 'var(--surface-2)', color: 'var(--ink-2)',
                            border: '1px solid var(--border)',
                          }}>
                            {gap.suggested_format}
                          </span>
                        )}
                        {gap.buyer_persona && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            · {gap.buyer_persona}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                        {gap.topic}
                      </p>
                      {gap.rationale && (
                        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
                          {gap.rationale}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setBriefTarget(gap.topic)}
                      className="btn-pill-secondary"
                      style={{ flexShrink: 0, fontSize: 11 }}
                    >
                      <FileText size={11} aria-hidden="true" /> Brief
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!result && !running && (
        <Empty
          icon={<Target size={28} aria-hidden="true" style={{ opacity: 0.4 }} />}
          title="Pulsa Analizar gaps para empezar"
          subtitle="Gemini Pro tarda 15-30 segundos en revisar el contenido y proponer temas no cubiertos."
        />
      )}

      {briefTarget && (
        <GenerateBriefModal
          primaryKeyword={briefTarget}
          defaultMarket={market}
          defaultChannel={channel || null}
          onClose={() => setBriefTarget(null)}
          onCreated={() => {
            setBriefTarget(null)
            toast('Brief generado · revísalo en la tab Briefs', 'success')
          }}
          toast={toast}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
      <Loader2 size={20} className="animate-spin inline-block mr-2" aria-hidden="true" />
      Cargando…
    </div>
  )
}

function Empty({
  icon, title, subtitle,
}: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{
      padding: 60, textAlign: 'center',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ marginBottom: 12, display: 'inline-flex' }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
        {title}
      </p>
      <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function Field({
  label, small, children,
}: { label: string; small?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: small ? 10 : 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--ink-3)', marginBottom: 5,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}
