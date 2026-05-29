import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Color por canal (refinada para dark canvas)
const CHANNEL_STYLES: Record<Channel, { label: string; color: string }> = {
  linkedin:   { label: 'LinkedIn',   color: '#60a5fa' },  // azul claro
  instagram:  { label: 'Instagram',  color: '#f472b6' },  // rosa
  facebook:   { label: 'Facebook',   color: '#60a5fa' },
  x:          { label: 'X',          color: '#9090a8' },
  blog:       { label: 'Blog',       color: '#fbbf24' },  // amber
  email:      { label: 'Email',      color: '#fbbf24' },
  newsletter: { label: 'Newsletter', color: '#34d399' },  // verde
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
        padding: '1px 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: s.color,
        background: `${s.color}12`,
        border: `1px solid ${s.color}40`,
        borderRadius: 4,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}
