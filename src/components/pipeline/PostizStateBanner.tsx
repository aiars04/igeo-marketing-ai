'use client'

import { useState } from 'react'
import { AlertCircle, XCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { usePostizCancel } from '@/hooks/use-postiz'
import { useCanPublish } from '@/hooks/use-current-user'
import type { ContentItem } from '@/types/database'

interface Props {
  item: ContentItem
  onCancelled?: (unlinkedItemId: string | null) => void
}

/**
 * Banner contextual que muestra el estado real de la publicación según
 * publish_state (sincronizado por el cron desde Postiz) y, si aplica,
 * un botón para cancelar la publicación en Postiz.
 */
export function PostizStateBanner({ item, onCancelled }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { cancel, cancelling } = usePostizCancel()
  const canCancelPublish = useCanPublish()

  const handleCancel = async () => {
    if (!item.postiz_id) return
    setError(null)
    const res = await cancel(item.postiz_id)
    if (res.ok) {
      onCancelled?.(res.unlinkedItemId ?? item.id)
      setConfirmCancel(false)
    } else {
      setError(res.error ?? 'No se pudo cancelar.')
    }
  }

  // Decidir el contenido del banner según el estado real
  const publishState = item.publish_state
  const { title, subtitle, Icon, color } = (() => {
    if (publishState === 'failed') {
      return {
        title:    'Falló al publicar',
        subtitle: item.publish_error ?? 'La red social rechazó la publicación.',
        Icon:     XCircle,
        color:    'red' as const,
      }
    }
    if (publishState === 'published' || item.published_at) {
      return {
        title:    'Publicación ya enviada a la red social',
        subtitle: item.postiz_id
          ? 'El post está en la red social. Cancélalo desde aquí o edita en Postiz.'
          : 'Marcado como publicado.',
        Icon:     CheckCircle2,
        color:    'green' as const,
      }
    }
    if (publishState === 'queued' || item.postiz_id) {
      return {
        title:    'Publicación programada en Postiz',
        subtitle: 'Se publicará automáticamente en la fecha indicada. Cancélala si necesitas reeditar.',
        Icon:     Clock,
        color:    'amber' as const,
      }
    }
    return {
      title:    'Item en fase de programación',
      subtitle: 'Puedes editar título, contenido y fecha; se guarda en iGEO.',
      Icon:     AlertCircle,
      color:    'amber' as const,
    }
  })()

  const palette = {
    amber: { bg: 'var(--amber-soft)', bd: 'var(--amber-border)', fg: 'var(--amber-2)' },
    green: { bg: 'var(--green-soft)', bd: 'var(--green-border)', fg: 'var(--green-2)' },
    red:   { bg: 'rgba(239,68,68,0.10)', bd: 'rgba(239,68,68,0.30)', fg: '#b91c1c' },
  }[color]

  // Gate visual: solo admin/manager pueden cancelar. El backend ya rechaza
  // con 403, pero ocultar el botón evita confundir al usuario "user".
  const canCancel = !!item.postiz_id && publishState !== 'failed' && canCancelPublish

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        background: palette.bg,
        border: `1px solid ${palette.bd}`,
        borderRadius: 'var(--radius-md)',
        marginBottom: 20,
      }}
    >
      <Icon size={16} style={{ color: palette.fg, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: palette.fg, margin: 0, lineHeight: 1.3 }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 0', lineHeight: 1.5 }}>
          {subtitle}
        </p>
        {error && (
          <p style={{ fontSize: 12, color: '#b91c1c', margin: '6px 0 0' }}>
            {error}
          </p>
        )}
      </div>
      {canCancel && (
        confirmCancel ? (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                height: 28, padding: '0 10px', fontSize: 11, fontWeight: 600,
                color: '#fff', background: '#dc2626',
                border: 'none', borderRadius: 'var(--radius-pill)',
                cursor: cancelling ? 'wait' : 'pointer',
              }}
            >
              {cancelling
                ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                : 'Sí, cancelar'}
            </button>
            <button
              onClick={() => setConfirmCancel(false)}
              disabled={cancelling}
              style={{
                height: 28, padding: '0 10px', fontSize: 11, fontWeight: 500,
                color: 'var(--ink)', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmCancel(true)}
            title="Cancelar la publicación en Postiz"
            style={{
              height: 28, padding: '0 10px', fontSize: 11, fontWeight: 600,
              color: palette.fg, background: 'transparent',
              border: `1px solid ${palette.bd}`, borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            Cancelar publicación
          </button>
        )
      )}
    </div>
  )
}
