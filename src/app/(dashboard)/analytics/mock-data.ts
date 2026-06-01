/**
 * Mock data para el dashboard de Análisis IA.
 *
 * Cuando se conecte Postiz API, sustituir cada bloque por la llamada real.
 * Cada constante incluye un comentario `// TODO: replace with Postiz API call`
 * con el endpoint sugerido.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | 'year'
export type ChannelKey = 'linkedin' | 'instagram' | 'newsletter' | 'blog'
export type MetricKey = 'views' | 'likes' | 'comments' | 'shares'

export interface OverviewMetric {
  key: MetricKey
  label: string
  value: number
  delta: number
  sparkline: number[]
}

export interface EvolutionPoint {
  date: string
  views: number
  likes: number
  comments: number
  shares: number
}

export interface ChannelMetric {
  channel: ChannelKey
  views: number
  likes: number
  engagement: number
}

export interface DistributionSlice {
  channel: ChannelKey
  label: string
  count: number
  color: string
}

export interface FunnelStage {
  stage: string
  label: string
  count: number
  fill: string
}

export interface HeatmapCell {
  day: number
  hourBlock: number
  value: number
}

export interface TopPost {
  id: string
  title: string
  channel: ChannelKey
  date: string
  views: number
  likes: number
  comments: number
  score: number
}

// ─── Constantes de configuración ─────────────────────────────────────────────

export const CHART_COLORS = {
  views: '#0071e3',
  likes: '#ec4899',
  comments: '#34c759',
  shares: '#ff9f0a',
  linkedin: '#0a66c2',
  instagram: '#e8388c',
  newsletter: '#34c759',
  blog: '#fbbf24',
} as const

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  newsletter: 'Newsletter',
  blog: 'Blog',
}

export const DAYS_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const HOUR_BLOCK_LABELS = ['0-4h', '4-8h', '8-12h', '12-16h', '16-20h', '20-24h']

// ─── Mock: Resumen ejecutivo (4 KPIs) ────────────────────────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/metrics/overview?range={period}

export const MOCK_OVERVIEW: OverviewMetric[] = [
  {
    key: 'views',
    label: 'Impresiones',
    value: 12400,
    delta: 18,
    sparkline: [380, 410, 450, 420, 480, 520, 560],
  },
  {
    key: 'likes',
    label: 'Likes',
    value: 847,
    delta: 24,
    sparkline: [22, 28, 32, 35, 38, 42, 48],
  },
  {
    key: 'comments',
    label: 'Comentarios',
    value: 63,
    delta: 9,
    sparkline: [2, 3, 1, 4, 3, 5, 4],
  },
  {
    key: 'shares',
    label: 'Compartidos',
    value: 124,
    delta: 31,
    sparkline: [3, 5, 4, 7, 6, 9, 11],
  },
]

// ─── Mock: Evolución temporal (30 días) ──────────────────────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/metrics/evolution?range={period}

// Generador determinista: picos los martes/miércoles a media mañana (B2B típico)
function buildEvolution(): EvolutionPoint[] {
  const points: EvolutionPoint[] = []
  const now = new Date(2026, 4, 30) // 30 mayo 2026 (alineado con currentDate)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayOfWeek = (d.getDay() + 6) % 7 // 0=Lun..6=Dom
    // Boost martes (1) y miércoles (2)
    const boost = dayOfWeek === 1 || dayOfWeek === 2 ? 1.4 : dayOfWeek >= 5 ? 0.5 : 1.0
    const base = 300 + (i % 7) * 25 + ((29 - i) * 6)
    const views = Math.round(base * boost + (Math.sin(i * 0.7) * 40))
    const likes = Math.round(views * 0.065)
    const comments = Math.round(views * 0.005)
    const shares = Math.round(views * 0.01)
    points.push({
      date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      views,
      likes,
      comments,
      shares,
    })
  }
  return points
}

export const MOCK_EVOLUTION: EvolutionPoint[] = buildEvolution()

// ─── Mock: Rendimiento por canal ─────────────────────────────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/metrics/by-channel?range={period}

export const MOCK_BY_CHANNEL: ChannelMetric[] = [
  { channel: 'linkedin',   views: 5800, likes: 412, engagement: 7.8 },
  { channel: 'blog',       views: 4100, likes: 198, engagement: 6.2 },
  { channel: 'newsletter', views: 1900, likes: 156, engagement: 8.4 },
  { channel: 'instagram',  views: 600,  likes: 81,  engagement: 4.1 },
]

// ─── Mock: Distribución de contenido (Pie donut) ─────────────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/content/distribution?range={period}

export const MOCK_DISTRIBUTION: DistributionSlice[] = [
  { channel: 'linkedin',   label: 'LinkedIn',   count: 12, color: CHART_COLORS.linkedin   },
  { channel: 'blog',       label: 'Blog',       count: 8,  color: CHART_COLORS.blog       },
  { channel: 'newsletter', label: 'Newsletter', count: 4,  color: CHART_COLORS.newsletter },
  { channel: 'instagram',  label: 'Instagram',  count: 6,  color: CHART_COLORS.instagram  },
]

// ─── Mock: Funnel del pipeline ───────────────────────────────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/pipeline/funnel

export const MOCK_FUNNEL: FunnelStage[] = [
  { stage: 'ideas',     label: 'Ideas',          count: 38, fill: '#94a3b8' },
  { stage: 'copy',      label: 'Redacción',      count: 22, fill: '#3b82f6' },
  { stage: 'design',    label: 'Diseño',         count: 14, fill: '#a855f7' },
  { stage: 'scheduled', label: 'Programado',     count: 9,  fill: '#f59e0b' },
  { stage: 'analyzed',  label: 'Analizado',      count: 7,  fill: '#10b981' },
]

// ─── Mock: Heatmap mejor hora (7 días × 6 bloques de 4h) ─────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/metrics/engagement-heatmap

function buildHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = []
  // Patrón B2B: picos martes-jueves bloque 8-12h y 12-16h
  // Bajo: fines de semana + madrugadas
  const pattern: number[][] = [
    // 0-4h  4-8h  8-12h 12-16h 16-20h 20-24h
    [   5,   25,   62,   58,    35,    18 ], // Lun
    [   6,   30,   88,   76,    42,    20 ], // Mar
    [   7,   32,   94,   82,    45,    22 ], // Mié
    [   5,   28,   76,   68,    38,    19 ], // Jue
    [   4,   22,   52,   48,    28,    14 ], // Vie
    [   2,    8,   18,   22,    16,     9 ], // Sáb
    [   2,    6,   14,   18,    14,     8 ], // Dom
  ]
  for (let day = 0; day < 7; day++) {
    for (let block = 0; block < 6; block++) {
      cells.push({ day, hourBlock: block, value: pattern[day][block] })
    }
  }
  return cells
}

export const MOCK_HEATMAP: HeatmapCell[] = buildHeatmap()

// ─── Mock: Top contenido publicado ───────────────────────────────────────────
// TODO: replace with Postiz API call — GET /api/postiz/content/top?range={period}&limit=10

export const MOCK_TOP_POSTS: TopPost[] = [
  { id: '1', title: 'Software para control de plagas: qué buscar antes de elegir ERP',           channel: 'blog',       date: '15 may', views: 3200, likes: 218, comments: 14, score: 92 },
  { id: '2', title: 'Gestión documental en servicios técnicos: 5 errores que cuestan auditorías', channel: 'linkedin',   date: '10 may', views: 2800, likes: 195, comments: 28, score: 87 },
  { id: '3', title: 'Trazabilidad en legionella: guía 2026 para empresas de SAL',                 channel: 'blog',       date: '7 may',  views: 2410, likes: 167, comments: 11, score: 81 },
  { id: '4', title: 'De la operación diaria al control directivo — caso Clece',                   channel: 'linkedin',   date: '5 may',  views: 2100, likes: 143, comments: 19, score: 74 },
  { id: '5', title: 'Newsletter mayo: novedades iGEO + tendencias sanidad ambiental',             channel: 'newsletter', date: '3 may',  views: 1750, likes: 124, comments: 8,  score: 71 },
  { id: '6', title: 'Cómo digitalizar una empresa de control de plagas sin parar operativa',      channel: 'linkedin',   date: '1 may',  views: 1620, likes: 98,  comments: 12, score: 68 },
  { id: '7', title: 'Carrusel: 5 señales de que tu ERP es el cuello de botella',                  channel: 'instagram',  date: '28 abr', views: 1340, likes: 142, comments: 7,  score: 64 },
  { id: '8', title: 'Caso de éxito: Anticimex reduce tiempo de gestión documental 38%',           channel: 'blog',       date: '24 abr', views: 1180, likes: 89,  comments: 9,  score: 58 },
]
