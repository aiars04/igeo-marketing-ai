'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar, Plus, Trash2, Loader2, Wand2,
  CheckCircle2, AlertTriangle, ArrowRight, Package,
  Sparkles,
} from 'lucide-react'
import { useToast, Toasts } from '@/components/ui/Toast'
import type {
  Playbook, PlaybookType, Market,
  ContentItem, CampaignPackage,
} from '@/types/database'

const PLAYBOOK_TYPES: { value: PlaybookType; label: string; icon: string }[] = [
  { value: 'webinar',          label: 'Webinar',              icon: '🎥' },
  { value: 'event_presential', label: 'Evento presencial',    icon: '📍' },
  { value: 'event_online',     label: 'Evento online',        icon: '💻' },
  { value: 'release',          label: 'Novedad de producto',  icon: '🚀' },
  { value: 'newsletter',       label: 'Newsletter',           icon: '📰' },
  { value: 'campaign',         label: 'Campaña comercial',    icon: '🎯' },
  { value: 'alliance',         label: 'Alianza',              icon: '🤝' },
  { value: 'workshop',         label: 'Workshop',             icon: '🛠️' },
  { value: 'lead_magnet',      label: 'Lead magnet',          icon: '🧲' },
  { value: 'reactivation',     label: 'Reactivación',         icon: '💌' },
  { value: 'podcast',          label: 'Podcast',              icon: '🎙️' },
]

const MARKETS: { value: Market; label: string }[] = [
  { value: 'spain',    label: 'España'      },
  { value: 'latam',    label: 'LATAM'       },
  { value: 'uk',       label: 'Reino Unido' },
  { value: 'france',   label: 'Francia'     },
  { value: 'italy',    label: 'Italia'      },
  { value: 'portugal', label: 'Portugal'    },
  { value: 'brasil',   label: 'Brasil'      },
]

interface BacklogRow {
  uid: string  // local id para React keys
  type: PlaybookType
  title: string
  date: string  // yyyy-MM-ddThh:mm
  playbook_id?: string
  objective?: string
}

interface PlanReport {
  packages_created: CampaignPackage[]
  items_created: ContentItem[]
  filler_items: ContentItem[]
  warnings: string[]
  summary: {
    backlog_items: number
    packages_created: number
    total_pieces: number
    filler_pieces: number
    gaps_detected: number
    collisions: number
  }
}

function currentMonthYYYYMM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthYYYYMM(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function makeUid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function typeIcon(t: PlaybookType): string {
  return PLAYBOOK_TYPES.find(x => x.value === t)?.icon ?? '📄'
}

export default function OrchestratorPage() {
  const [month, setMonth] = useState(nextMonthYYYYMM())
  const [market, setMarket] = useState<Market>('spain')
  const [fillGaps, setFillGaps] = useState(true)
  const [backlog, setBacklog] = useState<BacklogRow[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [report, setReport] = useState<PlanReport | null>(null)
  const { items: toasts, show: toast, remove: removeToast } = useToast()

  // Cargar playbooks activos
  const loadPlaybooks = useCallback(async () => {
    try {
      const res = await fetch('/api/playbooks?active=true')
      if (res.ok) setPlaybooks(await res.json() as Playbook[])
    } catch {}
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPlaybooks() }, [loadPlaybooks])

  const addBacklogRow = () => {
    const monthInfo = /^(\d{4})-(\d{2})$/.exec(month)
    let defaultDate = ''
    if (monthInfo) {
      // Día 15 del mes a las 10:00 como sugerencia
      defaultDate = `${monthInfo[1]}-${monthInfo[2]}-15T10:00`
    }
    setBacklog(prev => [...prev, {
      uid: makeUid(),
      type: 'webinar',
      title: '',
      date: defaultDate,
    }])
  }

  const updateRow = (uid: string, patch: Partial<BacklogRow>) => {
    setBacklog(prev => prev.map(r => r.uid === uid ? { ...r, ...patch } : r))
  }

  const removeRow = (uid: string) => {
    setBacklog(prev => prev.filter(r => r.uid !== uid))
  }

  const playbooksForType = (type: PlaybookType): Playbook[] =>
    playbooks.filter(p => p.type === type && (p.market_scope === 'all' || p.market_scope === market))

  const canGenerate = backlog.length > 0 && backlog.every(r => r.title.trim() && r.date)

  const handleGenerate = async () => {
    if (!canGenerate) {
      toast('Completa título y fecha en todas las filas del backlog', 'error')
      return
    }
    setSubmitting(true)
    setReport(null)
    try {
      const payload = {
        month,
        market,
        fill_gaps: fillGaps,
        backlog: backlog.map(r => ({
          type: r.type,
          title: r.title.trim(),
          date: new Date(r.date).toISOString(),
          playbook_id: r.playbook_id || undefined,
          objective: r.objective?.trim() || undefined,
        })),
      }
      const res = await fetch('/api/editorial-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? res.statusText}`, 'error')
        return
      }
      const data = await res.json() as PlanReport
      setReport(data)
      toast(`Plan generado · ${data.summary.total_pieces} piezas`, 'success')
    } finally {
      setSubmitting(false)
    }
  }

  const resetAll = () => {
    setReport(null)
    setBacklog([])
  }

  return (
    <div
      className="p-4 sm:p-6"
      style={{
        background: 'var(--bg)',
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div className="mb-5">
        <h1 style={{
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em',
          color: 'var(--ink)', lineHeight: 1, margin: 0,
        }}>
          Orquestrador editorial
        </h1>
        <p style={{
          fontSize: 12, fontWeight: 500, color: 'var(--ink-3)',
          margin: '3px 0 0', letterSpacing: '0.01em',
        }}>
          Genera el calendario editorial del mes a partir de tu backlog
        </p>
      </div>

      {report ? (
        <ReportView report={report} onReset={resetAll} />
      ) : (
        <>
          {/* Configuración mes + mercado */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 16,
            }}
          >
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--ink-3)', marginBottom: 10,
            }}>
              Configuración
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Mes">
                <input
                  type="month"
                  className="input"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  min={currentMonthYYYYMM()}
                />
              </Field>
              <Field label="Mercado">
                <select
                  className="input"
                  value={market}
                  onChange={e => setMarket(e.target.value as Market)}
                >
                  {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Huecos">
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    height: 36, padding: '0 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox" checked={fillGaps}
                    onChange={e => setFillGaps(e.target.checked)}
                  />
                  Rellenar semanas vacías
                </label>
              </Field>
            </div>
          </div>

          {/* Backlog */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--ink-3)',
                }}>
                  Backlog del mes
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  Añade los eventos, webinars, lanzamientos y campañas previstas
                </p>
              </div>
              <button className="btn-pill-secondary" onClick={addBacklogRow}>
                <Plus size={11} aria-hidden="true" /> Añadir ítem
              </button>
            </div>

            {backlog.length === 0 ? (
              <div
                style={{
                  padding: 30, textAlign: 'center',
                  background: 'var(--surface-2)',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--ink-3)', fontSize: 12.5,
                }}
              >
                <Calendar size={20} aria-hidden="true" style={{ opacity: 0.4, marginBottom: 6 }} />
                <p>Aún no has añadido nada al backlog</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                  Ejemplo: un webinar el día 15, una feria el 22, un release el 8…
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {backlog.map((row, idx) => {
                  const matchingPlaybooks = playbooksForType(row.type)
                  return (
                    <div
                      key={row.uid}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 12,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div style={{
                          width: 26, height: 26, flexShrink: 0,
                          background: 'var(--accent-soft)', color: 'var(--accent-2)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, marginTop: 2,
                        }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2">
                          <div className="md:col-span-3">
                            <Field label="Tipo" small>
                              <select
                                className="input" value={row.type}
                                onChange={e => updateRow(row.uid, {
                                  type: e.target.value as PlaybookType,
                                  playbook_id: undefined,
                                })}
                                style={{ height: 32 }}
                              >
                                {PLAYBOOK_TYPES.map(t => (
                                  <option key={t.value} value={t.value}>
                                    {t.icon} {t.label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="md:col-span-5">
                            <Field label="Título" small>
                              <input
                                className="input" value={row.title}
                                onChange={e => updateRow(row.uid, { title: e.target.value })}
                                placeholder='Ej: "Webinar Legionella Q3"'
                                style={{ height: 32 }}
                              />
                            </Field>
                          </div>
                          <div className="md:col-span-4">
                            <Field label="Fecha ancla" small>
                              <input
                                type="datetime-local" className="input" value={row.date}
                                onChange={e => updateRow(row.uid, { date: e.target.value })}
                                style={{ height: 32 }}
                              />
                            </Field>
                          </div>

                          {matchingPlaybooks.length > 1 && (
                            <div className="md:col-span-12">
                              <Field label="Playbook (opcional, hay varios disponibles)" small>
                                <select
                                  className="input" value={row.playbook_id ?? ''}
                                  onChange={e => updateRow(row.uid, { playbook_id: e.target.value || undefined })}
                                  style={{ height: 32 }}
                                >
                                  <option value="">Auto (primer disponible)</option>
                                  {matchingPlaybooks.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </Field>
                            </div>
                          )}
                          {matchingPlaybooks.length === 0 && (
                            <div className="md:col-span-12" style={{
                              fontSize: 11, color: 'var(--amber-2)',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                              <AlertTriangle size={11} aria-hidden="true" />
                              No hay playbooks activos para este tipo en {market}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeRow(row.uid)}
                          aria-label="Eliminar"
                          style={{
                            width: 26, height: 26,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', color: 'var(--ink-3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3">
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 'auto' }}>
              {backlog.length > 0
                ? `${backlog.length} ítem${backlog.length === 1 ? '' : 's'} en el backlog`
                : 'Añade al menos un ítem para generar el plan'}
            </p>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || submitting}
              className="btn-cta"
            >
              {submitting
                ? <><Loader2 size={13} className="animate-spin" /> Generando…</>
                : <><Wand2 size={13} /> Generar plan editorial</>}
            </button>
          </div>
        </>
      )}

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Vista de reporte post-generación
// ─────────────────────────────────────────────────────────────────────────
function ReportView({ report, onReset }: { report: PlanReport; onReset: () => void }) {
  const hasWarnings = report.warnings.length > 0

  return (
    <div>
      {/* Resumen */}
      <div
        style={{
          background: 'var(--green-soft)',
          border: '1px solid var(--green-border, rgba(52,199,89,0.30))',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <CheckCircle2 size={24} aria-hidden="true" style={{ color: 'var(--green-2)', flexShrink: 0 }} />
        <div className="flex-1">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Plan editorial generado
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
            {report.summary.total_pieces} piezas creadas en {report.summary.packages_created} paquete{report.summary.packages_created === 1 ? '' : 's'}
            {report.summary.filler_pieces > 0 && ` · ${report.summary.filler_pieces} filler${report.summary.filler_pieces === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link href="/pipeline" className="btn-cta">
          Ver en Pipeline <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatPill label="Items backlog" value={report.summary.backlog_items} icon="📥" />
        <StatPill label="Paquetes" value={report.summary.packages_created} icon="📦" tone="accent" />
        <StatPill label="Piezas total" value={report.summary.total_pieces} icon="📝" tone="success" />
        <StatPill label="Huecos detectados" value={report.summary.gaps_detected} icon="⚠️" tone={report.summary.gaps_detected > 0 ? 'amber' : undefined} />
        <StatPill label="Colisiones" value={report.summary.collisions} icon="🚨" tone={report.summary.collisions > 0 ? 'red' : undefined} />
      </div>

      {/* Paquetes creados */}
      {report.packages_created.length > 0 && (
        <Section title="Paquetes creados" icon={<Package size={13} aria-hidden="true" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.packages_created.map(pkg => {
              const itemsOfPkg = report.items_created.filter(i => i.package_id === pkg.id)
              return (
                <div
                  key={pkg.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{typeIcon(pkg.package_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                      margin: 0, lineHeight: 1.3,
                    }}>
                      {pkg.title}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      {itemsOfPkg.length} piezas · ancla: {pkg.anchor_date && new Date(pkg.anchor_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Filler */}
      {report.filler_items.length > 0 && (
        <Section title="Piezas filler para semanas vacías" icon={<Sparkles size={13} aria-hidden="true" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.filler_items.map(item => (
              <div
                key={item.id}
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: 12.5, color: 'var(--ink-2)',
                }}
              >
                {item.title}
                {item.scheduled_at && (
                  <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontSize: 11 }}>
                    · {new Date(item.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <Section title={`Avisos (${report.warnings.length})`} icon={<AlertTriangle size={13} aria-hidden="true" />} tone="amber">
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {report.warnings.map((w, i) => (
              <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Acciones finales */}
      <div className="flex items-center justify-end gap-3 mt-4">
        <button className="btn-secondary" onClick={onReset}>
          Generar otro
        </button>
        <Link href="/pipeline" className="btn-cta">
          <Package size={13} aria-hidden="true" /> Ir al pipeline
        </Link>
      </div>
    </div>
  )
}

function StatPill({
  label, value, icon, tone,
}: {
  label: string; value: number; icon: string;
  tone?: 'accent' | 'success' | 'amber' | 'red'
}) {
  const colors = {
    accent:  { bg: 'var(--accent-soft)',  fg: 'var(--accent-2)' },
    success: { bg: 'var(--green-soft)',   fg: 'var(--green-2)'  },
    amber:   { bg: 'var(--amber-soft)',   fg: '#b25000'          },
    red:     { bg: 'var(--red-soft)',     fg: 'var(--red-2)'    },
  }
  const c = tone ? colors[tone] : { bg: 'var(--surface)', fg: 'var(--ink)' }
  return (
    <div
      style={{
        padding: '12px 14px',
        background: c.bg,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 18, fontWeight: 800, color: c.fg, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        <p style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

function Section({
  title, icon, tone, children,
}: {
  title: string; icon: React.ReactNode; tone?: 'amber';
  children: React.ReactNode
}) {
  const headerColor = tone === 'amber' ? 'var(--amber-2)' : 'var(--ink-3)'
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        marginBottom: 12,
      }}
    >
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
