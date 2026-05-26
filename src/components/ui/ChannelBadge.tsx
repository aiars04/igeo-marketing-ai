import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

const CHANNEL_STYLES: Record<Channel, { label: string; bg: string; color: string; border: string }> = {
  linkedin:   { label: 'LinkedIn',   bg: 'rgba(56, 132, 248, 0.10)',  color: '#7eb3ff', border: 'rgba(56, 132, 248, 0.25)' },
  instagram:  { label: 'Instagram',  bg: 'rgba(236, 72, 153, 0.10)',  color: '#f9a8d4', border: 'rgba(236, 72, 153, 0.25)' },
  facebook:   { label: 'Facebook',   bg: 'rgba(37, 99, 235, 0.10)',   color: '#93c5fd', border: 'rgba(37, 99, 235, 0.25)' },
  x:          { label: 'X',          bg: 'rgba(148, 163, 184, 0.10)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.25)' },
  blog:       { label: 'Blog',       bg: 'rgba(52, 211, 153, 0.10)',  color: '#6ee7b7', border: 'rgba(52, 211, 153, 0.25)' },
  email:      { label: 'Email',      bg: 'rgba(251, 191, 36, 0.10)',  color: '#fcd34d', border: 'rgba(251, 191, 36, 0.25)' },
  newsletter: { label: 'Newsletter', bg: 'rgba(167, 139, 250, 0.10)', color: '#c4b5fd', border: 'rgba(167, 139, 250, 0.25)' },
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
        'inline-flex items-center text-[10.5px] font-semibold px-2 py-1 rounded border',
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
