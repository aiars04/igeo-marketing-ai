import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Paleta light mode Apple
const CHANNEL_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  linkedin:   { text: '#0071e3', border: 'rgba(0, 113, 227, 0.20)',  bg: 'rgba(0, 113, 227, 0.07)'  },
  instagram:  { text: '#e8388c', border: 'rgba(232, 56, 140, 0.20)', bg: 'rgba(232, 56, 140, 0.07)' },
  facebook:   { text: '#0071e3', border: 'rgba(0, 113, 227, 0.20)',  bg: 'rgba(0, 113, 227, 0.07)'  },
  x:          { text: '#6e6e73', border: 'rgba(0, 0, 0, 0.10)',      bg: 'rgba(0, 0, 0, 0.04)'      },
  blog:       { text: '#b25000', border: 'rgba(255, 159, 10, 0.25)', bg: 'rgba(255, 159, 10, 0.08)' },
  email:      { text: '#b25000', border: 'rgba(255, 159, 10, 0.25)', bg: 'rgba(255, 159, 10, 0.08)' },
  newsletter: { text: '#248a3d', border: 'rgba(52, 199, 89, 0.25)',  bg: 'rgba(52, 199, 89, 0.08)'  },
  default:    { text: '#6e6e73', border: 'rgba(0, 0, 0, 0.10)',      bg: 'rgba(0, 0, 0, 0.04)'      },
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
        fontWeight: 600,
        letterSpacing: '0.04em',
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
