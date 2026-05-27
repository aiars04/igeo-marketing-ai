import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Colores oficiales por canal
const CHANNEL_STYLES: Record<Channel, { label: string; color: string }> = {
  linkedin:   { label: 'LinkedIn',   color: '#0A66C2' },
  instagram:  { label: 'Instagram',  color: '#C13584' },
  facebook:   { label: 'Facebook',   color: '#1877F2' },
  x:          { label: 'X',          color: '#71767B' },
  blog:       { label: 'Blog',       color: '#E65100' },
  email:      { label: 'Email',      color: '#FFA000' },
  newsletter: { label: 'Newsletter', color: '#2E7D32' },
}

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const s = CHANNEL_STYLES[channel]
  return (
    <span
      className={cn('inline-flex items-center uppercase shrink-0', className)}
      style={{
        height: 22,
        padding: '0 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: '#ffffff',
        background: s.color,
        borderRadius: 4,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}
