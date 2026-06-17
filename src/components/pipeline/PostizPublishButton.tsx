'use client'

import { useState, useMemo } from 'react'
import { Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { usePostizChannels, usePostizPublish } from '@/hooks/use-postiz'
import { utcISOToMarketLocal, marketLocalToUtcISO } from '@/lib/market-timezones'
import type { ContentItem } from '@/types/database'

export interface PostizPublishUpdate {
  postiz_id?: string | null
  published_at?: string | null
  scheduled_at?: string | null
}

interface Props {
  item: ContentItem
  imageUrl: string | null
  onPublished?: (update: PostizPublishUpdate) => void
}

type PublishType = 'draft' | 'schedule' | 'now'

/**
 * Botón "Publicar en Postiz" que aparece en el footer del modal de detalle.
 * Solo visible si el item NO está ya publicado / programado en Postiz.
 */
export function PostizPublishButton({ item, imageUrl, onPublished }: Props) {
  const [open, setOpen] = useState(false)
  const alreadySent = !!item.published_at || !!item.postiz_id
  if (alreadySent) return null
  const hasContent = !!item.content?.trim()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!hasContent}
        className="inline-flex items-center transition-colors"
        title={hasContent ? 'Publicar en Postiz' : 'Añade contenido antes de publicar'}
        style={{
          gap: 6,
          height: 36,
          padding: '0 14px',
          fontSize: 13,
          fontWeight: 600,
          color: hasContent ? 'var(--ink)' : 'var(--ink-3)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-pill)',
          cursor: hasContent ? 'pointer' : 'not-allowed',
          opacity: hasContent ? 1 : 0.6,
        }}
      >
        <Send size={13} aria-hidden="true" /> Publicar en Postiz
      </button>
      <PublishModal
        open={open}
        item={item}
        imageUrl={imageUrl}
        onClose={() => setOpen(false)}
        onPublished={onPublished}
      />
    </>
  )
}

interface ModalProps {
  open: boolean
  item: ContentItem
  imageUrl: string | null
  onClose: () => void
  onPublished?: (update: PostizPublishUpdate) => void
}

function PublishModal({ open, item, imageUrl, onClose, onPublished }: ModalProps) {
  const { channels, loading: chLoading, error: chError } = usePostizChannels()
  const { publish, publishing, result } = usePostizPublish()

  // Pre-selección: si scheduled_at viene del item, default 'schedule'; si no, 'now'.
  const [type, setType] = useState<PublishType>(item.scheduled_at ? 'schedule' : 'now')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // datetime-local en zona horaria del mercado (lo mismo que usa el resto del pipeline)
  const initialLocal = useMemo(
    () => (item.scheduled_at ? utcISOToMarketLocal(item.scheduled_at, item.market) : ''),
    [item.scheduled_at, item.market],
  )
  const [scheduledLocal, setScheduledLocal] = useState(initialLocal)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const canSubmit =
    !publishing
    && selected.size > 0
    && !!item.content?.trim()
    && (type !== 'schedule' || !!scheduledLocal)

  const submit = async () => {
    if (!canSubmit) return
    let scheduledIso: string | undefined
    if (type === 'schedule' && scheduledLocal) {
      const utc = marketLocalToUtcISO(scheduledLocal, item.market)
      if (!utc) return  // fecha mal formada — no enviar
      scheduledIso = utc
    }
    const res = await publish({
      channelIds: Array.from(selected),
      content: item.content ?? '',
      imageUrl: imageUrl ?? undefined,
      contentItemId: item.id,
      type,
      scheduledAt: scheduledIso,
    })
    if (res.ok) {
      onPublished?.({
        postiz_id:    res.postizId ?? null,
        published_at: res.publishedAt ?? null,
        scheduled_at: scheduledIso ?? null,
      })
      // Cierre con un pequeño delay para que el usuario vea el OK
      setTimeout(onClose, 900)
    }
  }

  const ctaLabel =
    type === 'draft'    ? 'Guardar borrador en Postiz'
  : type === 'schedule' ? 'Programar en Postiz'
                         : 'Publicar ahora'

  const enabledChannels = channels.filter(c => !c.disabled)

  return (
    <Modal open={open} onClose={onClose} title="Publicar en Postiz" size="md">
      {/* Aviso si no hay contenido */}
      {!item.content?.trim() && (
        <Banner kind="error">
          El item no tiene contenido. Añádelo antes de publicar.
        </Banner>
      )}

      {/* Vista previa minimal */}
      <Section title="Contenido a publicar">
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--ink-2)',
            whiteSpace: 'pre-wrap',
            maxHeight: 120,
            overflowY: 'auto',
            lineHeight: 1.4,
          }}
        >
          {item.content?.trim() || <span style={{ color: 'var(--ink-3)' }}>— sin contenido —</span>}
        </div>
        {imageUrl && (
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            Se adjuntará la imagen asignada a este item.
          </p>
        )}
      </Section>

      {/* Canales */}
      <Section title="Canales">
        {chLoading ? (
          <Inline><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Cargando canales…</Inline>
        ) : chError ? (
          <Banner kind="error">No se pudo cargar la lista de canales: {chError}</Banner>
        ) : enabledChannels.length === 0 ? (
          <Banner kind="info">
            No hay redes conectadas en Postiz. Conéctalas desde el dashboard de Postiz Web.
          </Banner>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enabledChannels.map(c => {
              const checked = selected.has(c.id)
              return (
                <label
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: checked ? 'var(--accent-soft)' : 'var(--surface)',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    style={{ margin: 0 }}
                  />
                  {c.picture
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.picture} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
                    : <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-2)' }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {c.identifier}
                      {c.profile ? ` · ${c.profile}` : ''}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </Section>

      {/* Tipo */}
      <Section title="Tipo de publicación">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['now', 'schedule', 'draft'] as PublishType[]).map(t => {
            const active = type === t
            const label = t === 'now' ? 'Publicar ahora' : t === 'schedule' ? 'Programar' : 'Borrador'
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  height: 32,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-pill)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? 'var(--accent-2)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {type === 'schedule' && (
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>
              Fecha y hora (zona horaria del mercado {item.market})
            </label>
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={e => setScheduledLocal(e.target.value)}
              style={{
                width: '100%',
                height: 36,
                padding: '0 10px',
                fontSize: 13,
                color: 'var(--ink)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>
        )}
      </Section>

      {/* Resultado */}
      {result?.error && (
        <Banner kind="error">Error al publicar: {result.error}</Banner>
      )}
      {result?.ok && (
        <Banner kind="success">Enviado a Postiz correctamente.</Banner>
      )}

      {/* Footer */}
      <div
        className="flex items-center"
        style={{
          gap: 10,
          paddingTop: 16,
          marginTop: 8,
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            height: 36, padding: '0 14px', fontSize: 13, fontWeight: 500,
            color: 'var(--ink)', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-cta"
          style={!canSubmit ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
        >
          {publishing
            ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Publicando…</>
            : <><Send size={13} aria-hidden="true" /> {ctaLabel}</>}
        </button>
      </div>
    </Modal>
  )
}

// ─── Helpers visuales ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Banner({ kind, children }: { kind: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const palette = {
    info:    { bg: 'var(--amber-soft)', fg: 'var(--amber-2)', bd: 'var(--amber-border)', Icon: AlertCircle },
    error:   { bg: 'rgba(239,68,68,0.10)', fg: '#b91c1c', bd: 'rgba(239,68,68,0.30)', Icon: AlertCircle },
    success: { bg: 'var(--green-soft)', fg: 'var(--green-2)', bd: 'var(--green-border)', Icon: CheckCircle2 },
  }[kind]
  const Icon = palette.Icon
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 12px', marginBottom: 14,
        background: palette.bg, border: `1px solid ${palette.bd}`,
        borderRadius: 'var(--radius-md)',
        fontSize: 12.5, color: palette.fg, lineHeight: 1.4,
      }}
    >
      <Icon size={14} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontSize: 13 }}>
      {children}
    </div>
  )
}
