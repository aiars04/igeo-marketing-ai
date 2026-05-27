import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

const CHANNEL_STYLES: Record<Channel, { label: string; color: string; bg: string; border: string }> = {
  linkedin:   { label: 'LinkedIn',   color: '#7eb3ff', bg: 'rgba(56, 132, 248, 0.12)',  border: 'rgba(56, 132, 248, 0.32)' },
  instagram:  { label: 'Instagram',  color: '#f9a8d4', bg: 'rgba(236, 72, 153, 0.12)',  border: 'rgba(236, 72, 153, 0.32)' },
  facebook:   { label: 'Facebook',   color: '#93c5fd', bg: 'rgba(37, 99, 235, 0.12)',   border: 'rgba(37, 99, 235, 0.32)' },
  x:          { label: 'X',          color: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.32)' },
  blog:       { label: 'Blog',       color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.12)',  border: 'rgba(16, 185, 129, 0.32)' },
  email:      { label: 'Email',      color: '#fcd34d', bg: 'rgba(245, 158, 11, 0.12)',  border: 'rgba(245, 158, 11, 0.32)' },
  newsletter: { label: 'Newsletter', color: '#c4b5fd', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.32)' },
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
        'inline-flex items-center text-[11.5px] font-semibold px-2.5 py-1 rounded-md border',
        className
      )}
      style={{
        background: s.bg,
        color: s.color,
        borderColor: s.border,
      }}
    >
      {s.label}
    </span>
  )
}
