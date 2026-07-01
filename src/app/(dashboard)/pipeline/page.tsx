'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { PipelineBoard, GROUP_REPLICAS_LS_KEY } from '@/components/pipeline/PipelineBoard'
import { PackageBar, PackageDetailModal, type PackageWithStats } from '@/components/pipeline/PackageBar'
import { BatchGenerateModal } from '@/components/pipeline/BatchGenerateModal'
import { Sparkles, Filter, X, Loader2, Layers } from 'lucide-react'
import { cn, STAGE_CONFIG, STAGES, ALL_MARKETS, MARKET_LABELS } from '@/lib/utils'
import { useToast, Toasts } from '@/components/ui/Toast'
import type { ContentItem, Stage, Channel, Market } from '@/types/database'
import { PIPELINE_CHANGED_EVENT } from '@/lib/stores/pipeline-store'

const ALL_CHANNELS: Channel[] = ['linkedin', 'instagram', 'facebook', 'x', 'blog', 'email', 'newsletter']

const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook',
  x: 'X / Twitter', blog: 'Blog', email: 'Email', newsletter: 'Newsletter',
}

// ALL_MARKETS y MARKET_LABELS vienen de @/lib/utils → fuente única (evita drift).

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({
  value, label, variant = 'default',
}: {
  value: string | number
  label: string
  variant?: 'default' | 'amber' | 'emerald'
}) {
  const styles = {
    default: { bg: 'var(--surface-2)',  color: 'var(--ink-2)' },
    amber:   { bg: 'var(--amber-soft)', color: '#b25000'      },
    emerald: { bg: 'var(--green-soft)', color: '#248a3d'      },
  }[variant]

  return (
    <div
      className="inline-flex items-center gap-1.5 tabular-nums"
      style={{
        height: 24,
        padding: '0 10px',
        background: styles.bg,
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        fontSize: 11,
        fontWeight: 600,
        color: styles.color,
        lineHeight: 1,
      }}
    >
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  // content_item_id → array de assets vinculados (orden: position asc, luego
  // created_at asc para los que no tienen position). El primer asset se usa
  // como "principal" en thumbnails, todos viajan a Postiz como carrusel.
  const [itemImageMap, setItemImageMap] = useState<Record<string, Array<{ id: string; url: string }>>>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterChannels, setFilterChannels] = useState<Channel[]>([])
  const [filterMarkets, setFilterMarkets] = useState<Market[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [detailPackage, setDetailPackage] = useState<PackageWithStats | null>(null)
  const [packageBarRefresh, setPackageBarRefresh] = useState(0)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  // Toggle de agrupación de réplicas — persistido por usuario (LocalStorage).
  // Default true: usuario que ya sufre la aglomeración del original + N réplicas
  // las ve agrupadas de entrada. Vive en el page para que el botón encaje en
  // el header (antes flotaba solo encima del board — bug visual 1-jul).
  const [groupReplicas, setGroupReplicas] = useState<boolean>(true)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROUP_REPLICAS_LS_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === '0') setGroupReplicas(false)
    } catch {}
  }, [])
  const toggleGroupReplicas = useCallback(() => {
    setGroupReplicas(prev => {
      const next = !prev
      try { window.localStorage.setItem(GROUP_REPLICAS_LS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])
  const [profilesById, setProfilesById] = useState<Record<string, { full_name: string | null; email: string }>>({})
  // Set de IDs en-vuelo para prevenir doble-disparo en move/delete/approve
  const inFlightRef = useRef<Set<string>>(new Set())
  const { items: toasts, show: showToast, remove: removeToast } = useToast()

  // ── Carga inicial: items + map de imágenes asignadas ──────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const [iRes, aRes] = await Promise.all([
        fetch('/api/content-items'),
        fetch('/api/images'),
      ])
      if (iRes.ok) {
        const data = await iRes.json() as ContentItem[]
        setItems(data)
      } else {
        showToast(`Error cargando pipeline: HTTP ${iRes.status}`, 'error')
      }
      if (aRes.ok) {
        const assets = await aRes.json() as Array<{
          id: string
          url: string
          content_item_id: string | null
          position: number | null
          created_at: string
        }>
        // Agrupar TODOS los assets por content_item_id y ordenarlos por
        // position (carrusel) o created_at (uploads sueltos sin position).
        // Antes solo guardabamos UN asset por item → imposible montar
        // carruseles desde el banco (bug Alvaro 30-jun).
        const map: Record<string, Array<{ id: string; url: string; pos: number | null; ts: string }>> = {}
        for (const a of assets) {
          if (!a.content_item_id) continue
          const arr = map[a.content_item_id] ?? (map[a.content_item_id] = [])
          arr.push({ id: a.id, url: a.url, pos: a.position, ts: a.created_at })
        }
        const sorted: Record<string, Array<{ id: string; url: string }>> = {}
        for (const itemId of Object.keys(map)) {
          sorted[itemId] = map[itemId]
            .slice()
            .sort((a, b) => {
              // position asc; null al final ordenado por created_at asc
              if (a.pos != null && b.pos != null) return a.pos - b.pos
              if (a.pos != null) return -1
              if (b.pos != null) return 1
              return a.ts.localeCompare(b.ts)
            })
            .map(({ id, url }) => ({ id, url }))
        }
        setItemImageMap(sorted)
      }
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchItems() }, [fetchItems])

  // ── Carga directorio de perfiles para resolver UUIDs → nombres ────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/profiles')
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ id: string; full_name: string | null; email: string }>) => {
        if (cancelled) return
        const map: Record<string, { full_name: string | null; email: string }> = {}
        for (const p of rows) map[p.id] = { full_name: p.full_name, email: p.email }
        setProfilesById(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Sincronización con cambios externos (calendar→pipeline) ───────────────
  useEffect(() => {
    const onChanged = () => fetchItems()
    window.addEventListener(PIPELINE_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PIPELINE_CHANGED_EVENT, onChanged)
  }, [fetchItems])

  // ── Items filtrados por package + mercado seleccionado ─────────────────────
  // Nota: el filtro de canal se aplica dentro de PipelineBoard (cada columna).
  const visibleItems = useMemo(() => {
    let list = items
    if (selectedPackageId) list = list.filter(i => i.package_id === selectedPackageId)
    if (filterMarkets.length > 0) list = list.filter(i => filterMarkets.includes(i.market))
    return list
  }, [items, selectedPackageId, filterMarkets])

  // ── Computed stats (sobre items visibles) ─────────────────────────────────
  const totalItems = visibleItems.length
  const inRevision = useMemo(() => visibleItems.filter(i => i.status === 'in_progress').length, [visibleItems])
  const scheduled  = useMemo(() => visibleItems.filter(i => i.stage === 'scheduled').length, [visibleItems])

  // Refresca la PackageBar cuando cambian los items (al aprobar, mover, etc.)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPackageBarRefresh(r => r + 1)
  }, [items])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (
    stage: Stage,
    data: { title: string; channel: Channel; contentTypeId: string | null },
  ) => {
    const res = await fetch('/api/content-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        channel: data.channel,
        stage,
        ...(data.contentTypeId ? { content_type_id: data.contentTypeId } : {}),
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      showToast(`Error: ${j.error ?? res.statusText}`, 'error')
      return
    }
    const item = await res.json() as ContentItem
    setItems(prev => [item, ...prev])
    showToast(`Añadido a ${STAGE_CONFIG[stage].label}`, 'success')
  }, [showToast])

  const handleMove = useCallback(async (id: string, newStage: Stage) => {
    if (inFlightRef.current.has(`move-${id}`)) return // doble-click guard
    inFlightRef.current.add(`move-${id}`)
    const prev = items.find(i => i.id === id)
    if (!prev) { inFlightRef.current.delete(`move-${id}`); return }
    // Optimistic
    setItems(p => p.map(i => i.id === id ? { ...i, stage: newStage } : i))
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error: ${j.error ?? res.statusText}`, 'error')
        setItems(p => p.map(i => i.id === id ? { ...i, stage: prev.stage } : i))
        return
      }
      showToast(`Movido a ${STAGE_CONFIG[newStage].label}`, 'info')
    } finally {
      inFlightRef.current.delete(`move-${id}`)
    }
  }, [items, showToast])

  const handleDelete = useCallback(async (id: string) => {
    if (inFlightRef.current.has(`del-${id}`)) return // doble-click guard
    inFlightRef.current.add(`del-${id}`)
    const prev = items
    setItems(p => p.filter(i => i.id !== id))
    try {
      const res = await fetch(`/api/content-items/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        // `detail` (cuando viene) es la frase en español lista para mostrar.
        // El `error` técnico es fallback.
        showToast(j.detail ?? `Error: ${j.error ?? res.statusText}`, 'error')
        setItems(prev)
        return
      }
      showToast('Elemento eliminado', 'info')
    } finally {
      inFlightRef.current.delete(`del-${id}`)
    }
  }, [items, showToast])

  const handleApprove = useCallback(async (id: string, currentStage: Stage) => {
    if (inFlightRef.current.has(`approve-${id}`)) return // doble-click guard
    // Marcar human_approved SOLO desde la etapa 'approval' (máquina de estados).
    // Avanzar de etapas previas se hace con handleMove, no aquí.
    if (currentStage !== 'approval') return
    const currentIdx = STAGES.indexOf(currentStage)
    const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null
    if (!nextStage) return
    inFlightRef.current.add(`approve-${id}`)
    // approved_by/approved_at los setea el servidor — no los enviamos
    const patch = {
      human_approved: true,
      status: 'approved' as const,
      stage: nextStage,
    }
    setItems(p => p.map(i => i.id === id ? { ...i, ...patch } : i))
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error: ${j.error ?? res.statusText}`, 'error')
        fetchItems()
        return
      }
      showToast(`✓ Aprobado → ${STAGE_CONFIG[nextStage].label}`, 'success')
    } finally {
      inFlightRef.current.delete(`approve-${id}`)
    }
  }, [showToast, fetchItems])

  const handleReject = useCallback(async (id: string) => {
    if (inFlightRef.current.has(`reject-${id}`)) return
    inFlightRef.current.add(`reject-${id}`)
    setItems(p => p.map(i => i.id === id ? { ...i, status: 'rejected', human_approved: false } : i))
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', human_approved: false }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        showToast(`Error: ${j.error ?? res.statusText}`, 'error')
        fetchItems()
        return
      }
      showToast('Rechazado', 'success')
    } finally {
      inFlightRef.current.delete(`reject-${id}`)
    }
  }, [showToast, fetchItems])

  /**
   * Genera N ideas en una sola llamada a partir de un prompt + matriz de
   * mercados × canales. Crea esqueletos en stage 'ideas'; el usuario dispara
   * la generación de contenido con Gemini por item desde el modal del pipeline.
   */
  const handleGenerateBatch = useCallback(async (payload: {
    prompt: string
    campaign?: string
    matrix: Array<{ market: Market; channels: Channel[] }>
  }): Promise<{ ok: boolean; created: number; error?: string }> => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/content-items/batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        showToast(`Error: ${j.error ?? res.statusText}`, 'error')
        return { ok: false, created: 0, error: j.error }
      }
      const data = await res.json() as { items: ContentItem[] }
      const created = data.items ?? []
      if (created.length) setItems(prev => [...created, ...prev])
      showToast(`✓ ${created.length} idea${created.length === 1 ? '' : 's'} creada${created.length === 1 ? '' : 's'} en el pipeline`, 'success')
      setAiModalOpen(false)
      return { ok: true, created: created.length }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'desconocido'
      showToast(`Error de red: ${msg}`, 'error')
      return { ok: false, created: 0, error: msg }
    } finally {
      setAiLoading(false)
    }
  }, [showToast])

  const handleImageAssigned = useCallback((contentItemId: string, assetId: string, url: string) => {
    // Reemplaza TODO el array por solo este asset. assignAsset del frontend
    // ya desvincula los anteriores antes de re-vincular, así que en BD
    // queda solo este. Refleja ese estado.
    setItemImageMap(prev => ({ ...prev, [contentItemId]: [{ id: assetId, url }] }))
  }, [])

  // Multi-asignación (bulk-assign desde el banco). El backend ya reasigna
  // el carousel_id y positions; aquí solo reflejamos el nuevo array.
  const handleImagesAssigned = useCallback((
    contentItemId: string,
    assets: Array<{ id: string; url: string }>,
  ) => {
    setItemImageMap(prev => ({ ...prev, [contentItemId]: assets }))
  }, [])

  const handleImageUnassigned = useCallback((contentItemId: string) => {
    setItemImageMap(prev => {
      const next = { ...prev }
      delete next[contentItemId]
      return next
    })
  }, [])

  const toggleFilterChannel = (ch: Channel) => {
    setFilterChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  const toggleFilterMarket = (m: Market) => {
    setFilterMarkets(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  return (
    <div className="flex flex-col h-full relative" style={{ minHeight: 0 }}>
      {/* Header pipeline */}
      <header
        className="shrink-0"
        style={{
          padding: '20px 20px 16px 20px',
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div className="shrink-0 min-w-0 flex flex-col">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Pipeline
          </h1>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', margin: '3px 0 0', letterSpacing: '0.01em' }}>
            Agente Marketing · iGEO
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2" style={{ marginLeft: 4 }}>
          <StatPill value={totalItems} label="piezas"      variant="default" />
          <StatPill value={inRevision} label="en revisión" variant="amber"   />
          <StatPill value={scheduled}  label="programado"  variant="emerald" />
        </div>

        <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: 'auto' }}>
          {/* Toggle réplicas agrupadas/separadas — vive en el header en vez de
              flotar solo encima del board. */}
          <button
            type="button"
            onClick={toggleGroupReplicas}
            title={groupReplicas
              ? 'Las réplicas a otros mercados se agrupan en una sola tarjeta apilada'
              : 'Las réplicas a otros mercados se muestran como tarjetas independientes'}
            aria-pressed={groupReplicas}
            className={cn('btn-pill-secondary', groupReplicas && 'is-active')}
          >
            <Layers size={13} aria-hidden="true" />
            {groupReplicas ? 'Réplicas agrupadas' : 'Réplicas separadas'}
          </button>
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={cn('btn-pill-secondary relative', filterOpen && 'is-active')}
          >
            <Filter size={13} aria-hidden="true" />
            Filtrar
            {(filterChannels.length + filterMarkets.length) > 0 && (
              <span
                className="absolute -top-1 -right-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white tabular-nums"
                style={{ width: 16, height: 16, background: 'var(--accent)' }}
              >
                {filterChannels.length + filterMarkets.length}
              </span>
            )}
          </button>

          <button onClick={() => setAiModalOpen(true)} className="btn-cta">
            <Sparkles size={13} aria-hidden="true" />
            Generar con IA
          </button>
        </div>
      </header>

      {/* Package bar — solo se muestra si hay paquetes activos/draft */}
      <PackageBar
        selectedPackageId={selectedPackageId}
        onSelect={setSelectedPackageId}
        onOpenDetail={setDetailPackage}
        refreshKey={packageBarRefresh}
      />

      {/* Filter bar — dos filas con padding generoso y pills más cómodos */}
      {filterOpen && (
        <div
          className="flex flex-col shrink-0 animate-fade-up"
          style={{
            padding: '20px 28px 28px',
            gap: 16,
            marginBottom: 16,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          {/* ── Fila Canal ── */}
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <span
              className="uppercase shrink-0"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--ink-3)',
                minWidth: 72,
              }}
            >
              Canal
            </span>
            {ALL_CHANNELS.map(ch => {
              const active = filterChannels.includes(ch)
              return (
                <button
                  key={ch}
                  onClick={() => toggleFilterChannel(ch)}
                  className={cn(
                    'transition-all whitespace-nowrap',
                    active ? 'text-white' : 'text-[var(--ink-2)] hover:text-[var(--ink)]',
                  )}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1,
                    ...(active
                      ? { background: 'var(--accent)', border: '1px solid var(--accent)' }
                      : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
                    ),
                  }}
                >
                  {CHANNEL_LABELS[ch]}
                </button>
              )
            })}
            {filterChannels.length > 0 && (
              <button
                onClick={() => setFilterChannels([])}
                className="inline-flex items-center transition-colors whitespace-nowrap"
                style={{
                  height: 32,
                  padding: '0 12px',
                  gap: 6,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--red-soft)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: 'var(--red-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1,
                  marginLeft: 'auto',
                }}
              >
                <X size={12} aria-hidden="true" />
                Limpiar
              </button>
            )}
          </div>

          {/* ── Fila Mercado ── */}
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <span
              className="uppercase shrink-0"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--ink-3)',
                minWidth: 72,
              }}
            >
              Mercado
            </span>
            {ALL_MARKETS.map(m => {
              const active = filterMarkets.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggleFilterMarket(m)}
                  className={cn(
                    'transition-all whitespace-nowrap',
                    active ? 'text-white' : 'text-[var(--ink-2)] hover:text-[var(--ink)]',
                  )}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1,
                    ...(active
                      ? { background: 'var(--accent)', border: '1px solid var(--accent)' }
                      : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
                    ),
                  }}
                >
                  {MARKET_LABELS[m]}
                </button>
              )
            })}
            {filterMarkets.length > 0 && (
              <button
                onClick={() => setFilterMarkets([])}
                className="inline-flex items-center transition-colors whitespace-nowrap"
                style={{
                  height: 32,
                  padding: '0 12px',
                  gap: 6,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--red-soft)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: 'var(--red-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1,
                  marginLeft: 'auto',
                }}
              >
                <X size={12} aria-hidden="true" />
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2" style={{ color: 'var(--ink-3)' }}>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            <span className="text-[13px]">Cargando pipeline…</span>
          </div>
        ) : (
          <PipelineBoard
            items={visibleItems}
            filterChannels={filterChannels}
            groupReplicas={groupReplicas}
            onAdd={handleAdd}
            onMove={handleMove}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onReject={handleReject}
            onItemUpdated={(updated) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
            itemImageMap={itemImageMap}
            onImageAssigned={handleImageAssigned}
            onImagesAssigned={handleImagesAssigned}
            onImageUnassigned={handleImageUnassigned}
            profilesById={profilesById}
          />
        )}
      </div>

      {/* Batch Generate Modal — prompt + matriz mercado × canal */}
      <BatchGenerateModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        loading={aiLoading}
        onSubmit={handleGenerateBatch}
        channels={ALL_CHANNELS}
        channelLabels={CHANNEL_LABELS}
        markets={ALL_MARKETS}
        marketLabels={MARKET_LABELS}
      />

      {/* Package detail modal */}
      {detailPackage && (
        <PackageDetailModal pkg={detailPackage} onClose={() => setDetailPackage(null)} />
      )}

      <Toasts items={toasts} remove={removeToast} />
    </div>
  )
}
