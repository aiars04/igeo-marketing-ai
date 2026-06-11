'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Globe, Loader2, Plus, Trash2, Save, CheckCircle2,
  AlertTriangle, ArrowRight, MessageSquare,
} from 'lucide-react'
import type { Market, MarketRules } from '@/types/database'

const MARKETS: { value: Market; label: string; flag: string }[] = [
  { value: 'spain',    label: 'España',       flag: '🇪🇸' },
  { value: 'latam',    label: 'LATAM',        flag: '🌎' },
  { value: 'uk',       label: 'Reino Unido',  flag: '🇬🇧' },
  { value: 'france',   label: 'Francia',      flag: '🇫🇷' },
  { value: 'italy',    label: 'Italia',       flag: '🇮🇹' },
  { value: 'portugal', label: 'Portugal',     flag: '🇵🇹' },
  { value: 'brasil',   label: 'Brasil',       flag: '🇧🇷' },
]

const CTA_CHANNELS = ['default', 'linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

interface KeywordRules {
  primary?:   string[]
  secondary?: string[]
  forbidden?: string[]
}
interface TerminologyRules {
  prefer?: Record<string, string>
}
interface CtaRules {
  [channel: string]: string | undefined
}

export function MarketRulesTab({
  toast,
}: {
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const [allRules, setAllRules] = useState<MarketRules[]>([])
  const [selectedMarket, setSelectedMarket] = useState<Market>('spain')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local edit state
  const [primaryKws, setPrimaryKws] = useState('')
  const [secondaryKws, setSecondaryKws] = useState('')
  const [forbiddenKws, setForbiddenKws] = useState('')
  const [terminologyPairs, setTerminologyPairs] = useState<{ from: string; to: string }[]>([])
  const [noSayList, setNoSayList] = useState<string[]>([])
  const [ctaMap, setCtaMap] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market-rules')
      if (res.ok) {
        const data = await res.json() as MarketRules[]
        setAllRules(data)
      } else {
        toast('Error cargando reglas', 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Cuando cambia el mercado seleccionado, rellena el estado local
  useEffect(() => {
    const rules = allRules.find(r => r.market === selectedMarket)
    const kw = (rules?.keyword_rules ?? {}) as KeywordRules
    const term = (rules?.terminology_rules ?? {}) as TerminologyRules
    const cta = (rules?.cta_rules ?? {}) as CtaRules
    /* eslint-disable react-hooks/set-state-in-effect */
    setPrimaryKws((kw.primary ?? []).join(', '))
    setSecondaryKws((kw.secondary ?? []).join(', '))
    setForbiddenKws((kw.forbidden ?? []).join(', '))
    setTerminologyPairs(Object.entries(term.prefer ?? {}).map(([from, to]) => ({ from, to })))
    setNoSayList(rules?.no_say_rules ?? [])
    setCtaMap(Object.fromEntries(
      Object.entries(cta).filter(([, v]) => typeof v === 'string') as [string, string][]
    ))
    setNotes(rules?.notes ?? '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedMarket, allRules])

  const csvToArray = (s: string): string[] =>
    s.split(',').map(x => x.trim()).filter(Boolean)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        keyword_rules: {
          primary:   csvToArray(primaryKws),
          secondary: csvToArray(secondaryKws),
          forbidden: csvToArray(forbiddenKws),
        },
        terminology_rules: {
          prefer: Object.fromEntries(
            terminologyPairs
              .filter(p => p.from.trim() && p.to.trim())
              .map(p => [p.from.trim(), p.to.trim()])
          ),
        },
        no_say_rules: noSayList.filter(s => s.trim()),
        cta_rules: Object.fromEntries(
          Object.entries(ctaMap).filter(([, v]) => v && v.trim())
        ),
        notes: notes.trim() || null,
      }
      const res = await fetch(`/api/market-rules/${selectedMarket}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      const updated = await res.json() as MarketRules
      setAllRules(prev => prev.map(r => r.market === selectedMarket ? updated : r))
      toast(`Reglas guardadas — ${MARKETS.find(m => m.value === selectedMarket)?.label}`, 'success')
    } finally {
      setSaving(false)
    }
  }

  // Helpers de listas dinámicas
  const addTerminologyPair = () => setTerminologyPairs(prev => [...prev, { from: '', to: '' }])
  const removeTerminologyPair = (idx: number) =>
    setTerminologyPairs(prev => prev.filter((_, i) => i !== idx))
  const updateTerminologyPair = (idx: number, key: 'from' | 'to', val: string) =>
    setTerminologyPairs(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p))

  const addNoSay = () => setNoSayList(prev => [...prev, ''])
  const removeNoSay = (idx: number) => setNoSayList(prev => prev.filter((_, i) => i !== idx))
  const updateNoSay = (idx: number, val: string) =>
    setNoSayList(prev => prev.map((s, i) => i === idx ? val : s))

  const setCta = (channel: string, val: string) =>
    setCtaMap(prev => ({ ...prev, [channel]: val }))

  // Stats del mercado actual (cantidad de reglas configuradas)
  const stats = (() => {
    const kw = csvToArray(primaryKws).length + csvToArray(secondaryKws).length + csvToArray(forbiddenKws).length
    const term = terminologyPairs.filter(p => p.from.trim() && p.to.trim()).length
    const noSay = noSayList.filter(s => s.trim()).length
    const cta = Object.values(ctaMap).filter(v => v && v.trim()).length
    return { kw, term, noSay, cta }
  })()

  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
      {/* Header de la tab */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Reglas por mercado
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
            Reglas operativas que se inyectan automáticamente en los prompts de Gemini al generar copy e ideas.
          </p>
        </div>
        <button className="btn-cta" onClick={handleSave} disabled={loading || saving}>
          {saving
            ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
            : <><Save size={13} /> Guardar cambios</>}
        </button>
      </div>

      {/* Selector de mercado */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          padding: 10, marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {MARKETS.map(m => {
          const isActive = selectedMarket === m.value
          return (
            <button
              key={m.value}
              onClick={() => setSelectedMarket(m.value)}
              style={{
                height: 34, padding: '0 14px',
                background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                color: isActive ? '#fff' : 'var(--ink-2)',
                border: 'none', borderRadius: 'var(--radius-pill)',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 7,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: 14 }}>{m.flag}</span>
              {m.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Loader2 size={20} className="animate-spin inline-block" />
        </div>
      ) : (
        <>
          {/* Stats del mercado seleccionado */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatCard label="Keywords" value={stats.kw} />
            <StatCard label="Terminología" value={stats.term} />
            <StatCard label="No-decir" value={stats.noSay} tone="red" />
            <StatCard label="CTAs" value={stats.cta} />
          </div>

          {/* Keywords */}
          <Section icon={<Globe size={13} />} title="Keywords">
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
              Separa las palabras con comas. Las primarias se usan cuando encajan naturalmente,
              las prohibidas no se usan nunca.
            </p>
            <Field label="Keywords primarias">
              <textarea
                className="input" rows={2} value={primaryKws}
                onChange={e => setPrimaryKws(e.target.value)}
                placeholder="control de plagas, legionella, sanidad ambiental, ERP servicios técnicos"
              />
            </Field>
            <Field label="Keywords secundarias">
              <textarea
                className="input" rows={2} value={secondaryKws}
                onChange={e => setSecondaryKws(e.target.value)}
                placeholder="trazabilidad, cumplimiento normativo, digitalización"
              />
            </Field>
            <Field label="Keywords prohibidas">
              <textarea
                className="input" rows={2} value={forbiddenKws}
                onChange={e => setForbiddenKws(e.target.value)}
                placeholder="palabras o términos vetados — no se usarán en ningún copy"
                style={{ borderColor: 'rgba(239,68,68,0.30)' }}
              />
            </Field>
          </Section>

          {/* Terminología */}
          <Section icon={<ArrowRight size={13} />} title="Terminología obligatoria">
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
              Cuando aparezca el término de la izquierda en un copy, se reemplaza por el de la derecha.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {terminologyPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="input" value={pair.from}
                    onChange={e => updateTerminologyPair(idx, 'from', e.target.value)}
                    placeholder="Término original"
                    style={{ flex: 1, height: 32 }}
                  />
                  <ArrowRight size={14} aria-hidden="true" style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                  <input
                    className="input" value={pair.to}
                    onChange={e => updateTerminologyPair(idx, 'to', e.target.value)}
                    placeholder="Reemplazar por"
                    style={{ flex: 1, height: 32 }}
                  />
                  <button
                    onClick={() => removeTerminologyPair(idx)}
                    aria-label="Eliminar"
                    style={{
                      width: 28, height: 28,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      color: 'var(--ink-3)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                onClick={addTerminologyPair}
                className="btn-pill-secondary"
                style={{ alignSelf: 'flex-start', fontSize: 11 }}
              >
                <Plus size={11} aria-hidden="true" /> Añadir par
              </button>
            </div>
          </Section>

          {/* No decir nunca */}
          <Section icon={<AlertTriangle size={13} />} title="No decir nunca" tone="red">
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
              Frases prohibidas por compliance/legal. El validador post-generación las detecta y marca el copy para revisión humana.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {noSayList.map((phrase, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="input" value={phrase}
                    onChange={e => updateNoSay(idx, e.target.value)}
                    placeholder="Ej: garantizamos 100% efectividad"
                    style={{ flex: 1, height: 32, borderColor: 'rgba(239,68,68,0.30)' }}
                  />
                  <button
                    onClick={() => removeNoSay(idx)}
                    aria-label="Eliminar"
                    style={{
                      width: 28, height: 28,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      color: 'var(--ink-3)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                onClick={addNoSay}
                className="btn-pill-secondary"
                style={{ alignSelf: 'flex-start', fontSize: 11 }}
              >
                <Plus size={11} aria-hidden="true" /> Añadir frase
              </button>
            </div>
          </Section>

          {/* CTAs por canal */}
          <Section icon={<MessageSquare size={13} />} title="CTAs recomendados">
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
              CTA por defecto y específicos por canal. Si el canal tiene CTA propio, se usa ese; si no, el default.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CTA_CHANNELS.map(ch => (
                <Field key={ch} label={ch === 'default' ? 'CTA por defecto' : `CTA ${ch}`} small>
                  <input
                    className="input" value={ctaMap[ch] ?? ''}
                    onChange={e => setCta(ch, e.target.value)}
                    placeholder={ch === 'default' ? 'Solicita una demo' : `Específico de ${ch} (opcional)`}
                    style={{ height: 32 }}
                  />
                </Field>
              ))}
            </div>
          </Section>

          {/* Notas */}
          <Section icon={<CheckCircle2 size={13} />} title="Notas">
            <Field label="Información libre sobre este mercado" small>
              <textarea
                className="input" rows={3} value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Particularidades culturales, regulatorias o comerciales del mercado…"
              />
            </Field>
          </Section>

          {/* Footer con botón guardar (también arriba) */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              Los cambios se aplican inmediatamente a las próximas generaciones de copy e ideas.
            </p>
            <button className="btn-cta" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                : <><Save size={13} /> Guardar cambios</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
function StatCard({
  label, value, tone,
}: {
  label: string; value: number; tone?: 'red' | 'amber' | 'success'
}) {
  const colors = {
    red:     { fg: 'var(--red-2)' },
    amber:   { fg: '#b25000' },
    success: { fg: 'var(--green-2)' },
  }
  const fg = tone ? colors[tone].fg : 'var(--ink)'
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: fg, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
    </div>
  )
}

function Section({
  icon, title, tone, children,
}: {
  icon: React.ReactNode; title: string; tone?: 'red'; children: React.ReactNode
}) {
  const headerColor = tone === 'red' ? 'var(--red-2)' : 'var(--ink-3)'
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 16, marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10,
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: headerColor,
      }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

function Field({
  label, small, children,
}: {
  label: string; small?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 10 }}>
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
