'use client'

import { useState, useEffect, useMemo } from 'react'
import { Send, Loader2, AlertCircle, CheckCircle2, ImageOff, ChevronDown, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { usePostizChannels, usePostizPublish } from '@/hooks/use-postiz'
import { utcISOToMarketLocal, marketLocalToUtcISO } from '@/lib/market-timezones'
import { getSocialLimit } from '@/lib/social-limits'
import type { ContentItem } from '@/types/database'

/**
 * Mapea códigos de error técnicos del backend a mensajes legibles.
 * Si llega un código no mapeado se devuelve tal cual — siempre mejor
 * mostrar algo que esconder el error.
 */
const ERROR_MESSAGES: Record<string, string> = {
  channelIds_required:              'Selecciona al menos un canal antes de publicar.',
  content_required:                 'Añade contenido al post antes de publicar.',
  invalid_image_url:                'La imagen adjunta no es válida (debe estar en Supabase Storage).',
  scheduledAt_required_for_schedule:'Para programar necesitas indicar fecha y hora.',
  content_item_not_found:           'El item ha sido eliminado o ya no existe.',
  postiz_upstream_failed:           'Postiz no respondió. Revisa /settings o reintenta en unos minutos.',
  unauthorized:                     'Tu sesión ha expirado. Refresca la página.',
  forbidden:                        'No tienes permiso para publicar (rol admin/manager requerido).',
  bad_json:                         'Petición mal formada. Recarga la página y vuelve a intentarlo.',
}
function humanizeError(code: string | undefined): string {
  if (!code) return 'Error desconocido al publicar.'
  return ERROR_MESSAGES[code] ?? `Error: ${code}`
}

export interface PostizPublishUpdate {
  postiz_id?: string | null
  published_at?: string | null
  scheduled_at?: string | null
}

interface Props {
  item: ContentItem
  /** URL principal (legacy). Si se proporciona y `imageUrls` no incluye otras, se usa esta. */
  imageUrl: string | null
  /** Lista completa de URLs si el item tiene varias imágenes (carrusel). */
  imageUrls?: string[]
  onPublished?: (update: PostizPublishUpdate) => void
}

type PublishType = 'draft' | 'schedule' | 'now'

/**
 * Botón "Publicar en Postiz" que aparece en el footer del modal de detalle.
 * Solo visible si el item NO está ya publicado / programado en Postiz.
 */
export function PostizPublishButton({ item, imageUrl, imageUrls, onPublished }: Props) {
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
        imageUrls={imageUrls}
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
  imageUrls?: string[]
  onClose: () => void
  onPublished?: (update: PostizPublishUpdate) => void
}

function PublishModal({ open, item, imageUrl, imageUrls, onClose, onPublished }: ModalProps) {
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
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Personalizar contenido por canal — toggle + diccionario id → texto
  const [customizeByChannel, setCustomizeByChannel] = useState(false)
  const [channelContents, setChannelContents] = useState<Record<string, string>>({})

  // Lista completa de URLs (legacy + nuevo)
  const allImageUrls = useMemo(() => {
    const list = [...(imageUrls ?? []), ...(imageUrl ? [imageUrl] : [])]
    // dedupe preservando orden
    return Array.from(new Set(list)).slice(0, 10)
  }, [imageUrl, imageUrls])

  // Reset al (re)abrir el modal: evita arrastrar selección/fecha de aperturas previas.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setType(item.scheduled_at ? 'schedule' : 'now')
    setSelected(new Set())
    setScheduledLocal(initialLocal)
    setSubmitError(null)
    setCustomizeByChannel(false)
    setChannelContents({})
  }, [open, item.id, item.scheduled_at, initialLocal])

  // Si la lista de canales cambia y un seleccionado desaparece, lo quitamos.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(prev => {
      if (prev.size === 0) return prev
      const ids = new Set(channels.map(c => c.id))
      const filtered = new Set([...prev].filter(id => ids.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
  }, [channels])

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
    setSubmitError(null)
    let scheduledIso: string | undefined
    if (type === 'schedule' && scheduledLocal) {
      const utc = marketLocalToUtcISO(scheduledLocal, item.market)
      if (!utc) {
        setSubmitError('La fecha introducida no es válida. Revísala y reintenta.')
        return
      }
      scheduledIso = utc
    }
    const cleanChannelContents = customizeByChannel
      ? Object.fromEntries(
          Array.from(selected)
            .map(id => [id, channelContents[id]?.trim() ?? ''] as const)
            .filter(([, v]) => v.length > 0)
        )
      : undefined
    const res = await publish({
      channelIds: Array.from(selected),
      content: item.content ?? '',
      imageUrls: allImageUrls.length > 0 ? allImageUrls : undefined,
      channelContents: cleanChannelContents,
      contentItemId: item.id,
      type,
      scheduledAt: scheduledIso,
    })
    if (res.ok) {
      // Update parcial: solo incluimos los campos que realmente cambiaron.
      // Antes pisábamos scheduled_at a null cuando type='now', destruyendo
      // la fecha original del item.
      const update: { postiz_id?: string | null; published_at?: string | null; scheduled_at?: string | null } = {}
      if (res.postizId != null)    update.postiz_id    = res.postizId
      if (res.publishedAt != null) update.published_at = res.publishedAt
      if (type === 'schedule' && scheduledIso) update.scheduled_at = scheduledIso
      onPublished?.(update)
      // Cierre con un pequeño delay para que el usuario vea el OK
      setTimeout(onClose, 900)
    }
  }

  const ctaLabel =
    type === 'draft'    ? 'Guardar borrador en Postiz'
  : type === 'schedule' ? 'Programar en Postiz'
                         : 'Publicar ahora'

  const enabledChannels = channels.filter(c => !c.disabled)

  // Instagram (y TikTok) no admiten publicaciones solo-texto: exigen media.
  // Si hay un canal de ese tipo seleccionado y no hay imagen, avisamos.
  const mediaRequiredChannels = enabledChannels.filter(
    c => selected.has(c.id) && /^(instagram|tiktok|youtube|pinterest)/i.test(c.identifier),
  )
  const missingMediaWarning = mediaRequiredChannels.length > 0 && allImageUrls.length === 0

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
        {allImageUrls.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
            Se adjuntará{allImageUrls.length === 1
              ? 'á 1 imagen'
              : `n ${allImageUrls.length} imágenes (carrusel)`}.
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

      {/* Contadores por red + personalizar contenido por canal */}
      {selected.size > 0 && (
        <Section title="Contenido por red">
          <ChannelContentPanel
            selectedChannels={enabledChannels.filter(c => selected.has(c.id))}
            commonContent={item.content ?? ''}
            customize={customizeByChannel}
            onToggleCustomize={() => setCustomizeByChannel(v => !v)}
            channelContents={channelContents}
            onChangeChannelContent={(id, v) => setChannelContents(prev => ({ ...prev, [id]: v }))}
          />
        </Section>
      )}

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

      {/* Aviso: redes que exigen imagen seleccionadas sin imagen */}
      {missingMediaWarning && (
        <Banner kind="info">
          {mediaRequiredChannels.map(c => c.name).join(', ')} requiere{mediaRequiredChannels.length > 1 ? 'n' : ''} una
          imagen — estas redes no permiten publicaciones de solo texto. Asigna una imagen al item o
          el post fallará en esa red.
        </Banner>
      )}

      {/* Resultado */}
      {submitError && (
        <Banner kind="error">{submitError}</Banner>
      )}
      {result?.error && (
        <Banner kind="error">
          {humanizeError(result.error)}
          {result.detail && (
            <span style={{ display: 'block', marginTop: 6, fontSize: 11, opacity: 0.85, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {result.detail}
            </span>
          )}
        </Banner>
      )}
      {result?.ok && (
        <Banner kind="success">
          Enviado a Postiz correctamente.
          {imageUrl && result.imageUploaded === false && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
              <ImageOff size={11} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
              Atención: la imagen no se pudo adjuntar al post.
            </span>
          )}
        </Banner>
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

// ─── Panel de contenido por canal con contadores ─────────────────────────────

interface ChannelLike {
  id: string
  name: string
  identifier: string
}

function ChannelContentPanel({
  selectedChannels,
  commonContent,
  customize,
  onToggleCustomize,
  channelContents,
  onChangeChannelContent,
}: {
  selectedChannels: ChannelLike[]
  commonContent: string
  customize: boolean
  onToggleCustomize: () => void
  channelContents: Record<string, string>
  onChangeChannelContent: (id: string, value: string) => void
}) {
  // Contadores: para cada canal, calcular largo del contenido efectivo.
  // Si está activo el toggle y el canal tiene custom, se usa eso; si no,
  // se usa commonContent.
  return (
    <div>
      <button
        type="button"
        onClick={onToggleCustomize}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', padding: 0,
          fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer',
          marginBottom: 8,
        }}
        aria-expanded={customize}
      >
        {customize ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        <span style={{ fontWeight: 600 }}>Personalizar contenido por canal</span>
        {!customize && <span style={{ color: 'var(--ink-3)' }}>(usar el mismo contenido en todos)</span>}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selectedChannels.map(c => {
          const lim = getSocialLimit(c.identifier)
          const effectiveContent = customize
            ? (channelContents[c.id] ?? '').length > 0
              ? (channelContents[c.id] ?? '')
              : commonContent
            : commonContent
          const len = effectiveContent.length
          const over = len > lim.max
          const counterColor = over ? '#b91c1c' : len > lim.max * 0.9 ? 'var(--amber-2)' : 'var(--ink-3)'

          return (
            <div
              key={c.id}
              style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: `1px solid ${over ? 'rgba(239,68,68,0.30)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: customize ? 6 : 0, gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
                <span style={{ fontSize: 11, color: counterColor, fontVariantNumeric: 'tabular-nums' }}>
                  {len} / {lim.max}{over ? ' · excede límite' : ''}
                </span>
              </div>
              {customize && (
                <textarea
                  value={channelContents[c.id] ?? ''}
                  placeholder={`Contenido para ${c.name} (vacío → usa el común)`}
                  onChange={e => onChangeChannelContent(c.id, e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    color: 'var(--ink)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    resize: 'vertical',
                    minHeight: 60,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
