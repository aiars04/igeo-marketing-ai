'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Bot, Sparkles,
  ToggleLeft, ToggleRight, BookOpen, X,
  ChevronDown, ChevronUp, FileText, FileImage,
  Presentation, Sheet, File, Upload, Eye,
  Download, AlertCircle, Loader2, FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContentTypes, type ContentType } from '@/lib/content-types-store'
import { useToast, Toasts } from '@/components/ui/Toast'
import {
  saveDoc, getDocBlob, listDocsByType, listAllDocMeta, deleteDoc,
  formatFileSize, fileCategory, type DocMeta,
} from '@/lib/documents-store'
import type { Channel } from '@/types/database'

/* ─── Constants ─── */
const CHANNELS: Channel[] = ['linkedin','instagram','facebook','x','blog','email','newsletter']
const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin:'LinkedIn', instagram:'Instagram', facebook:'Facebook',
  x:'X (Twitter)', blog:'Blog', email:'Email', newsletter:'Newsletter',
}
const CHANNEL_COLOR: Record<Channel, { bg: string; text: string; dot: string; border: string }> = {
  linkedin:   { bg: 'rgba(59,130,246,0.12)',  text: 'var(--blue-2)',    dot: '#3b82f6', border: 'rgba(59,130,246,0.30)'  },
  instagram:  { bg: 'rgba(236,72,153,0.12)',  text: '#f472b6',          dot: '#ec4899', border: 'rgba(236,72,153,0.30)'  },
  facebook:   { bg: 'rgba(147,197,253,0.12)', text: '#93c5fd',          dot: '#93c5fd', border: 'rgba(147,197,253,0.30)' },
  x:          { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8',          dot: '#94a3b8', border: 'rgba(148,163,184,0.30)' },
  blog:       { bg: 'var(--green-soft)',      text: 'var(--green-2)',   dot: '#10b981', border: 'rgba(16,185,129,0.30)'  },
  email:      { bg: 'var(--amber-soft)',      text: 'var(--amber-2)',   dot: '#f59e0b', border: 'rgba(245,158,11,0.30)'  },
  newsletter: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa',          dot: '#a78bfa', border: 'rgba(167,139,250,0.30)' },
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png','image/jpeg','image/gif','image/webp','image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/* ─── File icon ─── */
function FileIcon({ mimeType, size = 20 }: { mimeType: string; size?: number }) {
  const cat = fileCategory(mimeType)
  const props = { size, strokeWidth: 1.8 }
  if (cat === 'pdf')   return <FileText      {...props} style={{ color: 'var(--red-2)' }} />
  if (cat === 'image') return <FileImage     {...props} style={{ color: 'var(--blue-2)' }} />
  if (cat === 'word')  return <FileText      {...props} style={{ color: 'var(--blue)' }} />
  if (cat === 'ppt')   return <Presentation  {...props} style={{ color: 'var(--orange-2)' }} />
  if (cat === 'excel') return <Sheet         {...props} style={{ color: 'var(--green-2)' }} />
  return <File {...props} style={{ color: 'var(--ink-2)' }} />
}

/* ─── Documents Modal ─── */
function DocumentsModal({
  ct,
  onClose,
}: {
  ct: ContentType
  onClose: () => void
}) {
  const [docs, setDocs]           = useState<DocMeta[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [preview, setPreview]     = useState<{ doc: DocMeta; url: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef      = useRef<HTMLDivElement>(null)

  // Load docs
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setDocs(await listDocsByType(ct.id)) }
    catch { setDocs([]) }
    finally { setLoading(false) }
  }, [ct.id])

  useEffect(() => { refresh() }, [refresh])

  // Cleanup preview object URLs
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview.url) }
  }, [preview])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    const toUpload = Array.from(files)

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`"${file.name}" supera el límite de 50 MB`)
        continue
      }
      setUploading(true)
      try {
        const blob = new Blob([await file.arrayBuffer()], { type: file.type })
        const meta = await saveDoc(
          { contentTypeId: ct.id, name: file.name, mimeType: file.type, size: file.size },
          blob,
        )
        setDocs(p => [...p, meta])
      } catch {
        setUploadError(`Error al subir "${file.name}"`)
      } finally {
        setUploading(false)
      }
    }
  }

  const handlePreview = async (doc: DocMeta) => {
    if (preview) URL.revokeObjectURL(preview.url)
    const blob = await getDocBlob(doc.id)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const cat = fileCategory(doc.mimeType)
    if (cat === 'pdf' || cat === 'image') {
      setPreview({ doc, url })
    } else {
      // For non-previewable: trigger download
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(id)
    setDocs(p => p.filter(d => d.id !== id))
    setDeleteConfirm(null)
  }

  const colors = CHANNEL_COLOR[ct.channel]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />

        <div
          className="relative w-full flex flex-col overflow-hidden"
          style={{
            maxWidth: 720,
            maxHeight: 'calc(100vh - 48px)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between shrink-0" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
              >
                <FolderOpen size={17} style={{ color: colors.text }} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  Documentos de referencia
                </h2>
                <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>
                  <span style={{ color: colors.text }}>{ct.name}</span>
                  {' · '}manuales, plantillas y ejemplos visuales
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md flex items-center justify-center"
              style={{ width: 32, height: 32, color: 'var(--ink-2)', background: 'transparent', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Upload zone */}
            <div
              ref={dropRef}
              className="relative cursor-pointer"
              style={{
                border: `2px dashed ${dragging ? colors.dot : 'var(--border-hover)'}`,
                background: dragging ? colors.bg : 'var(--surface-2)',
                borderRadius: 12,
                transition: 'all 0.15s ease',
              }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={e => { if (!dropRef.current?.contains(e.relatedTarget as Node)) setDragging(false) }}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
                onClick={e => { (e.target as HTMLInputElement).value = '' }}
              />
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                {uploading ? (
                  <>
                    <Loader2 size={28} className="animate-spin" style={{ color: colors.text }} />
                    <p className="text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>Subiendo…</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: colors.bg }}>
                      <Upload size={22} style={{ color: colors.text }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                        {dragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para subir'}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--ink-2)' }}>
                        PDF, Word, PowerPoint, Excel, imágenes · Máx. 50 MB por archivo
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Error */}
            {uploadError && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <AlertCircle size={14} style={{ color: 'var(--red-2)', flexShrink: 0 }} />
                <p className="text-[12px]" style={{ color: 'var(--red-2)' }}>{uploadError}</p>
                <button className="ml-auto" onClick={() => setUploadError(null)}>
                  <X size={12} style={{ color: 'var(--red-2)', opacity: 0.6 }} />
                </button>
              </div>
            )}

            {/* Document list */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-3)' }}>
                  <FileText size={26} style={{ color: 'var(--ink-3)' }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Sin documentos aún</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
                    Sube plantillas, guías de estilo o ejemplos de referencia
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="section-label">
                  {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
                </p>
                {docs.map(doc => {
                  const cat = fileCategory(doc.mimeType)
                  const canPreview = cat === 'pdf' || cat === 'image'
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', transition: 'border-color 0.15s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--surface-3)' }}>
                        <FileIcon mimeType={doc.mimeType} size={22} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium truncate leading-snug" style={{ color: 'var(--ink)' }}>{doc.name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
                          {formatFileSize(doc.size)} · {doc.uploadedAt}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handlePreview(doc)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                          style={{ color: 'var(--ink-2)', background: 'transparent', transition: 'all 0.15s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--ink)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)' }}
                          title={canPreview ? 'Vista previa' : 'Descargar'}
                        >
                          {canPreview ? <Eye size={13} /> : <Download size={13} />}
                          <span className="hidden sm:inline">{canPreview ? 'Ver' : 'Descargar'}</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(doc.id)}
                          className="p-1.5 rounded-md"
                          style={{ background: 'transparent', transition: 'background 0.15s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-soft)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          title="Eliminar"
                        >
                          <Trash2 size={13} style={{ color: 'var(--red-2)', opacity: 0.7 }} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Preview modal ─── */}
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}
          />
          <div
            className="relative flex flex-col overflow-hidden"
            style={{ width: '90vw', maxWidth: 960, height: '90vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon mimeType={preview.doc.mimeType} size={16} />
                <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{preview.doc.name}</span>
                <span className="text-[11px] shrink-0" style={{ color: 'var(--ink-2)' }}>{formatFileSize(preview.doc.size)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <a
                  href={preview.url}
                  download={preview.doc.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium"
                  style={{ color: 'var(--ink-2)', background: 'transparent', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)' }}
                >
                  <Download size={13} /> Descargar
                </a>
                <button
                  onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}
                  className="p-1.5 rounded-md"
                  style={{ background: 'transparent', color: 'var(--ink-2)', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg)' }}>
              {fileCategory(preview.doc.mimeType) === 'image' ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={preview.doc.name} className="max-w-full max-h-full object-contain rounded-lg" />
                </div>
              ) : (
                <iframe
                  src={preview.url}
                  className="w-full h-full border-0"
                  title={preview.doc.name}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirm ─── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setDeleteConfirm(null)}
          />
          <div
            className="relative w-full max-w-xs p-5 space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}
          >
            <div className="text-center space-y-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto"
                style={{ background: 'var(--red-soft)' }}
              >
                <Trash2 size={18} style={{ color: 'var(--red-2)' }} />
              </div>
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>¿Eliminar documento?</h3>
              <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                {docs.find(d => d.id === deleteConfirm)?.name}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold"
                style={{
                  background: 'var(--red)',
                  color: '#ffffff',
                  border: '1px solid var(--red)',
                  height: 36,
                  transition: 'filter 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Content Type Card ─── */
function ContentTypeCard({
  ct,
  docCount,
  onEdit,
  onToggle,
  onDelete,
  onOpenDocs,
}: {
  ct: ContentType
  docCount: number
  onEdit: (ct: ContentType) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onOpenDocs: (ct: ContentType) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const colors = CHANNEL_COLOR[ct.channel]

  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${ct.active ? 'var(--border)' : 'var(--border-soft)'}`,
        borderRadius: 12,
        opacity: ct.active ? 1 : 0.55,
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={e => { if (ct.active) e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onMouseLeave={e => { if (ct.active) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ background: colors.dot }}
        />
        <div className="flex-1 min-w-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold mb-1.5"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {CHANNEL_LABELS[ct.channel]}
          </span>
          <h3 className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
            {ct.name}
          </h3>
          <p className="text-[12px] mt-1.5 leading-relaxed line-clamp-2" style={{ color: 'var(--ink-2)' }}>
            {ct.description}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onToggle(ct.id)}
            className="p-1.5 rounded-md"
            style={{ background: 'transparent', transition: 'background 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            title={ct.active ? 'Desactivar' : 'Activar'}
          >
            {ct.active ? <ToggleRight size={16} style={{ color: 'var(--orange-2)' }} /> : <ToggleLeft size={16} style={{ color: 'var(--ink-3)' }} />}
          </button>
          <button
            onClick={() => onEdit(ct)}
            className="p-1.5 rounded-md"
            style={{ background: 'transparent', transition: 'background 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            title="Editar"
          >
            <Pencil size={13} style={{ color: 'var(--ink-2)' }} />
          </button>
          <button
            onClick={() => onDelete(ct.id)}
            className="p-1.5 rounded-md"
            style={{ background: 'transparent', transition: 'background 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-soft)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            title="Eliminar"
          >
            <Trash2 size={13} style={{ color: 'var(--red-2)', opacity: 0.7 }} />
          </button>
        </div>
      </div>

      {/* IA instructions expandable */}
      <div className="px-4 pb-2">
        <div
          className="overflow-hidden rounded-md"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <button className="w-full flex items-center justify-between px-3 py-2 text-left" onClick={() => setExpanded(p => !p)}>
            <div className="flex items-center gap-2">
              <Bot size={12} style={{ color: 'var(--ink-2)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--ink-2)' }}>
                Instrucciones para la IA
              </span>
            </div>
            {expanded ? <ChevronUp size={12} style={{ color: 'var(--ink-3)' }} /> : <ChevronDown size={12} style={{ color: 'var(--ink-3)' }} />}
          </button>
          {expanded && (
            <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="pt-2.5">
                <span className="section-label block mb-1">Proceso</span>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{ct.process}</p>
              </div>
              <div>
                <span className="section-label block mb-1">Estilo iGEO</span>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{ct.style}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer — docs button */}
      <div
        className="px-4 py-3 mt-auto flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-3)' }}>Creado {ct.createdAt}</span>
        <button
          onClick={() => onOpenDocs(ct)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
          style={{
            background: docCount > 0 ? colors.bg : 'var(--surface-3)',
            color:      docCount > 0 ? colors.text : 'var(--ink-2)',
            border:     `1px solid ${docCount > 0 ? colors.border : 'var(--border)'}`,
            transition: 'all 0.15s ease',
          }}
        >
          <FolderOpen size={11} />
          {docCount > 0 ? `${docCount} ${docCount === 1 ? 'documento' : 'documentos'}` : 'Añadir documentos'}
        </button>
      </div>
    </div>
  )
}

/* ─── Form fields ─── */
const EMPTY_FORM = { name: '', channel: 'linkedin' as Channel, description: '', process: '', style: '', active: true }

function ContentTypeModal({
  open, onClose, onSave, initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<ContentType, 'id' | 'createdAt'>) => void
  initial?: ContentType | null
}) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const isEdit = !!initial

  useEffect(() => { setForm(initial ?? EMPTY_FORM) }, [initial])

  if (!open) return null
  const set = (k: keyof typeof EMPTY_FORM, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const canSave = form.name.trim() && form.description.trim() && form.process.trim() && form.style.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, maxHeight: 'calc(100vh - 48px)', boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}
            >
              <BookOpen size={16} style={{ color: 'var(--orange-2)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                {isEdit ? 'Editar tipo de contenido' : 'Nuevo tipo de contenido'}
              </h2>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>La IA usará estas instrucciones para generar contenido</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md flex items-center justify-center"
            style={{ width: 32, height: 32, color: 'var(--ink-2)', background: 'transparent', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="section-label block mb-1.5">Nombre</label>
            <input
              className="input"
              placeholder="Ej: Post LinkedIn iGEO"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>
          <div>
            <label className="section-label block mb-1.5">Canal</label>
            <select
              className="input"
              value={form.channel}
              onChange={e => set('channel', e.target.value)}
            >
              {CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="section-label block mb-1.5">Descripción</label>
            <p className="text-[11px] mb-1.5" style={{ color: 'var(--ink-2)' }}>Qué produce este tipo de contenido y para qué sirve.</p>
            <textarea
              rows={2}
              className="input"
              placeholder="Publicación profesional en LinkedIn para posicionar iGEO como…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div
            className="p-4 space-y-3"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 12,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Bot size={14} style={{ color: 'var(--accent-2)' }} />
              <span className="section-label" style={{ color: 'var(--accent-2)' }}>
                Instrucciones para la IA
              </span>
              <Sparkles size={11} style={{ color: 'var(--accent-2)' }} />
            </div>
            <div>
              <label className="section-label block mb-1.5">Proceso de creación</label>
              <p className="text-[11px] mb-1.5" style={{ color: 'var(--ink-2)' }}>Pasos que seguirá la IA para generar el contenido.</p>
              <textarea
                rows={3}
                className="input"
                placeholder="Ej: Identifica un pain point del sector → conecta con funcionalidad iGEO → CTA al demo."
                value={form.process}
                onChange={e => set('process', e.target.value)}
              />
            </div>
            <div>
              <label className="section-label block mb-1.5">Estilo iGEO</label>
              <p className="text-[11px] mb-1.5" style={{ color: 'var(--ink-2)' }}>Tono, formato, longitud y reglas de estilo de la marca.</p>
              <textarea
                rows={3}
                className="input"
                placeholder="Ej: Tono profesional pero cercano. Emojis moderados. 150-300 palabras."
                value={form.style}
                onChange={e => set('style', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 shrink-0"
          style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}
        >
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary flex-1"
            disabled={!canSave}
            onClick={() => { onSave(form); onClose() }}
          >
            <Plus size={13} /> {isEdit ? 'Guardar cambios' : 'Crear tipo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ─── */
export default function AdminPage() {
  const { types, add, update, remove, toggle } = useContentTypes()
  const { items: toasts, show: toast, remove: removeToast } = useToast()

  const [modalOpen, setModalOpen]         = useState(false)
  const [editTarget, setEditTarget]       = useState<ContentType | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [docsTarget, setDocsTarget]       = useState<ContentType | null>(null)

  // doc counts per content type (loaded from IndexedDB on mount)
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    listAllDocMeta()
      .then(all => {
        const counts: Record<string, number> = {}
        all.forEach(d => { counts[d.contentTypeId] = (counts[d.contentTypeId] ?? 0) + 1 })
        setDocCounts(counts)
      })
      .catch(() => {})
  }, [])

  // refresh a single count after docs modal closes
  const refreshDocCount = useCallback((ctId: string) => {
    listDocsByType(ctId)
      .then(docs => setDocCounts(p => ({ ...p, [ctId]: docs.length })))
      .catch(() => {})
  }, [])

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit   = (ct: ContentType) => { setEditTarget(ct); setModalOpen(true) }

  const handleSave = (data: Omit<ContentType, 'id' | 'createdAt'>) => {
    if (editTarget) { update(editTarget.id, data); toast('Tipo actualizado', 'success') }
    else            { add(data);                   toast('Tipo creado', 'success') }
  }

  const handleDelete = (id: string) => { remove(id); setDeleteConfirm(null); toast('Tipo eliminado', 'success') }

  const activeCount   = types.filter(t => t.active).length
  const inactiveCount = types.length - activeCount

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-6 h-[60px] shrink-0 gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-5 min-w-0">
          <div className="shrink-0">
            <h1 className="page-title">
              Admin
            </h1>
            <p className="section-label mt-1">
              Tipos de contenido y documentos de referencia
            </p>
          </div>
        </div>
        <button className="btn-primary shrink-0" onClick={openCreate}><Plus size={13} /> Nuevo tipo</button>
      </div>

      {/* ─── Stats ─── */}
      <div
        className="flex gap-2 px-6 py-2.5 shrink-0 flex-wrap items-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {[
          { label: 'Total tipos', value: types.length,   color: 'var(--ink)' },
          { label: 'Activos',     value: activeCount,    color: 'var(--green-2)' },
          { label: 'Inactivos',   value: inactiveCount,  color: 'var(--ink-3)' },
          { label: 'Documentos',  value: Object.values(docCounts).reduce((a, b) => a + b, 0), color: 'var(--ink)' },
        ].map(s => (
          <div
            key={s.label}
            className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium tabular-nums"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <span
              className="font-semibold text-[12.5px]"
              style={{ color: s.color }}
            >
              {s.value}
            </span>
            <span style={{ color: 'var(--ink-2)' }}>{s.label}</span>
          </div>
        ))}
        <div
          className="ml-auto flex items-center gap-2 px-2.5 py-1 rounded-md"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <Bot size={11} style={{ color: 'var(--ink-2)' }} />
          <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
            Solo los tipos activos están disponibles en el calendario y la IA
          </span>
        </div>
      </div>

      {/* ─── Grid ─── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {types.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center animate-fade-up">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <BookOpen size={22} style={{ color: 'var(--ink-3)' }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Sin tipos de contenido</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--ink-2)' }}>Crea el primero para empezar a planificar contenido con IA</p>
            </div>
            <button className="btn-primary" onClick={openCreate}><Plus size={13} /> Crear tipo</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
            {types.map(ct => (
              <ContentTypeCard
                key={ct.id}
                ct={ct}
                docCount={docCounts[ct.id] ?? 0}
                onEdit={openEdit}
                onToggle={id => { toggle(id); toast(types.find(t=>t.id===id)?.active ? 'Tipo desactivado' : 'Tipo activado', 'success') }}
                onDelete={id => setDeleteConfirm(id)}
                onOpenDocs={ct => setDocsTarget(ct)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      <ContentTypeModal
        key={editTarget?.id ?? 'new'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editTarget}
      />

      {docsTarget && (
        <DocumentsModal
          ct={docsTarget}
          onClose={() => { refreshDocCount(docsTarget.id); setDocsTarget(null) }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setDeleteConfirm(null)}
          />
          <div
            className="relative w-full max-w-sm p-6 space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
          >
            <div className="text-center space-y-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                style={{ background: 'var(--red-soft)' }}
              >
                <Trash2 size={22} style={{ color: 'var(--red-2)' }} />
              </div>
              <h3 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>¿Eliminar tipo?</h3>
              <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                Se eliminará <strong style={{ color: 'var(--ink)' }}>{types.find(t => t.id === deleteConfirm)?.name}</strong>. Los eventos del calendario que referencien este tipo quedarán sin tipo asignado.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold"
                style={{
                  background: 'var(--red)',
                  color: '#ffffff',
                  border: '1px solid var(--red)',
                  height: 36,
                  transition: 'filter 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
