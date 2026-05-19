import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'

const CHANNEL_STYLES: Record<Channel, { label: string; className: string }> = {
  linkedin:   { label: 'LinkedIn',   className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  instagram:  { label: 'Instagram',  className: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  facebook:   { label: 'Facebook',   className: 'bg-blue-600/15 text-blue-300 border-blue-600/20' },
  x:          { label: 'X / Twitter',className: 'bg-slate-500/15 text-slate-300 border-slate-500/20' },
  blog:       { label: 'Blog',       className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  email:      { label: 'Email',      className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  newsletter: { label: 'Newsletter', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
}

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const style = CHANNEL_STYLES[channel]
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border',
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  )
}
