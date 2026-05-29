import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Paleta apagada (no neón) — minimalismo frío con glassmorphism
const CHANNEL_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  linkedin:   { text: '#93c5fd', border: 'rgba(96, 165, 250, 0.25)',  bg: 'rgba(96, 165, 250, 0.08)'  },
  instagram:  { text: '#f9a8d4', border: 'rgba(244, 114, 182, 0.25)', bg: 'rgba(244, 114, 182, 0.08)' },
  facebook:   { text: '#93c5fd', border: 'rgba(96, 165, 250, 0.25)',  bg: 'rgba(96, 165, 250, 0.08)'  },
  x:          { text: '#9090a8', border: 'rgba(144, 144, 168, 0.20)', bg: 'rgba(144, 144, 168, 0.06)' },
  blog:       { text: '#fde68a', border: 'rgba(251, 191, 36, 0.25)',  bg: 'rgba(251, 191, 36, 0.08)'  },
  email:      { text: '#fde68a', border: 'rgba(251, 191, 36, 0.25)',  bg: 'rgba(251, 191, 36, 0.08)'  },
  newsletter: { text: '#6ee7b7', border: 'rgba(52, 211, 153, 0.25)',  bg: 'rgba(52, 211, 153, 0.08)'  },
  default:    { text: '#9090a8', border: 'rgba(144, 144, 168, 0.20)', bg: 'rgba(144, 144, 168, 0.06)' },
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
        padding: '1px 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: colors.text,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {channel?.toUpperCase()}
    </span>
  )
}
