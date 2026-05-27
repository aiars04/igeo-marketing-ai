import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

const CHANNEL_STYLES: Record<Channel, { label: string; color: string; bg: string; border: string }> = {
  linkedin:   { label: 'LinkedIn',   color: '#7eb3ff', bg: 'rgba(56, 132, 248, 0.10)',  border: 'rgba(56, 132, 248, 0.30)' },
  instagram:  { label: 'Instagram',  color: '#f9a8d4', bg: 'rgba(236, 72, 153, 0.10)',  border: 'rgba(236, 72, 153, 0.30)' },
  facebook:   { label: 'Facebook',   color: '#93c5fd', bg: 'rgba(37, 99, 235, 0.10)',   border: 'rgba(37, 99, 235, 0.30)' },
  x:          { label: 'X',          color: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.30)' },
  blog:       { label: 'Blog',       color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.10)',  border: 'rgba(16, 185, 129, 0.30)' },
  email:      { label: 'Email',      color: '#fcd34d', bg: 'rgba(245, 158, 11, 0.10)',  border: 'rgba(245, 158, 11, 0.30)' },
  newsletter: { label: 'Newsletter', color: '#c4b5fd', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.30)' },
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
        'inline-flex items-center gap-1.5 font-mono text-[9.5px] font-medium px-1.5 py-0.5 rounded-sm border uppercase tracking-[0.08em]',
        className
      )}
      style={{
        background: s.bg,
        color: s.color,
        borderColor: s.border,
      }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
      {s.label}
    </span>
  )
}
