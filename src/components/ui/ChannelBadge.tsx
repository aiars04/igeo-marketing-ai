import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Paleta apagada: fondo --*-soft, texto del color principal
const CHANNEL_STYLES: Record<Channel, { label: string; bg: string; color: string; border: string }> = {
  linkedin:   { label: 'LinkedIn',   bg: 'rgba(10, 102, 194, 0.14)',   color: '#7eb3ff', border: 'rgba(10, 102, 194, 0.30)' },
  instagram:  { label: 'Instagram',  bg: 'rgba(193, 53, 132, 0.14)',   color: '#f9a8d4', border: 'rgba(193, 53, 132, 0.30)' },
  facebook:   { label: 'Facebook',   bg: 'rgba(24, 119, 242, 0.14)',   color: '#93c5fd', border: 'rgba(24, 119, 242, 0.30)' },
  x:          { label: 'X',          bg: 'rgba(113, 118, 123, 0.18)',  color: '#cbd5e1', border: 'rgba(113, 118, 123, 0.35)' },
  blog:       { label: 'Blog',       bg: 'rgba(230, 81, 0, 0.14)',     color: '#fdba74', border: 'rgba(230, 81, 0, 0.30)' },
  email:      { label: 'Email',      bg: 'rgba(255, 160, 0, 0.14)',    color: '#fcd34d', border: 'rgba(255, 160, 0, 0.30)' },
  newsletter: { label: 'Newsletter', bg: 'rgba(46, 125, 50, 0.16)',    color: '#86efac', border: 'rgba(46, 125, 50, 0.30)' },
}

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const s = CHANNEL_STYLES[channel]
  return (
    <span
      className={cn('inline-flex items-center shrink-0', className)}
      style={{
        height: 22,
        padding: '0 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 5,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}
