'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Download, ChevronDown, Mail, Newspaper, FileText, Type,
  Loader2, ClipboardCheck, ExternalLink, Copy as CopyIcon,
} from 'lucide-react'
import {
  exportClientifyHTML,
  exportWordPressHTML,
  exportMarkdown,
  exportPlainText,
  type ExportContext,
} from '@/lib/content-export'

type ExportFormat = 'clientify' | 'wordpress' | 'markdown' | 'plain'

const FORMATS: {
  id: ExportFormat
  label: string
  description: string
  icon: React.ElementType
  color: string
}[] = [
  { id: 'clientify', label: 'Clientify',     description: 'HTML con estilos inline · email-safe',          icon: Mail,      color: '#ea580c' },
  { id: 'wordpress', label: 'WordPress',     description: 'HTML semántico · respeta el tema del sitio',   icon: Newspaper, color: '#2563eb' },
  { id: 'markdown',  label: 'Markdown',      description: 'Para Notion, Linear, Obsidian, etc.',          icon: FileText,  color: '#7c3aed' },
  { id: 'plain',     label: 'Texto plano',   description: 'Sin marcas · para WhatsApp / Slack',           icon: Type,      color: '#64748b' },
]

interface Props {
  content:     string                // markdown del item
  ctx?:        ExportContext         // título, imagen, canal, autor
  onToast?:    (msg: string, kind?: 'success' | 'error' | 'info') => void
}

/**
 * Botón "Exportar" con dropdown de 4 formatos:
 *   - Clientify (HTML inline)
 *   - WordPress (HTML semántico)
 *   - Markdown raw
 *   - Texto plano
 *
 * Al elegir un formato, copia el resultado al portapapeles.
 * También muestra una opción "Ver preview" que abre un panel con el output.
 */
export function ExportContentMenu({ content, ctx, onToast }: Props) {
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState<ExportFormat | null>(null)
  const [copiedFormat, setCopiedFormat] = useState<ExportFormat | null>(null)
  const [previewFormat, setPreviewFormat] = useState<ExportFormat | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Cierra el menú al clickar fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const convert = (format: ExportFormat): string => {
    switch (format) {
      case 'clientify': return exportClientifyHTML(content, ctx)
      case 'wordpress': return exportWordPressHTML(content, ctx)
      case 'markdown':  return exportMarkdown(content, ctx)
      case 'plain':     return exportPlainText(content, ctx)
    }
  }

  const handleCopy = async (format: ExportFormat) => {
    setCopying(format)
    try {
      const output = convert(format)
      await navigator.clipboard.writeText(output)
      setCopiedFormat(format)
      onToast?.(`Copiado en formato ${FORMATS.find(f => f.id === format)?.label}`, 'success')
      setTimeout(() => setCopiedFormat(null), 2200)
      setOpen(false)
    } catch (err) {
      onToast?.(`Error: ${err instanceof Error ? err.message : 'no_se_pudo'}`, 'error')
    } finally {
      setCopying(null)
    }
  }

  return (
    <>
      <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="btn-pill-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={12} aria-hidden="true" />
          Exportar
          <ChevronDown size={10} aria-hidden="true" style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }} />
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: 280,
              maxWidth: 320,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
              padding: 6,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {FORMATS.map(f => {
              const Icon = f.icon
              const isCopying = copying === f.id
              const isCopied  = copiedFormat === f.id
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 2,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleCopy(f.id)}
                    disabled={isCopying}
                    style={{
                      flex: 1,
                      padding: '9px 10px',
                      background: 'transparent',
                      border: 'none',
                      cursor: isCopying ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{
                      width: 30, height: 30, flexShrink: 0,
                      background: `${f.color}15`, color: f.color,
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isCopying
                        ? <Loader2 size={14} className="animate-spin" />
                        : isCopied
                          ? <ClipboardCheck size={14} aria-hidden="true" />
                          : <Icon size={14} aria-hidden="true" />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        {f.label}
                        {isCopied && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green-2)' }}>Copiado</span>}
                      </p>
                      <p style={{
                        margin: 0, fontSize: 10.5, color: 'var(--ink-3)',
                        lineHeight: 1.35, marginTop: 1,
                      }}>
                        {f.description}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreviewFormat(f.id); setOpen(false) }}
                    aria-label={`Previsualizar ${f.label}`}
                    title="Previsualizar"
                    style={{
                      width: 36,
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--ink-3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {previewFormat && (
        <PreviewModal
          format={previewFormat}
          output={convert(previewFormat)}
          onClose={() => setPreviewFormat(null)}
          onCopy={() => handleCopy(previewFormat)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal de preview del output (sin pegarlo aún, para revisarlo).
// ─────────────────────────────────────────────────────────────────────────
function PreviewModal({
  format, output, onClose, onCopy,
}: {
  format: ExportFormat
  output: string
  onClose: () => void
  onCopy: () => void
}) {
  const meta = FORMATS.find(f => f.id === format)!
  const Icon = meta.icon
  const showRendered = format === 'clientify' || format === 'wordpress'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 880, maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.20)',
        }}
      >
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <span style={{
            width: 36, height: 36, flexShrink: 0,
            background: `${meta.color}15`, color: meta.color,
            borderRadius: 'var(--radius-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} aria-hidden="true" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
              Preview · {meta.label}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ink-3)' }}>
              {meta.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="btn-cta"
            style={{ flexShrink: 0 }}
          >
            <CopyIcon size={13} aria-hidden="true" /> Copiar
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {showRendered && (
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6,
              }}>
                Render visual aproximado
              </p>
              <div
                style={{
                  padding: 18,
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: 320, overflowY: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: output }}
              />
            </div>
          )}
          <div>
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6,
            }}>
              Código fuente que se copiará
            </p>
            <pre style={{
              margin: 0,
              padding: 14,
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 'var(--radius-md)',
              fontSize: 11.5,
              lineHeight: 1.55,
              fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 380,
            }}>
              {output}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
