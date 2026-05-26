import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

const CHANNEL_STYLES: Record<Channel, { label: string; bg: string; color: string; border: string; dot: string }> = {
  linkedin:   { label: 'LinkedIn',   bg: 'rgba(56, 132, 248, 0.10)',  color: '#7eb3ff', border: 'rgba(56, 132, 248, 0.28)',  dot: '#3b82f6' },
  instagram:  { label: 'Instagram',  bg: 'rgba(236, 72, 153, 0.10)',  color: '#f9a8d4', border: 'rgba(236, 72, 153, 0.28)',  dot: '#ec4899' },
  facebook:   { label: 'Facebook',   bg: 'rgba(37, 99, 235, 0.10)',   color: '#93c5fd', border: 'rgba(37, 99, 235, 0.28)',   dot: '#2563eb' },
  x:          { label: 'X',          bg: 'rgba(148, 163, 184, 0.10)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.28)', dot: '#94a3b8' },
  blog:       { label: 'Blog',       bg: 'rgba(52, 211, 153, 0.10)',  color: '#6ee7b7', border: 'rgba(52, 211, 153, 0.28)',  dot: '#34d399' },
  email:      { label: 'Email',      bg: 'rgba(251, 191, 36, 0.10)',  color: '#fcd34d', border: 'rgba(251, 191, 36, 0.28)',  dot: '#fbbf24' },
  newsletter: { label: 'Newsletter', bg: 'rgba(167, 139, 250, 0.10)', color: '#c4b5fd', border: 'rgba(167, 139, 250, 0.28)', dot: '#a78bfa' },
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
        'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full border',
        className
      )}
      style={{
        background: s.bg,
        color: s.color,
        borderColor: s.border,
      }}
    >
      <span
        className="w-1 h-1 rounded-full shrink-0"
        style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }}
      />
      {s.label}
    </span>
  )
}
