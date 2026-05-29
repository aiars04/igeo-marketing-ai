import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Paleta light mode Apple — labels con capitalización normal (sin uppercase)
const CHANNEL_COLORS: Record<string, { label: string; text: string; border: string; bg: string }> = {
  linkedin:   { label: 'LinkedIn',   text: '#0071e3', border: 'rgba(0, 113, 227, 0.20)',  bg: 'rgba(0, 113, 227, 0.07)'  },
  instagram:  { label: 'Instagram',  text: '#e8388c', border: 'rgba(232, 56, 140, 0.20)', bg: 'rgba(232, 56, 140, 0.07)' },
  facebook:   { label: 'Facebook',   text: '#0071e3', border: 'rgba(0, 113, 227, 0.20)',  bg: 'rgba(0, 113, 227, 0.07)'  },
  x:          { label: 'X',          text: '#6e6e73', border: 'rgba(0, 0, 0, 0.10)',      bg: 'rgba(0, 0, 0, 0.04)'      },
  blog:       { label: 'Blog',       text: '#b25000', border: 'rgba(255, 159, 10, 0.25)', bg: 'rgba(255, 159, 10, 0.08)' },
  email:      { label: 'Email',      text: '#b25000', border: 'rgba(255, 159, 10, 0.25)', bg: 'rgba(255, 159, 10, 0.08)' },
  newsletter: { label: 'Newsletter', text: '#248a3d', border: 'rgba(52, 199, 89, 0.25)',  bg: 'rgba(52, 199, 89, 0.08)'  },
  default:    { label: 'Otro',       text: '#6e6e73', border: 'rgba(0, 0, 0, 0.10)',      bg: 'rgba(0, 0, 0, 0.04)'      },
}

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const ch = (channel || '').toLowerCase()
  const colors = CHANNEL_COLORS[ch] ?? CHANNEL_COLORS.default
  return (
    <span
      className={cn('inline-flex items-center shrink-0', className)}
      style={{
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0,
        color: colors.text,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        textTransform: 'none',
      }}
    >
      {colors.label}
    </span>
  )
}
