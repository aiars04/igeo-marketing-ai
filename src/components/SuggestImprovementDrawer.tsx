'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Send, CheckCircle2, Bug, Wrench, Sparkles,
  AlertTriangle, Zap, Upload, Trash2, Loader2, Image as ImageIcon,
  ChevronsRight, ChevronsLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ImprovementType, ImprovementPriority } from '@/types/database'

const TYPE_OPTIONS: { id: ImprovementType; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  { id: 'bug',    label: 'Bug',        desc: 'Algo no funciona',          icon: Bug,      color: '#dc2626' },
  { id: 'mejora', label: 'Mejora',     desc: 'Algo se puede mejorar',     icon: Wrench,   color: '#2563eb' },
  { id: 'idea',   label: 'Idea nueva', desc: 'Funcionalidad nueva',       icon: Sparkles, color: '#7c3aed' },
]

const PRIORITY_OPTIONS: { id: ImprovementPriority; label: string; icon: React.ElementType | null; color: string }[] = [
  { id: 'baja',  label: 'Puede esperar', icon: null,           color: '#64748b' },
  { id: 'media', label: 'Cuanto antes',  icon: Zap,            color: '#f59e0b' },
  { id: 'alta',  label: 'Es urgente',    icon: AlertTriangle,  color: '#dc2626' },
]

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
const MAX_SIZE = 50 * 1024 * 1024  // 50 MB

interface Props {
  open: boolean
  onClose: () => void
  userId: string | null
}

export function SuggestImprovementDrawer({ open, onClose, userId }: Props) {
  const [type, setType] = useState<ImprovementType>('mejora')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<ImprovementPriority>('media')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropZoneRef = useRef<HTMLDivElement | null>(null)

  // Reset al cerrar — incluye 'minimized' para que la próxima vez abra expandido
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setType('mejora')
      setTitle('')
      setPriority('media')
      setDescription('')
      setFile(null)
      setFilePreview(null)
      setFileError(null)
      setSentOk(false)
      setGeneralError(null)
      setMinimized(false)
    }, 250)
    return () => clearTimeout(t)
  }, [open])

  // Limpieza automática del objectURL del preview cuando cambia o se desmonta
  useEffect(() => {
    if (!filePreview) return
    return () => { URL.revokeObjectURL(filePreview) }
  }, [filePreview])

  // Tecla ESC: expandido → minimizar (no pierde form); minimizado → cerrar
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || sending) return
      if (minimized) onClose()
      else setMinimized(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, sending, minimized, onClose])

  const acceptFile = (f: File) => {
    setFileError(null)
    if (!ACCEPTED_MIME.includes(f.type)) {
      setFileError(`Tipo no permitido: ${f.type || 'desconocido'}. Usa PNG/JPG/WEBP/GIF o MP4/WEBM.`)
      return
    }
    if (f.size > MAX_SIZE) {
      setFileError(`Demasiado grande (${Math.round(f.size / 1024 / 1024)}MB). Máximo 50MB.`)
      return
    }
    setFile(f)
    setFilePreview(URL.createObjectURL(f))
    // El useEffect de cleanup libera el URL viejo automáticamente al cambiar
  }

  // Pegar imagen desde portapapeles
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) {
            e.preventDefault()
            acceptFile(f)
            return
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  const handlePickFile = () => fileInputRef.current?.click()
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) acceptFile(f)
    e.target.value = ''
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.currentTarget === dropZoneRef.current) setDragOver(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) acceptFile(f)
  }

  const removeFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview)
    setFile(null)
    setFilePreview(null)
    setFileError(null)
  }

  const canSubmit = title.trim().length > 0 && !!file && !sending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !file) return
    setSending(true)
    setGeneralError(null)
    try {
      // 1) Subir adjunto al bucket
      const supabase = createClient()
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${userId ?? 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('improvements')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })
      if (upErr) {
        setGeneralError(`Error subiendo el adjunto: ${upErr.message}`)
        return
      }

      // 2) Crear improvement con el PATH interno del bucket privado
      //    (el backend generará signed URLs cuando admin/manager lo vean)
      const res = await fetch('/api/improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          attachment_path: path,
          type,
          priority,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGeneralError(`Error: ${j.error ?? 'no_se_pudo'}`)
        // Cleanup del archivo huérfano
        try { await supabase.storage.from('improvements').remove([path]) } catch {}
        return
      }

      setSentOk(true)
      setTimeout(() => onClose(), 1800)
    } catch (err) {
      setGeneralError(`Error de red: ${err instanceof Error ? err.message : 'desconocido'}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Tab MINIMIZADA — pegada a la derecha cuando minimized=true */}
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Expandir formulario de sugerencia"
        title="Continuar con la sugerencia"
        style={{
          position: 'fixed',
          top: '50%',
          right: 0,
          transform: open && minimized ? 'translate(0, -50%)' : 'translate(100%, -50%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          width: 44,
          padding: '14px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRight: 'none',
          borderRadius: '10px 0 0 10px',
          boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.10)',
          cursor: 'pointer',
          zIndex: 80,
          color: '#0f172a',
        }}
      >
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          color: '#b45309',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={14} aria-hidden="true" />
        </span>
        <ChevronsLeft size={16} aria-hidden="true" style={{ color: '#64748b' }} />
        {/* Etiqueta de draft activo si hay contenido */}
        {(title.trim() || description.trim() || file) && (
          <span style={{
            width: 8, height: 8, borderRadius: 999,
            background: '#f59e0b',
            boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.20)',
          }} aria-hidden="true" />
        )}
      </button>

      {/* Drawer desde la derecha — SIN overlay difuminado, fondo de la app visible */}
      <aside
        aria-label="Sugerir mejora"
        // inert deshabilita interacción + accesibilidad cuando está cerrado.
        // Antes usábamos aria-hidden, pero si un input dentro tenía foco al
        // cerrar el drawer, el navegador advertía: "Blocked aria-hidden on
        // an element because its descendant retained focus" (regla WAI-ARIA).
        // `inert` no tiene ese problema porque también previene el foco.
        // En React 19+ es `boolean`; en versiones anteriores el DOM acepta
        // el atributo igualmente. Hacemos cast porque el typing depende de
        // la versión de @types/react.
        {...((!open || minimized) ? { inert: true } as unknown as { inert?: boolean } : {})}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(560px, 100vw)',
          background: '#ffffff',
          boxShadow: '-12px 0 48px rgba(15, 23, 42, 0.18)',
          transform: open && !minimized ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          zIndex: 80,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          borderRight: 'none',
        }}
      >
        {sentOk ? (
          <SuccessView />
        ) : (
          <>
            {/* Header */}
            <header
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #eef2f6',
                background: 'linear-gradient(180deg, #fafbfd 0%, #ffffff 100%)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  color: '#b45309',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={20} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: '0 0 2px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f59e0b',
                }}>
                  Tu opinión cuenta
                </p>
                <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  Sugiere una mejora
                </h2>
                <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                  Describe el cambio y adjunta una captura — la enviamos directo a desarrollo.
                </p>
              </div>
              <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => !sending && setMinimized(true)}
                  aria-label="Minimizar (mantiene el formulario)"
                  title="Minimizar (mantiene el formulario)"
                  disabled={sending}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <ChevronsRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => !sending && onClose()}
                  aria-label="Cerrar"
                  disabled={sending}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
                    cursor: sending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Form scrollable */}
            <form
              onSubmit={handleSubmit}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {/* Tipo */}
              <Field label="¿Qué quieres reportar?">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {TYPE_OPTIONS.map(opt => {
                    const active = type === opt.id
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setType(opt.id)}
                        style={{
                          border: `1.5px solid ${active ? opt.color : '#e2e8f0'}`,
                          background: active ? `${opt.color}10` : '#fff',
                          borderRadius: 12,
                          padding: '12px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{
                          width: 36, height: 36, borderRadius: 10,
                          color: opt.color, background: `${opt.color}15`,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{opt.label}</span>
                        <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3 }}>{opt.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </Field>

              {/* Título */}
              <Field label="Título" required>
                <input
                  type="text"
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={
                    type === 'bug'  ? 'Ej: La columna de Ideas no hace scroll' :
                    type === 'idea' ? 'Ej: Añadir filtro por mercado en pipeline' :
                                      'Ej: Avatar más grande en las cards'
                  }
                  maxLength={200}
                  autoFocus
                />
                <CharCount value={title.length} max={200} />
              </Field>

              {/* Prioridad */}
              <Field label="Prioridad">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRIORITY_OPTIONS.map(opt => {
                    const active = priority === opt.id
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPriority(opt.id)}
                        style={{
                          border: `1.5px solid ${active ? opt.color : '#e2e8f0'}`,
                          background: active ? `${opt.color}15` : '#fff',
                          color: active ? opt.color : '#475569',
                          borderRadius: 999, padding: '7px 14px',
                          fontSize: 12, fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {Icon && <Icon size={13} aria-hidden="true" />}
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </Field>

              {/* Descripción */}
              <Field label="Cuéntanos más" optional>
                <textarea
                  className="input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'Pasos para reproducirlo, qué esperabas que pasara y qué pasó realmente.'
                      : 'Describe el cambio con detalle: dónde está, cómo lo imaginas, por qué te ayudaría.'
                  }
                  rows={5}
                  maxLength={2000}
                  style={{ resize: 'vertical', minHeight: 110 }}
                />
                <CharCount value={description.length} max={2000} />
              </Field>

              {/* Adjunto OBLIGATORIO */}
              <Field label="Captura o vídeo" required>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
                {!file ? (
                  <div
                    ref={dropZoneRef}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={handlePickFile}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handlePickFile() }}
                    style={{
                      border: `2px dashed ${dragOver ? '#f59e0b' : '#cbd5e1'}`,
                      background: dragOver ? '#fef3c7' : '#fafbfd',
                      borderRadius: 12,
                      padding: '24px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Upload size={28} aria-hidden="true" style={{ color: dragOver ? '#b45309' : '#94a3b8', marginBottom: 8 }} />
                    <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>
                      Arrastra una captura aquí o haz click
                    </p>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#64748b' }}>
                      También puedes pegarla con <kbd style={kbdStyle}>Ctrl</kbd> + <kbd style={kbdStyle}>V</kbd>
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      PNG · JPG · WEBP · GIF · MP4 · WEBM — hasta 50MB
                    </p>
                  </div>
                ) : (
                  <FilePreview file={file} preview={filePreview} onRemove={removeFile} />
                )}
                {fileError && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>
                    {fileError}
                  </p>
                )}
              </Field>

              {generalError && (
                <div style={{
                  padding: '10px 12px',
                  background: '#fef2f2',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  borderRadius: 8,
                  fontSize: 12.5, color: '#991b1b',
                }}>
                  {generalError}
                </div>
              )}

              <div style={{ flex: 1 }} />

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  paddingTop: 14,
                  borderTop: '1px solid #eef2f6',
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => !sending && onClose()}
                  disabled={sending}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-cta"
                  style={{ opacity: canSubmit ? 1 : 0.55, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                >
                  {sending
                    ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Enviando…</>
                    : <><Send size={13} aria-hidden="true" /> Enviar sugerencia</>}
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────

function SuccessView() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: 40,
    }}>
      <div style={{
        width: 84, height: 84, borderRadius: '50%',
        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        color: '#059669',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <CheckCircle2 size={42} aria-hidden="true" />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, color: '#0f172a' }}>¡Gracias!</h2>
      <p style={{ margin: 0, color: '#64748b', fontSize: 14, maxWidth: 320, lineHeight: 1.5 }}>
        Tu sugerencia se ha enviado. La revisaremos pronto y la implementaremos.
      </p>
    </div>
  )
}

function FilePreview({ file, preview, onRemove }: { file: File; preview: string | null; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  return (
    <div style={{
      border: '1.5px solid #e2e8f0',
      borderRadius: 12,
      overflow: 'hidden',
      background: '#fafbfd',
    }}>
      <div style={{
        width: '100%',
        maxHeight: 280,
        background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isImage && preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={file.name} style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
        )}
        {isVideo && preview && (
          <video src={preview} controls style={{ maxWidth: '100%', maxHeight: 280 }} />
        )}
        {!isImage && !isVideo && (
          <ImageIcon size={32} aria-hidden="true" style={{ color: '#94a3b8' }} />
        )}
      </div>
      <div style={{
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12.5, fontWeight: 600, color: '#0f172a',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {file.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
            {Math.round(file.size / 1024)} KB
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar adjunto"
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#fef2f2', color: '#dc2626',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, optional, children }: {
  label: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <label style={{
        fontSize: 11, fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
        {optional && <span style={{ color: '#94a3b8', marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>}
      </label>
      {children}
    </div>
  )
}

function CharCount({ value, max }: { value: number; max: number }) {
  return (
    <span style={{
      alignSelf: 'flex-end',
      fontSize: 10.5, color: value > max * 0.9 ? '#f59e0b' : '#94a3b8',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value} / {max}
    </span>
  )
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 5px',
  fontSize: 10,
  background: '#fff',
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  fontFamily: 'monospace',
  color: '#475569',
}
