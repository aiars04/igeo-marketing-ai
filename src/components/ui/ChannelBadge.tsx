import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

// Colores específicos por canal (specs del producto)
const CHANNEL_STYLES: Record<Channel, { label: string; color: string }> = {
  linkedin:   { label: 'LinkedIn',   color: '#0A66C2' },  // Azul LinkedIn oficial
  instagram:  { label: 'Instagram',  color: '#C13584' },  // Púrpura-rosa Instagram
  facebook:   { label: 'Facebook',   color: '#1877F2' },  // Azul Facebook
  x:          { label: 'X',          color: '#71767B' },  // Gris X/Twitter
  blog:       { label: 'Blog',       color: '#E65100' },  // Naranja blog
  email:      { label: 'Email',      color: '#FFA000' },  // Ámbar email
  newsletter: { label: 'Newsletter', color: '#2E7D32' },  // Verde newsletter
}

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const s = CHANNEL_STYLES[channel]
  return (
    <span
      className={cn(
        'inline-flex items-center uppercase tracking-wide',
        className
      )}
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 4,
        color: '#ffffff',
        background: s.color,
        letterSpacing: '0.04em',
      }}
    >
      {s.label}
    </span>
  )
}
