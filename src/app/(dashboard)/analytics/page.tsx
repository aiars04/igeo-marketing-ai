'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  Eye, Heart, MessageCircle, Share2,
  Clock, BarChart3, PieChart as PieIcon, GitBranch,
} from 'lucide-react'
import { ChannelBadge } from '@/components/ui/ChannelBadge'
import type { Channel } from '@/types/database'
import {
  MOCK_OVERVIEW,
  MOCK_EVOLUTION,
  MOCK_BY_CHANNEL,
  MOCK_DISTRIBUTION,
  MOCK_FUNNEL,
  MOCK_HEATMAP,
  MOCK_TOP_POSTS,
  CHART_COLORS,
  CHANNEL_LABELS,
  DAYS_LABELS,
  HOUR_BLOCK_LABELS,
  type Period,
  type MetricKey,
  type OverviewMetric,
} from './mock-data'

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const formatNumber = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

const METRIC_ICONS: Record<MetricKey, typeof Eye> = {
  views: Eye,
  likes: Heart,
  comments: MessageCircle,
  shares: Share2,
}

const METRIC_COLORS: Record<MetricKey, string> = {
  views: CHART_COLORS.views,
  likes: CHART_COLORS.likes,
  comments: CHART_COLORS.comments,
  shares: CHART_COLORS.shares,
}

// ═══════════════════════════════════════════════════════════════════════════
// TrendBadge — pill verde/rojo/neutro con icono
// ═══════════════════════════════════════════════════════════════════════════

function TrendBadge({ delta }: { delta: number }) {
  const isPos = delta > 0
  const isNeu = delta === 0
  const Icon = isNeu ? Minus : isPos ? TrendingUp : TrendingDown
  const color = isNeu ? 'var(--ink-2)' : isPos ? 'var(--green-2)' : 'var(--red-2)'
  const bg = isNeu ? 'var(--surface-2)' : isPos ? 'var(--green-soft)' : 'var(--red-soft)'
  const border = isNeu ? 'var(--border)' : isPos ? 'var(--green-border)' : 'rgba(255,59,48,0.20)'
  const sign = isPos ? '+' : ''

  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 4,
        height: 20,
        padding: '0 8px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 'var(--radius-pill)',
        color,
        background: bg,
        border: `1px solid ${border}`,
        lineHeight: 1,
      }}
    >
      <Icon size={11} aria-hidden="true" />
      {sign}{delta}%
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MetricCard — KPI + sparkline
// ═══════════════════════════════════════════════════════════════════════════

function MetricCard({ m }: { m: OverviewMetric }) {
  const Icon = METRIC_ICONS[m.key]
  const color = METRIC_COLORS[m.key]
  const sparkData = m.sparkline.map((v, i) => ({ i, v }))

  return (
    <article
      role="article"
      aria-label={`${m.label}: ${formatNumber(m.value)}, ${m.delta >= 0 ? 'aumento' : 'descenso'} del ${Math.abs(m.delta)}% respecto al periodo anterior`}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <Icon size={15} aria-hidden="true" style={{ color }} />
        </div>
        <TrendBadge delta={m.delta} />
      </div>

      <div>
        <div
          className="tabular-nums"
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            lineHeight: 1.05,
          }}
        >
          {formatNumber(m.value)}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-3)',
            marginTop: 4,
          }}
        >
          {m.label}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: 36, marginTop: 'auto' }}>
        <ResponsiveContainer width="100%" height={36}>
          <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PeriodPills — selector 7d / 30d / 90d / año
// ═══════════════════════════════════════════════════════════════════════════

const PERIOD_LABELS: Record<Period, string> = {
  '7d':  '7 días',
  '30d': '30 días',
  '90d': '90 días',
  'year': 'Este año',
}

function PeriodPills({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const periods: Period[] = ['7d', '30d', '90d', 'year']
  return (
    <div
      role="group"
      aria-label="Seleccionar periodo de tiempo"
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 3,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-pill)',
      }}
    >
      {periods.map(p => {
        const active = p === value
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={active}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#ffffff' : 'var(--ink-2)',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            {PERIOD_LABELS[p]}
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CustomTooltip — para Recharts, estilo Apple light
// ═══════════════════════════════════════════════════════════════════════════

interface TooltipPayloadItem {
  name?: string | number
  value?: string | number
  color?: string
  dataKey?: string | number
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string | number }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        fontSize: 12,
      }}
    >
      {label !== undefined && (
        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{String(label)}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ fontWeight: 500 }}>{p.name}</span>
          <span className="tabular-nums" style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--ink)' }}>{typeof p.value === 'number' ? p.value.toLocaleString('es-ES') : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Heatmap — 7 días × 6 bloques de 4h (grid CSS custom, no Recharts)
// ═══════════════════════════════════════════════════════════════════════════

function Heatmap() {
  const max = useMemo(() => Math.max(...MOCK_HEATMAP.map(c => c.value)), [])

  const cellColor = (v: number): string => {
    const t = v / max
    // gradiente blanco → accent
    const alpha = 0.08 + t * 0.85
    return `rgba(0, 113, 227, ${alpha.toFixed(3)})`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Header bloques de hora */}
      <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(6, 1fr)', gap: 4 }}>
        <div />
        {HOUR_BLOCK_LABELS.map(h => (
          <div
            key={h}
            style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', letterSpacing: '0.02em' }}
          >
            {h}
          </div>
        ))}
      </div>
      {/* Filas: días */}
      {DAYS_LABELS.map((day, dayIdx) => (
        <div key={day} style={{ display: 'grid', gridTemplateColumns: '36px repeat(6, 1fr)', gap: 4, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{day}</div>
          {HOUR_BLOCK_LABELS.map((_, blockIdx) => {
            const cell = MOCK_HEATMAP.find(c => c.day === dayIdx && c.hourBlock === blockIdx)
            const v = cell?.value ?? 0
            return (
              <div
                key={blockIdx}
                title={`${day} · ${HOUR_BLOCK_LABELS[blockIdx]} — Engagement ${v}`}
                style={{
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  background: cellColor(v),
                  border: '1px solid var(--border-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: v > max * 0.55 ? '#ffffff' : 'var(--ink-2)',
                  fontVariantNumeric: 'tabular-nums',
                  cursor: 'default',
                }}
              >
                {v > 0 ? v : ''}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ScoreBar — barra horizontal con valor numérico
// ═══════════════════════════════════════════════════════════════════════════

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'var(--green)' : score >= 70 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="flex items-center" style={{ gap: 10, flexShrink: 0 }}>
      <div
        style={{
          width: 80,
          height: 6,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--surface-3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: color,
            borderRadius: 'var(--radius-pill)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span
        className="tabular-nums"
        style={{ fontSize: 13, fontWeight: 700, color, width: 28, textAlign: 'right' }}
      >
        {score}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SectionTitle
// ═══════════════════════════════════════════════════════════════════════════

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Eye; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <Icon size={15} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {title}
        </h2>
      </div>
      {subtitle && (
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, marginLeft: 23 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Página
// ═══════════════════════════════════════════════════════════════════════════

const SERIES_CONFIG: { key: MetricKey; label: string; color: string }[] = [
  { key: 'views',    label: 'Impresiones', color: CHART_COLORS.views    },
  { key: 'likes',    label: 'Likes',       color: CHART_COLORS.likes    },
  { key: 'comments', label: 'Comentarios', color: CHART_COLORS.comments },
  { key: 'shares',   label: 'Compartidos', color: CHART_COLORS.shares   },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({
    views: true, likes: true, comments: true, shares: true,
  })

  const toggleSeries = (k: MetricKey) =>
    setVisible(v => ({ ...v, [k]: !v[k] }))

  const totalPosts = useMemo(
    () => MOCK_DISTRIBUTION.reduce((s, d) => s + d.count, 0),
    [],
  )

  return (
    <div className="flex flex-col h-screen">

      {/* ═══ Topbar ═══ */}
      <div
        className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--ink)',
              lineHeight: 1,
              margin: 0,
            }}>
              Análisis IA
            </h1>
            <p style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink-3)',
              margin: '3px 0 0',
              letterSpacing: '0.01em',
            }}>
              Agente Marketing · iGEO
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PeriodPills value={period} onChange={setPeriod} />
          <span className="badge badge-green">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block"
              style={{ background: 'var(--green)' }}
              aria-hidden="true"
            />
            Datos actualizados
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ═══ SECCIÓN 1 — Resumen ejecutivo ═══ */}
          <section>
            <SectionTitle icon={BarChart3} title="Resumen ejecutivo" subtitle={`Métricas globales del periodo ${PERIOD_LABELS[period].toLowerCase()}`} />
            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {MOCK_OVERVIEW.map(m => (
                <MetricCard key={m.key} m={m} />
              ))}
            </div>
          </section>

          {/* ═══ SECCIÓN 2 — Evolución temporal ═══ */}
          <section className="card">
            <SectionTitle icon={TrendingUp} title="Evolución temporal" subtitle="Métricas día a día. Toca un chip para ocultar/mostrar serie." />

            {/* Toggle series */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {SERIES_CONFIG.map(s => {
                const on = visible[s.key]
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSeries(s.key)}
                    aria-pressed={on}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 26,
                      padding: '0 10px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: on ? 'var(--ink)' : 'var(--ink-3)',
                      background: on ? 'var(--surface-2)' : 'transparent',
                      border: `1px solid ${on ? 'var(--border)' : 'var(--border-soft)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: on ? s.color : 'var(--border-hover)',
                      }}
                      aria-hidden="true"
                    />
                    {s.label}
                  </button>
                )
              })}
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={MOCK_EVOLUTION} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-hover)', strokeWidth: 1 }} />
                  {SERIES_CONFIG.map(s => (
                    visible[s.key] && (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ═══ SECCIÓN 3 — BarChart canal + PieChart distribución ═══ */}
          <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Rendimiento por canal */}
            <div className="card">
              <SectionTitle icon={BarChart3} title="Rendimiento por canal" subtitle="Impresiones, likes y engagement rate" />
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={MOCK_BY_CHANNEL.map(c => ({ ...c, name: CHANNEL_LABELS[c.channel] }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-2)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,113,227,0.04)' }} />
                    <Bar dataKey="views" name="Impresiones" fill={CHART_COLORS.views} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="likes" name="Likes" fill={CHART_COLORS.likes} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="engagement" name="Engagement %" fill={CHART_COLORS.comments} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribución de contenido */}
            <div className="card">
              <SectionTitle icon={PieIcon} title="Distribución de contenido" subtitle="Piezas publicadas por canal" />
              <div style={{ position: 'relative', width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={MOCK_DISTRIBUTION}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {MOCK_DISTRIBUTION.map((d, i) => (
                        <Cell key={i} fill={d.color} stroke="var(--surface)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {totalPosts}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginTop: 4 }}>
                    Piezas
                  </div>
                </div>
              </div>
              {/* Legend custom */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                {MOCK_DISTRIBUTION.map(d => (
                  <div key={d.channel} className="inline-flex items-center" style={{ gap: 6, fontSize: 11, color: 'var(--ink-2)' }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                    {d.label}
                    <span className="tabular-nums" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>· {d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ SECCIÓN 4 — Funnel + Heatmap ═══ */}
          <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Funnel */}
            <div className="card">
              <SectionTitle icon={GitBranch} title="Funnel del pipeline" subtitle="Piezas activas en cada fase" />
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <FunnelChart>
                    <Tooltip content={<ChartTooltip />} />
                    <Funnel dataKey="count" data={MOCK_FUNNEL} isAnimationActive={false} stroke="var(--surface)" strokeWidth={2}>
                      <LabelList
                        position="right"
                        fill="var(--ink)"
                        stroke="none"
                        fontSize={12}
                        fontWeight={600}
                        dataKey="label"
                      />
                      <LabelList
                        position="center"
                        fill="#ffffff"
                        stroke="none"
                        fontSize={14}
                        fontWeight={700}
                        dataKey="count"
                      />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Heatmap mejor hora */}
            <div className="card">
              <SectionTitle icon={Clock} title="Mejor hora de publicación" subtitle="Engagement medio por día y franja horaria" />
              <Heatmap />
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--ink-3)' }}>
                <span>Bajo</span>
                <div style={{ flex: 1, height: 8, borderRadius: 'var(--radius-pill)', background: 'linear-gradient(90deg, rgba(0,113,227,0.08), rgba(0,113,227,0.93))', border: '1px solid var(--border-soft)' }} />
                <span>Alto</span>
              </div>
            </div>
          </section>

          {/* ═══ SECCIÓN 5 — Top contenido publicado ═══ */}
          <section className="card">
            <SectionTitle icon={TrendingUp} title="Top contenido publicado" subtitle={`Las piezas con mejor rendimiento del periodo ${PERIOD_LABELS[period].toLowerCase()}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MOCK_TOP_POSTS.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center"
                  style={{
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--surface-2)'
                  }}
                >
                  {/* Ranking */}
                  <span
                    className="tabular-nums shrink-0"
                    style={{
                      width: 26, height: 26,
                      borderRadius: 'var(--radius-pill)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: i === 0 ? 'var(--accent)' : 'var(--surface-3)',
                      color: i === 0 ? '#ffffff' : 'var(--ink-2)',
                      border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}
                    >
                      {p.title}
                    </p>
                    <div className="flex items-center" style={{ gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                      <ChannelBadge channel={p.channel as Channel} />
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }} className="tabular-nums">{p.date}</span>
                      <span className="inline-flex items-center tabular-nums" style={{ gap: 4, fontSize: 11, color: 'var(--ink-2)' }}>
                        <Eye size={11} aria-hidden="true" /> {formatNumber(p.views)}
                      </span>
                      <span className="inline-flex items-center tabular-nums" style={{ gap: 4, fontSize: 11, color: 'var(--ink-2)' }}>
                        <Heart size={11} aria-hidden="true" /> {p.likes}
                      </span>
                      <span className="inline-flex items-center tabular-nums" style={{ gap: 4, fontSize: 11, color: 'var(--ink-2)' }}>
                        <MessageCircle size={11} aria-hidden="true" /> {p.comments}
                      </span>
                    </div>
                  </div>

                  {/* Score */}
                  <ScoreBar score={p.score} />
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
