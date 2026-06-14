'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Play, Loader2,
  ToggleLeft, ToggleRight,
  BookOpen,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type {
  Playbook, PlaybookStep, PlaybookType, PlaybookTaskType,
  Channel, Market, MarketScope,
} from '@/types/database'

const PLAYBOOK_TYPES: { value: PlaybookType; label: string; icon: string }[] = [
  { value: 'webinar',          label: 'Webinar',              icon: '🎥' },
  { value: 'event_presential', label: 'Evento presencial',    icon: '📍' },
  { value: 'event_online',     label: 'Evento online',        icon: '💻' },
  { value: 'release',          label: 'Novedad de producto',  icon: '🚀' },
  { value: 'newsletter',       label: 'Newsletter',           icon: '📰' },
  { value: 'campaign',         label: 'Campaña comercial',    icon: '🎯' },
  { value: 'alliance',         label: 'Alianza',              icon: '🤝' },
  { value: 'workshop',         label: 'Workshop',             icon: '🛠️' },
  { value: 'lead_magnet',      label: 'Lead magnet',          icon: '🧲' },
  { value: 'reactivation',     label: 'Reactivación',         icon: '💌' },
  { value: 'podcast',          label: 'Podcast',              icon: '🎙️' },
]

const TASK_TYPES: { value: PlaybookTaskType; label: string }[] = [
  { value: 'post',       label: 'Post social' },
  { value: 'email',      label: 'Email' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'landing',    label: 'Landing' },
  { value: 'reminder',   label: 'Recordatorio' },
  { value: 'follow_up',  label: 'Follow-up' },
  { value: 'blog',       label: 'Blog' },
  { value: 'video',      label: 'Vídeo' },
  { value: 'banner',     label: 'Banner' },
  { value: 'pdf',        label: 'PDF' },
]

const CHANNELS: Channel[] = ['linkedin','instagram','facebook','x','blog','email','newsletter']
const MARKETS: Market[] = ['spain','latam','uk','france','italy','portugal','brasil','mexico']
const MARKET_LABEL: Record<Market, string> = {
  spain: 'España', latam: 'LATAM', uk: 'Internacional', france: 'Francia',
  italy: 'Italia', portugal: 'Portugal', brasil: 'Brasil', mexico: 'México',
}

const typeIcon = (t: PlaybookType) => PLAYBOOK_TYPES.find(x => x.value === t)?.icon ?? '📄'
const typeLabel = (t: PlaybookType) => PLAYBOOK_TYPES.find(x => x.value === t)?.label ?? t

interface PlaybookWithSteps extends Playbook {
  steps?: PlaybookStep[]
}

// ─────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────
export function PlaybooksTab({
  toast,
}: {
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [instantiateTarget, setInstantiateTarget] = useState<Playbook | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/playbooks')
      if (res.ok) {
        const data = await res.json() as Playbook[]
        setPlaybooks(data)
      } else {
        toast('Error cargando playbooks', 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleToggleActive = async (pb: Playbook) => {
    const res = await fetch(`/api/playbooks/${pb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !pb.active }),
    })
    if (res.ok) {
      setPlaybooks(prev => prev.map(p => p.id === pb.id ? { ...p, active: !pb.active } : p))
    } else {
      toast('Error actualizando estado', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/playbooks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPlaybooks(prev => prev.filter(p => p.id !== id))
      setConfirmDelete(null)
      toast('Playbook eliminado', 'success')
    } else {
      const j = await res.json().catch(() => ({}))
      toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
    }
  }

  return (
    <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
      {/* ── Header de la tab ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Playbooks
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
            Plantillas reutilizables para webinars, eventos, lanzamientos y campañas.
          </p>
        </div>
        <button className="btn-cta" onClick={() => setCreateOpen(true)}>
          <Plus size={13} aria-hidden="true" /> Nuevo playbook
        </button>
      </div>

      {/* ── Grid de cards ── */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          <Loader2 size={20} className="animate-spin inline-block mr-2" aria-hidden="true" />
          Cargando playbooks…
        </div>
      ) : playbooks.length === 0 ? (
        <div
          style={{
            padding: 40, textAlign: 'center',
            background: 'var(--surface)', border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--ink-3)', fontSize: 13,
          }}
        >
          <BookOpen size={28} aria-hidden="true" style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
            No hay playbooks todavía
          </p>
          <p>Crea uno o aplica la migración 014 para seed inicial.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {playbooks.map(pb => (
            <div
              key={pb.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                opacity: pb.active ? 1 : 0.55,
                transition: 'opacity 0.12s',
              }}
            >
              <div className="flex items-start gap-3 mb-2">
                <div
                  style={{
                    width: 36, height: 36,
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}
                >
                  {typeIcon(pb.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                    {pb.name}
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {typeLabel(pb.type)} ·{' '}
                    {pb.market_scope === 'all' ? 'Todos los mercados' : MARKET_LABEL[pb.market_scope as Market] ?? pb.market_scope}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleActive(pb)}
                  aria-label={pb.active ? 'Desactivar' : 'Activar'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  {pb.active
                    ? <ToggleRight size={22} style={{ color: 'var(--green-2)' }} />
                    : <ToggleLeft size={22} style={{ color: 'var(--ink-3)' }} />}
                </button>
              </div>

              {pb.description && (
                <p style={{
                  fontSize: 12, color: 'var(--ink-2)',
                  lineHeight: 1.5, margin: '6px 0 12px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {pb.description}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mb-3">
                {pb.default_channels.slice(0, 4).map(ch => (
                  <span
                    key={ch}
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 4,
                      background: 'var(--surface-2)', color: 'var(--ink-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <button
                  className="btn-pill-secondary"
                  onClick={() => setDetailId(pb.id)}
                  style={{ flex: 1 }}
                >
                  <Pencil size={11} aria-hidden="true" /> Editar
                </button>
                <button
                  className="btn-cta"
                  onClick={() => setInstantiateTarget(pb)}
                  style={{ flex: 1 }}
                  disabled={!pb.active}
                >
                  <Play size={11} aria-hidden="true" /> Instanciar
                </button>
                <button
                  onClick={() => setConfirmDelete(pb.id)}
                  aria-label="Eliminar"
                  style={{
                    width: 30, height: 30,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-3)',
                  }}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detailId && (
        <PlaybookDetailModal
          playbookId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
          toast={toast}
        />
      )}

      {/* ── Modal crear ── */}
      {createOpen && (
        <PlaybookCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(pb) => {
            setPlaybooks(prev => [...prev, pb])
            setCreateOpen(false)
            setDetailId(pb.id)
            toast('Playbook creado · añade los pasos', 'success')
          }}
          toast={toast}
        />
      )}

      {/* ── Modal instanciar ── */}
      {instantiateTarget && (
        <InstantiateModal
          playbook={instantiateTarget}
          onClose={() => setInstantiateTarget(null)}
          onDone={(numItems) => {
            setInstantiateTarget(null)
            toast(`Paquete creado · ${numItems} piezas en pipeline`, 'success')
          }}
          toast={toast}
        />
      )}

      {/* ── Confirmar eliminación ── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar playbook"
        size="sm"
      >
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16 }}>
          ¿Seguro que quieres eliminar este playbook? Esta acción no se puede deshacer.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            Cancelar
          </button>
          <button
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
            style={{
              height: 36, padding: '0 14px',
              background: 'var(--red)', color: '#fff',
              fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
            }}
          >
            Sí, eliminar
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: Crear playbook
// ─────────────────────────────────────────────────────────────────────────
function PlaybookCreateModal({
  onClose, onCreated, toast,
}: {
  onClose: () => void
  onCreated: (pb: Playbook) => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<PlaybookType>('webinar')
  const [description, setDescription] = useState('')
  const [marketScope, setMarketScope] = useState<MarketScope>('all')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast('Falta el nombre', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || null,
          market_scope: marketScope,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      const pb = await res.json() as Playbook
      onCreated(pb)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nuevo playbook" size="md">
      <div className="flex flex-col gap-4">
        <Field label="Nombre">
          <input
            className="input" autoFocus
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Ej: Webinar técnico Q3"
          />
        </Field>

        <Field label="Tipo">
          <select className="input" value={type} onChange={e => setType(e.target.value as PlaybookType)}>
            {PLAYBOOK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Mercado">
          <select className="input" value={marketScope} onChange={e => setMarketScope(e.target.value as MarketScope)}>
            <option value="all">Todos los mercados</option>
            {MARKETS.map(m => <option key={m} value={m}>{MARKET_LABEL[m]}</option>)}
          </select>
        </Field>

        <Field label="Descripción">
          <textarea
            className="input" rows={3}
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Para qué sirve este playbook y cuándo aplicarlo"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-cta" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Crear playbook
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: Editar playbook (metadatos + steps)
// ─────────────────────────────────────────────────────────────────────────
function PlaybookDetailModal({
  playbookId, onClose, onChanged, toast,
}: {
  playbookId: string
  onClose: () => void
  onChanged: () => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [pb, setPb] = useState<PlaybookWithSteps | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingStep, setAddingStep] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`)
      if (res.ok) setPb(await res.json() as PlaybookWithSteps)
    } finally {
      setLoading(false)
    }
  }, [playbookId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleSaveMeta = async (patch: Partial<Playbook>) => {
    const res = await fetch(`/api/playbooks/${playbookId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json() as Playbook
      setPb(prev => prev ? { ...prev, ...updated } : prev)
      onChanged()
    } else {
      toast('Error guardando', 'error')
    }
  }

  const handleAddStep = async (step: Partial<PlaybookStep>) => {
    const res = await fetch(`/api/playbooks/${playbookId}/steps`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(step),
    })
    if (res.ok) {
      const newStep = await res.json() as PlaybookStep
      setPb(prev => prev ? { ...prev, steps: [...(prev.steps ?? []), newStep] } : prev)
      setAddingStep(false)
      toast('Paso añadido', 'success')
    } else {
      toast('Error añadiendo paso', 'error')
    }
  }

  const handleUpdateStep = async (stepId: string, patch: Partial<PlaybookStep>) => {
    const res = await fetch(`/api/playbooks/${playbookId}/steps/${stepId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json() as PlaybookStep
      setPb(prev => prev ? {
        ...prev,
        steps: (prev.steps ?? []).map(s => s.id === stepId ? updated : s),
      } : prev)
    } else {
      toast('Error guardando paso', 'error')
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    const res = await fetch(`/api/playbooks/${playbookId}/steps/${stepId}`, { method: 'DELETE' })
    if (res.ok) {
      setPb(prev => prev ? {
        ...prev,
        steps: (prev.steps ?? []).filter(s => s.id !== stepId),
      } : prev)
      toast('Paso eliminado', 'info')
    } else {
      toast('Error eliminando', 'error')
    }
  }

  if (loading || !pb) {
    return (
      <Modal open onClose={onClose} title="Cargando..." size="lg">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
          <Loader2 size={20} className="animate-spin inline-block" aria-hidden="true" />
        </div>
      </Modal>
    )
  }

  const steps = (pb.steps ?? []).slice().sort((a, b) => a.step_order - b.step_order)

  return (
    <Modal open onClose={onClose} title={`${typeIcon(pb.type)} ${pb.name}`} size="lg">
      <div className="flex flex-col gap-4">
        {/* Metadatos editables */}
        <div style={{
          padding: 14, background: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10,
          }}>
            Metadatos
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" small>
              <input
                className="input"
                defaultValue={pb.name}
                onBlur={e => e.target.value.trim() && e.target.value !== pb.name && handleSaveMeta({ name: e.target.value.trim() })}
              />
            </Field>
            <Field label="Tipo" small>
              <select
                className="input" value={pb.type}
                onChange={e => handleSaveMeta({ type: e.target.value as PlaybookType })}
              >
                {PLAYBOOK_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </Field>
            <Field label="Mercado" small>
              <select
                className="input" value={pb.market_scope}
                onChange={e => handleSaveMeta({ market_scope: e.target.value as MarketScope })}
              >
                <option value="all">Todos los mercados</option>
                {MARKETS.map(m => <option key={m} value={m}>{MARKET_LABEL[m]}</option>)}
              </select>
            </Field>
            <Field label="Estado" small>
              <button
                onClick={() => handleSaveMeta({ active: !pb.active })}
                style={{
                  width: '100%', height: 32,
                  background: pb.active ? 'var(--green-soft)' : 'var(--surface)',
                  color: pb.active ? 'var(--green-2)' : 'var(--ink-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {pb.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {pb.active ? 'Activo' : 'Inactivo'}
              </button>
            </Field>
          </div>
          <Field label="Descripción" small>
            <textarea
              className="input" rows={2}
              defaultValue={pb.description ?? ''}
              onBlur={e => e.target.value !== (pb.description ?? '') && handleSaveMeta({ description: e.target.value || null })}
            />
          </Field>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--ink-3)',
            }}>
              Pasos del playbook ({steps.length})
            </p>
            <button
              className="btn-pill-secondary"
              onClick={() => setAddingStep(true)}
              style={{ fontSize: 11 }}
            >
              <Plus size={11} aria-hidden="true" /> Añadir paso
            </button>
          </div>

          {steps.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', padding: 16, textAlign: 'center' }}>
              Sin pasos. Añade al menos uno antes de instanciar.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, idx) => (
                <StepRow
                  key={step.id}
                  step={step}
                  order={idx + 1}
                  onUpdate={(patch) => handleUpdateStep(step.id, patch)}
                  onDelete={() => handleDeleteStep(step.id)}
                />
              ))}
            </div>
          )}

          {addingStep && (
            <StepRow
              order={steps.length + 1}
              isNew
              onCreate={(data) => handleAddStep(data)}
              onCancel={() => setAddingStep(false)}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Step row (editable inline)
// ─────────────────────────────────────────────────────────────────────────
function StepRow({
  step, order, isNew, onUpdate, onDelete, onCreate, onCancel,
}: {
  step?: PlaybookStep
  order: number
  isNew?: boolean
  onUpdate?: (patch: Partial<PlaybookStep>) => void
  onDelete?: () => void
  onCreate?: (data: Partial<PlaybookStep>) => void
  onCancel?: () => void
}) {
  const [offset, setOffset] = useState(step?.relative_day_offset ?? 0)
  const [channel, setChannel] = useState<Channel | ''>((step?.channel ?? '') as Channel)
  const [taskType, setTaskType] = useState<PlaybookTaskType>(step?.task_type ?? 'post')
  const [titleTemplate, setTitleTemplate] = useState(step?.title_template ?? '')
  const [instructions, setInstructions] = useState(step?.instructions ?? '')
  const [required, setRequired] = useState(step?.required ?? true)

  const offsetLabel = offset === 0 ? 'día 0 (anchor)' :
                       offset < 0  ? `${Math.abs(offset)}d antes` :
                                     `${offset}d después`

  const handleSave = () => {
    if (isNew) {
      onCreate?.({
        relative_day_offset: offset,
        channel: channel || null,
        task_type: taskType,
        title_template: titleTemplate || null,
        instructions: instructions || null,
        required,
      })
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: 12,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          style={{
            width: 26, height: 26, flexShrink: 0,
            background: 'var(--accent-soft)', color: 'var(--accent-2)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, marginTop: 2,
          }}
        >
          {order}
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
          <Field label="Día (offset)" small>
            <input
              type="number" className="input" value={offset}
              onChange={e => setOffset(Number(e.target.value))}
              onBlur={() => !isNew && step && offset !== step.relative_day_offset && onUpdate?.({ relative_day_offset: offset })}
              style={{ height: 30 }}
            />
            <span style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, display: 'block' }}>
              {offsetLabel}
            </span>
          </Field>
          <Field label="Canal" small>
            <select
              className="input" value={channel}
              onChange={e => {
                const v = e.target.value as Channel | ''
                setChannel(v)
                if (!isNew && step) onUpdate?.({ channel: (v || null) as Channel | null })
              }}
              style={{ height: 30 }}
            >
              <option value="">—</option>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Tipo de pieza" small>
            <select
              className="input" value={taskType}
              onChange={e => {
                const v = e.target.value as PlaybookTaskType
                setTaskType(v)
                if (!isNew && step) onUpdate?.({ task_type: v })
              }}
              style={{ height: 30 }}
            >
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <div className="col-span-3">
            <Field label='Plantilla de título — usa {{event_name}}, {{anchor_date}}, {{market}}' small>
              <input
                className="input" value={titleTemplate}
                onChange={e => setTitleTemplate(e.target.value)}
                onBlur={() => !isNew && step && titleTemplate !== (step.title_template ?? '') && onUpdate?.({ title_template: titleTemplate || null })}
                placeholder="Ej: Anuncio webinar: {{event_name}}"
                style={{ height: 30 }}
              />
            </Field>
          </div>
          <div className="col-span-3">
            <Field label="Instrucciones para la IA" small>
              <textarea
                className="input" rows={2} value={instructions}
                onChange={e => setInstructions(e.target.value)}
                onBlur={() => !isNew && step && instructions !== (step.instructions ?? '') && onUpdate?.({ instructions: instructions || null })}
                placeholder="Qué debe contener este copy, tono específico, CTA esperado…"
              />
            </Field>
          </div>
          <div className="col-span-3 flex items-center gap-3">
            <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)', cursor: 'pointer' }}>
              <input
                type="checkbox" checked={required}
                onChange={e => {
                  setRequired(e.target.checked)
                  if (!isNew && step) onUpdate?.({ required: e.target.checked })
                }}
              />
              Paso obligatorio
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {isNew ? (
            <>
              <button className="btn-cta" onClick={handleSave} style={{ height: 26, fontSize: 11 }}>
                Añadir
              </button>
              <button className="btn-secondary" onClick={onCancel} style={{ height: 26, fontSize: 11 }}>
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={onDelete}
              aria-label="Eliminar paso"
              style={{
                width: 26, height: 26,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', color: 'var(--ink-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: Instanciar playbook
// ─────────────────────────────────────────────────────────────────────────
function InstantiateModal({
  playbook, onClose, onDone, toast,
}: {
  playbook: Playbook
  onClose: () => void
  onDone: (numItems: number) => void
  toast: (m: string, k?: 'success' | 'error' | 'info') => void
}) {
  const [title, setTitle] = useState('')
  const [anchorDate, setAnchorDate] = useState('')
  const [market, setMarket] = useState<Market>(
    playbook.market_scope === 'all' ? 'spain' : (playbook.market_scope as Market)
  )
  const [objective, setObjective] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) { toast('Falta el título', 'error'); return }
    if (!anchorDate) { toast('Falta la fecha ancla', 'error'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/playbooks/${playbook.id}/instantiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          anchor_date: new Date(anchorDate).toISOString(),
          market,
          objective: objective.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast(`Error: ${j.error ?? 'no_se_pudo'}`, 'error')
        return
      }
      const data = await res.json() as { items: unknown[] }
      onDone(data.items.length)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Instanciar: ${playbook.name}`} size="md">
      <div className="flex flex-col gap-4">
        <div style={{
          padding: 12, background: 'var(--accent-soft)',
          borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--ink-2)',
        }}>
          <strong>{typeIcon(playbook.type)} {typeLabel(playbook.type)}</strong>
          <p style={{ marginTop: 4 }}>
            Esto creará un paquete de campaña y generará todas las piezas del playbook
            como tarjetas en el Pipeline (etapa <strong>Ideas</strong>), con su fecha calculada
            respecto a la fecha ancla.
          </p>
        </div>

        <Field label="Título del paquete">
          <input
            className="input" autoFocus
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder='Ej: "Webinar Legionella Q3 2026"'
          />
        </Field>

        <Field label="Fecha ancla (día 0 del playbook)">
          <input
            type="datetime-local" className="input"
            value={anchorDate} onChange={e => setAnchorDate(e.target.value)}
          />
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            Las piezas se programarán automáticamente respecto a esta fecha (algunas antes, otras después).
          </p>
        </Field>

        <Field label="Mercado">
          <select className="input" value={market} onChange={e => setMarket(e.target.value as Market)}>
            {MARKETS.map(m => <option key={m} value={m}>{MARKET_LABEL[m]}</option>)}
          </select>
        </Field>

        <Field label="Objetivo (opcional)">
          <textarea
            className="input" rows={2}
            value={objective} onChange={e => setObjective(e.target.value)}
            placeholder="Ej: 200 registros, 50 demos agendadas"
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-cta" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? <><Loader2 size={13} className="animate-spin" /> Generando…</>
              : <><Play size={13} /> Generar paquete</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
function Field({
  label, small, children,
}: {
  label: string
  small?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <p style={{
        fontSize: small ? 10 : 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--ink-3)', marginBottom: 5,
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}
