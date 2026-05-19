import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Channel, Stage, Market } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STAGE_CONFIG: Record<Stage, { label: string; color: string; bg: string; border: string }> = {
  ideas:     { label: 'Ideas',      color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  copy:      { label: 'Copy',       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  design:    { label: 'Diseño',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  scheduled: { label: 'Programado', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  published: { label: 'Publicado',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  analyzed:  { label: 'Análisis',   color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
}

export const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; icon: string }> = {
  linkedin:   { label: 'LinkedIn',   color: 'text-blue-400',    icon: '💼' },
  instagram:  { label: 'Instagram',  color: 'text-pink-400',    icon: '📸' },
  facebook:   { label: 'Facebook',   color: 'text-blue-500',    icon: '📘' },
  x:          { label: 'X',          color: 'text-slate-300',   icon: '𝕏' },
  blog:       { label: 'Blog',       color: 'text-emerald-400', icon: '✍️' },
  email:      { label: 'Email',      color: 'text-amber-400',   icon: '📧' },
  newsletter: { label: 'Newsletter', color: 'text-violet-400',  icon: '📰' },
}

export const MARKET_CONFIG: Record<Market, { label: string; flag: string }> = {
  spain:    { label: 'España',   flag: '🇪🇸' },
  latam:    { label: 'LATAM',    flag: '🌎' },
  uk:       { label: 'UK',       flag: '🇬🇧' },
  france:   { label: 'Francia',  flag: '🇫🇷' },
  italy:    { label: 'Italia',   flag: '🇮🇹' },
  portugal: { label: 'Portugal', flag: '🇵🇹' },
  brasil:   { label: 'Brasil',   flag: '🇧🇷' },
}

export const STAGES: Stage[] = ['ideas', 'copy', 'design', 'scheduled', 'published', 'analyzed']
