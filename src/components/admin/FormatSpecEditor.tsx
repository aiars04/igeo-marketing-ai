'use client'

import { FileText, Mic, Image as ImageIcon, Layers, Plus, Trash2 } from 'lucide-react'
import type { ContentTypeFormatSpec } from '@/types/database'

interface Props {
  spec: ContentTypeFormatSpec
  onChange: (next: ContentTypeFormatSpec) => void
}

/**
 * Editor estructurado de format_spec para un content_type.
 *
 * Permite definir qué assets necesita un formato:
 *   - Copy y guión (booleanos)
 *   - Lista de imágenes con etiqueta y dimensiones sugeridas
 *   - Carrusel opcional con min/max slides y dimensión común
 *
 * Las dimensiones son SUGERIDAS — no se valida obligatoriedad. Se inyectan
 * en el prompt de Gemini al generar copy y se muestran como checklist en
 * el ImageDrivePanel del pipeline.
 */
export function FormatSpecEditor({ spec, onChange }: Props) {
  const images = spec.images ?? []
  const carousel = spec.carousel ?? null
  const carouselEnabled = !!carousel

  const updateBool = (k: 'needs_copy' | 'needs_script', v: boolean) => {
    onChange({ ...spec, [k]: v })
  }

  const addImage = () => {
    const next = [...images, { label: '', width: null, height: null, required: true, notes: null }]
    onChange({ ...spec, images: next })
  }
  const updateImage = (idx: number, patch: Partial<NonNullable<ContentTypeFormatSpec['images']>[number]>) => {
    const next = images.map((img, i) => i === idx ? { ...img, ...patch } : img)
    onChange({ ...spec, images: next })
  }
  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    onChange({ ...spec, images: next.length > 0 ? next : undefined })
  }

  const toggleCarousel = (enable: boolean) => {
    if (!enable) {
      onChange({ ...spec, carousel: null })
    } else {
      onChange({ ...spec, carousel: { min: 2, max: 5, width: null, height: null } })
    }
  }
  const updateCarousel = (patch: Partial<NonNullable<ContentTypeFormatSpec['carousel']>>) => {
    if (!carousel) return
    onChange({ ...spec, carousel: { ...carousel, ...patch } })
  }

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <p style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--ink-3)', marginBottom: 4,
        }}>
          Assets que necesita este formato
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
          La IA se basará en esta estructura al generar el copy y la app te
          marcará qué piezas faltan en cada item del pipeline. Las dimensiones
          son sugeridas, no obligatorias.
        </p>
      </div>

      {/* Copy / guión */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <Toggle
          icon={<FileText size={14} aria-hidden="true" />}
          label="Necesita copy"
          checked={!!spec.needs_copy}
          onChange={v => updateBool('needs_copy', v)}
        />
        <Toggle
          icon={<Mic size={14} aria-hidden="true" />}
          label="Necesita guión"
          checked={!!spec.needs_script}
          onChange={v => updateBool('needs_script', v)}
        />
      </div>

      {/* Imágenes */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ImageIcon size={13} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              Imágenes individuales {images.length > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>({images.length})</span>}
            </span>
          </div>
          <button
            type="button"
            onClick={addImage}
            className="btn-pill-secondary"
            style={{ fontSize: 11, height: 26 }}
          >
            <Plus size={11} aria-hidden="true" /> Añadir imagen
          </button>
        </div>

        {images.length === 0 ? (
          <p style={{
            fontSize: 11.5, color: 'var(--ink-3)', fontStyle: 'italic',
            padding: '10px 12px', background: 'var(--surface)',
            border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
          }}>
            Sin imágenes definidas. Pulsa &quot;Añadir imagen&quot; para crear una entrada (ej. Banner 1920×1080).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {images.map((img, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 90px auto auto',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  className="input"
                  value={img.label}
                  onChange={e => updateImage(idx, { label: e.target.value })}
                  placeholder="Etiqueta (ej. Banner)"
                  style={{ height: 30, fontSize: 12 }}
                />
                <input
                  type="number"
                  className="input"
                  value={img.width ?? ''}
                  onChange={e => updateImage(idx, { width: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Ancho"
                  min={0}
                  style={{ height: 30, fontSize: 12 }}
                />
                <input
                  type="number"
                  className="input"
                  value={img.height ?? ''}
                  onChange={e => updateImage(idx, { height: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Alto"
                  min={0}
                  style={{ height: 30, fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={() => updateImage(idx, { required: !img.required })}
                  title={img.required ? 'Marcada como obligatoria' : 'Marcada como opcional'}
                  style={{
                    height: 30, padding: '0 8px', fontSize: 10, fontWeight: 700,
                    background: img.required ? 'var(--green-soft)' : 'var(--surface-2)',
                    color: img.required ? 'var(--green-2)' : 'var(--ink-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}
                >
                  {img.required ? 'Obligatoria' : 'Opcional'}
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label="Eliminar imagen"
                  style={{
                    width: 30, height: 30,
                    background: 'var(--surface)', color: 'var(--ink-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carrusel */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 10,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: carouselEnabled ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={13} aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              Carrusel
            </span>
          </div>
          <Toggle
            label={carouselEnabled ? 'Activo' : 'Inactivo'}
            checked={carouselEnabled}
            onChange={toggleCarousel}
            compact
          />
        </div>
        {carouselEnabled && carousel && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6,
          }}>
            <NumberField
              label="Mín slides"
              value={carousel.min}
              onChange={v => {
                const n = v ?? 2
                updateCarousel({ min: Math.max(2, n), max: Math.max(n, carousel.max) })
              }}
              min={2}
            />
            <NumberField
              label="Máx slides"
              value={carousel.max}
              onChange={v => {
                const n = v ?? carousel.min
                updateCarousel({ max: Math.max(carousel.min, n) })
              }}
              min={carousel.min}
            />
            <NumberField
              label="Ancho"
              value={carousel.width ?? null}
              onChange={v => updateCarousel({ width: v })}
            />
            <NumberField
              label="Alto"
              value={carousel.height ?? null}
              onChange={v => updateCarousel({ height: v })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

function Toggle({
  icon, label, checked, onChange, compact,
}: {
  icon?: React.ReactNode
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  compact?: boolean
}) {
  return (
    <label
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: compact ? '4px 10px' : '8px 12px',
        background: checked ? 'var(--accent-soft)' : 'var(--surface)',
        border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: compact ? 11 : 12.5,
        fontWeight: 600,
        color: checked ? 'var(--accent-2)' : 'var(--ink-2)',
        userSelect: 'none',
        transition: 'all 0.12s',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ margin: 0 }}
      />
      {icon}
      {label}
    </label>
  )
}

function NumberField({
  label, value, onChange, min,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min?: number
}) {
  return (
    <div>
      <p style={{
        fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
      }}>
        {label}
      </p>
      <input
        type="number"
        className="input"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        min={min}
        style={{ height: 28, fontSize: 12 }}
      />
    </div>
  )
}
