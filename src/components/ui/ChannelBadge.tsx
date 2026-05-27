import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Outline only — border 40% + texto 80%
const CHANNEL_COLORS: Record<Channel, { label: string; rgb: string }> = {
  linkedin:   { label: 'LinkedIn',   rgb: '59, 130, 246' },   // #3b82f6
  instagram:  { label: 'Instagram',  rgb: '236, 72, 153' },   // #ec4899
  facebook:   { label: 'Facebook',   rgb: '24, 119, 242' },
  x:          { label: 'X',          rgb: '156, 163, 175' },
  blog:       { label: 'Blog',       rgb: '245, 158, 11' },   // #f59e0b
  email:      { label: 'Email',      rgb: '251, 191, 36' },
  newsletter: { label: 'Newsletter', rgb: '16, 185, 129' },   // #10b981
}

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const s = CHANNEL_COLORS[channel]
  return (
    <span
      className={cn('inline-flex items-center shrink-0', className)}
      style={{
        height: 20,
        padding: '0 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: `rgba(${s.rgb}, 0.85)`,
        background: 'transparent',
        border: `1px solid rgba(${s.rgb}, 0.40)`,
        borderRadius: 5,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}
