'use client'

import { cn } from '@/lib/utils'
import type { Channel } from '@/types/database'
import { useChannelColors, CHANNEL_LABEL, paletteEntry, DEFAULT_CHANNEL_SLUG } from '@/lib/channel-colors'

interface ChannelBadgeProps {
  channel: Channel
  className?: string
}

/**
 * Badge del canal con color personalizable por el usuario.
 * El color se resuelve vía useChannelColors() — usa el override del usuario si
 * existe, o el slug por defecto. Durante el primer render (antes de leer
 * localStorage) usamos defaults para evitar mismatch de hidratación.
 */
export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const ch = (channel || '').toLowerCase() as Channel
  const { overrides } = useChannelColors()
  const slug = overrides[ch] ?? DEFAULT_CHANNEL_SLUG[ch] ?? 'gray'
  const colors = paletteEntry(slug)
  const label = CHANNEL_LABEL[ch] ?? 'Otro'

  return (
    <span
      className={cn('inline-flex items-center shrink-0', className)}
      style={{
        height: 22,
        padding: '0 8px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0,
        color: colors.text,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-sm)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        textTransform: 'none',
      }}
    >
      {label}
    </span>
  )
}
