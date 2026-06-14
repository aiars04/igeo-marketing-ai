import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Channel, Stage, Market } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STAGE_CONFIG: Record<Stage, {
  label:      string
  subtitle:   string
  color:      string
  bg:         string
  border:     string
  dotColor:   string
  accentHex:  string
  automatic?: boolean
}> = {
  ideas:     { label: 'Ideas',              subtitle: 'Genera y filtra propuestas',   color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', dotColor: 'bg-violet-400', accentHex: '#a78bfa' },
  copy:      { label: 'Copy & Revisión',    subtitle: 'Redacta y revisa el texto',    color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dotColor: 'bg-blue-400',   accentHex: '#60a5fa' },
  design:    { label: 'Diseño',             subtitle: 'Crea los visuales',            color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   dotColor: 'bg-cyan-400',   accentHex: '#22d3ee' },
  approval:  { label: 'Aprobación',         subtitle: 'Validación final antes de programar', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dotColor: 'bg-emerald-400', accentHex: '#10b981' },
  scheduled: { label: 'Programación',       subtitle: 'Automático via PostiZ',        color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dotColor: 'bg-amber-400',  accentHex: '#fbbf24', automatic: true },
  analyzed:  { label: 'Análisis IA',        subtitle: 'Rendimiento a 7 días',         color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   dotColor: 'bg-rose-400',   accentHex: '#fb7185' },
}

export const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; icon: string }> = {
  linkedin:   { label: 'LinkedIn',   color: 'text-blue-400',    icon: 'linkedin' },
  instagram:  { label: 'Instagram',  color: 'text-pink-400',    icon: 'instagram' },
  facebook:   { label: 'Facebook',   color: 'text-blue-300',    icon: 'facebook' },
  x:          { label: 'X',          color: 'text-slate-300',   icon: 'x' },
  blog:       { label: 'Blog',       color: 'text-emerald-400', icon: 'blog' },
  email:      { label: 'Email',      color: 'text-amber-400',   icon: 'email' },
  newsletter: { label: 'Newsletter', color: 'text-violet-400',  icon: 'newsletter' },
}

export const MARKET_CONFIG: Record<Market, { label: string; flag: string; abbr?: string }> = {
  spain:    { label: 'España',        flag: '🇪🇸' },
  latam:    { label: 'LATAM',         flag: '',   abbr: 'LTM' },
  // El slug interno sigue siendo `uk` por compatibilidad con datos existentes,
  // pero conceptualmente el usuario lo trata como "mercado internacional".
  uk:       { label: 'Internacional', flag: '🌐', abbr: 'INT' },
  france:   { label: 'Francia',       flag: '🇫🇷' },
  italy:    { label: 'Italia',        flag: '🇮🇹' },
  portugal: { label: 'Portugal',      flag: '🇵🇹' },
  brasil:   { label: 'Brasil',        flag: '🇧🇷' },
  mexico:   { label: 'México',        flag: '🇲🇽' },
}

// Orden canónico para listados/filtros. Importa desde aquí para garantizar que
// añadir un mercado nuevo solo requiere tocar Market type + MARKET_CONFIG + esto.
export const ALL_MARKETS: Market[] = [
  'spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico',
]

export const STAGES: Stage[] = ['ideas', 'copy', 'design', 'approval', 'scheduled', 'analyzed']
