# Pipeline Image Drive — Implementation Plan

> **For agentic workers:** Use executing-plans to implement task-by-task.

**Goal:** Añadir al Pipeline un panel de imágenes tipo "Drive" integrado en el modal de detalle, con búsqueda en biblioteca y generación inline, para que el flujo completo (idea → copy → imágenes → aprobar) sea completable sin salir del Pipeline.

**Architecture:** El `ContentDetailModal` en el stage `design` (y posteriores) expone un nuevo componente `ImageDrivePanel` con dos tabs — Biblioteca (browse + assign) y Generar (prompt → Imagen 4 → auto-assign). El `itemImageMap` en `pipeline/page.tsx` se enriquece para incluir el `id` del asset asignado, evitando re-fetch. El backend amplía el PATCH de imágenes para aceptar `content_item_id`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, `/api/images/[id]` PATCH, `/api/images/generate` POST, `/api/images` GET.

---

## Mapa de archivos

| Acción | Archivo | Qué cambia |
|---|---|---|
| Modify | `src/app/api/images/[id]/route.ts` | PATCH acepta `content_item_id?: string \| null` |
| Create | `src/components/pipeline/ImageDrivePanel.tsx` | Nuevo componente Drive (tabs Biblioteca + Generar) |
| Modify | `src/components/pipeline/PipelineBoard.tsx` | `itemImageMap` tipo → `{id,url}`, pasar imageId al modal, embed `ImageDrivePanel` en `ContentDetailModal` |
| Modify | `src/app/(dashboard)/pipeline/page.tsx` | `itemImageMap` tipo → `{id,url}`, callback `onImageAssigned` |

---

## Task 1 — PATCH `/api/images/[id]` acepta `content_item_id`

**Archivo:** `src/app/api/images/[id]/route.ts`

- [ ] **1.1** Añadir `content_item_id?: string | null` al tipo del body del PATCH (línea 32):

```typescript
let body: { approved?: boolean; folder_id?: string | null; content_item_id?: string | null }
```

- [ ] **1.2** Añadir bloque de validación + patch para `content_item_id` después del bloque `folder_id` (tras línea 62):

```typescript
// Asignar / desasignar content_item
if (Object.prototype.hasOwnProperty.call(body, 'content_item_id')) {
  if (body.content_item_id !== null && typeof body.content_item_id === 'string') {
    const { data: ci } = await admin
      .from('content_assets')
      .select('id')
      .eq('id', body.content_item_id)  // validación de existencia no necesaria — FK en BD
      .maybeSingle()
    // La FK a content_items se valida en BD; aquí solo saneamos el tipo
    void ci
  }
  patch.content_item_id = body.content_item_id
}
```

> Nota: el campo `content_item_id` en `content_assets` es una FK libre (sin NOT NULL). La BD lo valida; aquí solo añadimos el campo al patch.

- [ ] **1.3** Verificar que `npx tsc --noEmit` sigue en 0 errores.

- [ ] **1.4** Test manual rápido:
```bash
# Obtener un asset id de la BD (desde Supabase Studio o GET /api/images)
# Asignar a un content_item ficticio
curl -X PATCH http://localhost:3000/api/images/<ASSET_ID> \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"content_item_id": null}'
# Esperado: { "ok": true, "content_item_id": null }
```

- [ ] **1.5** Commit:
```bash
git add src/app/api/images/[id]/route.ts
git commit -m "feat(api): PATCH /api/images/[id] acepta content_item_id"
```

---

## Task 2 — Enriquecer `itemImageMap` a `{ id, url }`

**Archivo:** `src/app/(dashboard)/pipeline/page.tsx`

- [ ] **2.1** Cambiar el tipo del estado (línea ~60):

```typescript
// ANTES
const [itemImageMap, setItemImageMap] = useState<Record<string, string>>({})

// DESPUÉS
const [itemImageMap, setItemImageMap] = useState<Record<string, { id: string; url: string }>>({})
```

- [ ] **2.2** Actualizar el `fetchItems` para construir el mapa con `id` (línea ~81):

```typescript
if (aRes.ok) {
  const assets = await aRes.json() as Array<{
    id: string
    url: string
    content_item_id: string | null
  }>
  const map: Record<string, { id: string; url: string }> = {}
  for (const a of assets) {
    if (a.content_item_id && !map[a.content_item_id]) {
      map[a.content_item_id] = { id: a.id, url: a.url }
    }
  }
  setItemImageMap(map)
}
```

- [ ] **2.3** Añadir callback `onImageAssigned` para que el modal actualice el mapa sin re-fetch:

```typescript
const handleImageAssigned = useCallback((contentItemId: string, assetId: string, url: string) => {
  setItemImageMap(prev => ({ ...prev, [contentItemId]: { id: assetId, url } }))
}, [])

const handleImageUnassigned = useCallback((contentItemId: string) => {
  setItemImageMap(prev => {
    const next = { ...prev }
    delete next[contentItemId]
    return next
  })
}, [])
```

- [ ] **2.4** Pasar los callbacks al `PipelineBoard`:

```typescript
<PipelineBoard
  items={items}
  filterChannels={filterChannels}
  onAdd={handleAdd}
  onMove={handleMove}
  onDelete={handleDelete}
  onApprove={handleApprove}
  onItemUpdated={(updated) => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
  itemImageMap={itemImageMap}
  onImageAssigned={handleImageAssigned}
  onImageUnassigned={handleImageUnassigned}
/>
```

- [ ] **2.5** `npx tsc --noEmit` → 0 errores (habrá errores en PipelineBoard hasta Task 3 — normal).

---

## Task 3 — Actualizar `PipelineBoard.tsx` para nuevo tipo + props

**Archivo:** `src/components/pipeline/PipelineBoard.tsx`

- [ ] **3.1** Actualizar interfaz `BoardProps`:

```typescript
interface BoardProps {
  items:               ContentItem[]
  filterChannels:      Channel[]
  onAdd:               (stage: Stage, data: { title: string; channel: Channel }) => void
  onMove:              (id: string, newStage: Stage) => void
  onDelete:            (id: string) => void
  onApprove:           (id: string, currentStage: Stage) => void
  onItemUpdated?:      (item: ContentItem) => void
  itemImageMap?:       Record<string, { id: string; url: string }>   // ← CAMBIO
  onImageAssigned?:    (contentItemId: string, assetId: string, url: string) => void  // ← NUEVO
  onImageUnassigned?:  (contentItemId: string) => void               // ← NUEVO
}
```

- [ ] **3.2** Actualizar todos los lugares donde `itemImageMap?.[item.id]` devolvía string — ahora devuelve `{id, url}`:

En `Card` component (line ~824):
```typescript
// Prop hasImage permanece boolean — sin cambio
hasImage={Boolean(itemImageMap?.[item.id])}
```

En `PipelineBoard` (line ~1205):
```typescript
imageUrl={itemImageMap?.[selectedItem.id]?.url ?? null}
imageId={itemImageMap?.[selectedItem.id]?.id ?? null}   // ← NUEVO
```

En `Column` prop pass-through (añadir a Column props):
```typescript
// Column props — añadir:
onImageAssigned?:   (contentItemId: string, assetId: string, url: string) => void
onImageUnassigned?: (contentItemId: string) => void
```

- [ ] **3.3** Actualizar `ContentDetailModal` props — añadir `imageId` y los callbacks:

```typescript
function ContentDetailModal({
  item, imageUrl, imageId, onClose, onApprove, onMove, onDelete, onItemUpdated,
  onImageAssigned, onImageUnassigned,
}: {
  item:              ContentItem
  imageUrl:          string | null
  imageId:           string | null       // ← NUEVO
  onClose:           () => void
  onApprove:         (id: string, s: Stage) => void
  onMove:            (id: string, s: Stage) => void
  onDelete:          (id: string) => void
  onItemUpdated?:    (item: ContentItem) => void
  onImageAssigned?:  (contentItemId: string, assetId: string, url: string) => void  // ← NUEVO
  onImageUnassigned?: (contentItemId: string) => void  // ← NUEVO
})
```

- [ ] **3.4** Dentro del modal, reemplazar el chip estático de "Pendiente de crear los visuales" (en el else de `canGenerate`) con el `ImageDrivePanel` (se implementa en Task 4). Por ahora, añadir un placeholder:

```typescript
// En el bloque: item.stage === 'design' || item.stage === 'scheduled'
// Reemplazar:
// <div className="inline-flex...">Pendiente de crear los visuales</div>
// Con:
<div
  className="p-3 rounded-[var(--radius-md)] text-[12px]"
  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
>
  [ImageDrivePanel — Task 4]
</div>
```

- [ ] **3.5** `npx tsc --noEmit` → puede haber errores temporales del placeholder — aceptable hasta Task 4.

---

## Task 4 — Crear `ImageDrivePanel`

**Archivo:** `src/components/pipeline/ImageDrivePanel.tsx` (nuevo)

Este componente tiene dos tabs:
- **Biblioteca**: grid de imágenes de la librería filtradas por canal, click = asignar
- **Generar nueva**: prompt + aspectRatio → POST /api/images/generate → auto-asigna

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, Image as ImageIcon, X, Check, RefreshCw } from 'lucide-react'
import type { Channel } from '@/types/database'

interface LibraryAsset {
  id: string
  url: string
  prompt: string | null
  aspect_ratio: string | null
  created_at: string
}

interface Props {
  itemId:          string
  channel:         Channel
  assignedImageId: string | null
  assignedImageUrl: string | null
  onAssigned:      (assetId: string, url: string) => void
  onUnassigned:    () => void
}

type Tab = 'library' | 'generate'

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1 — Square' },
  { value: '16:9', label: '16:9 — Landscape' },
  { value: '9:16', label: '9:16 — Stories' },
  { value: '4:5',  label: '4:5 — Portrait' },
]

export function ImageDrivePanel({
  itemId, channel, assignedImageId, assignedImageUrl, onAssigned, onUnassigned,
}: Props) {
  const [tab, setTab] = useState<Tab>('library')

  // ── Library state ──────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [libError, setLibError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null) // assetId being assigned

  const fetchLibrary = useCallback(async () => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingLib(true)
    setLibError(null)
    try {
      const res = await fetch(`/api/images?channel=${channel}&limit=60`)
      if (!res.ok) { setLibError('Error cargando imágenes'); return }
      const data = await res.json() as LibraryAsset[]
      setAssets(data)
    } catch {
      setLibError('Error de red')
    } finally {
      setLoadingLib(false)
    }
  }, [channel])

  useEffect(() => {
    if (tab === 'library') fetchLibrary()
  }, [tab, fetchLibrary])

  const handleAssign = useCallback(async (assetId: string, url: string) => {
    setAssigning(assetId)
    try {
      const res = await fetch(`/api/images/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: itemId }),
      })
      if (!res.ok) return
      // Si había otro asset asignado, desasignarlo
      if (assignedImageId && assignedImageId !== assetId) {
        await fetch(`/api/images/${assignedImageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_item_id: null }),
        }).catch(() => {})
      }
      onAssigned(assetId, url)
    } finally {
      setAssigning(null)
    }
  }, [itemId, assignedImageId, onAssigned])

  const handleUnassign = useCallback(async () => {
    if (!assignedImageId) return
    setAssigning(assignedImageId)
    try {
      await fetch(`/api/images/${assignedImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_item_id: null }),
      })
      onUnassigned()
    } finally {
      setAssigning(null)
    }
  }, [assignedImageId, onUnassigned])

  // ── Generate state ─────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedId, setGeneratedId] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenError(null)
    setGeneratedUrl(null)
    setGeneratedId(null)
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, channel }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGenError((j as { error?: string }).error ?? `HTTP ${res.status}`)
        return
      }
      const data = await res.json() as { id: string; url: string }
      setGeneratedUrl(data.url)
      setGeneratedId(data.id)
      // Auto-asignar al content item
      await handleAssign(data.id, data.url)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error de generación')
    } finally {
      setGenerating(false)
    }
  }, [prompt, aspectRatio, channel, handleAssign])

  return (
    <div className="flex flex-col gap-3">
      {/* Imagen asignada actualmente */}
      {assignedImageUrl && (
        <div
          className="relative rounded-[var(--radius-md)] overflow-hidden"
          style={{ border: '2px solid var(--accent)', background: 'var(--surface-2)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assignedImageUrl}
            alt="Imagen asignada"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
          />
          <div
            className="absolute top-2 right-2 flex items-center gap-1.5"
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Check size={11} aria-hidden="true" /> Asignada
          </div>
          <button
            onClick={handleUnassign}
            disabled={!!assigning}
            className="absolute top-2 left-2 flex items-center justify-center"
            style={{
              width: 26, height: 26,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              border: 'none',
            }}
            aria-label="Desasignar imagen"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 3,
          gap: 3,
        }}
      >
        {(['library', 'generate'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 flex items-center justify-center gap-1.5 transition-all"
            style={{
              height: 30,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'calc(var(--radius-md) - 2px)',
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
              border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {t === 'library' ? (
              <><ImageIcon size={12} aria-hidden="true" /> Biblioteca</>
            ) : (
              <><Sparkles size={12} aria-hidden="true" /> Generar nueva</>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Biblioteca */}
      {tab === 'library' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
              Imágenes del canal <strong style={{ color: 'var(--ink-2)' }}>{channel}</strong>
            </p>
            <button
              onClick={fetchLibrary}
              disabled={loadingLib}
              style={{ color: 'var(--ink-3)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              aria-label="Recargar biblioteca"
            >
              <RefreshCw size={13} className={loadingLib ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>

          {loadingLib ? (
            <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--ink-3)' }}>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span style={{ fontSize: 12 }}>Cargando…</span>
            </div>
          ) : libError ? (
            <p style={{ fontSize: 12, color: 'var(--red-2)', padding: '8px 0' }}>{libError}</p>
          ) : assets.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8 gap-2"
              style={{ color: 'var(--ink-3)', fontSize: 12 }}
            >
              <ImageIcon size={24} aria-hidden="true" style={{ opacity: 0.35 }} />
              <p>No hay imágenes para este canal.</p>
              <button
                onClick={() => setTab('generate')}
                className="btn-pill-secondary"
                style={{ marginTop: 4 }}
              >
                <Sparkles size={12} aria-hidden="true" /> Generar una nueva
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {assets.map(asset => {
                const isAssigned = asset.id === assignedImageId
                const isLoading = assigning === asset.id
                return (
                  <button
                    key={asset.id}
                    onClick={() => !isAssigned && handleAssign(asset.id, asset.url)}
                    disabled={isLoading || isAssigned}
                    className="relative overflow-hidden"
                    style={{
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      border: isAssigned
                        ? '2px solid var(--accent)'
                        : '2px solid transparent',
                      background: 'var(--surface-2)',
                      padding: 0,
                      cursor: isAssigned ? 'default' : 'pointer',
                      outline: 'none',
                    }}
                    aria-label={isAssigned ? 'Imagen asignada' : `Asignar: ${asset.prompt ?? 'imagen'}`}
                    title={asset.prompt ?? undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.prompt ?? 'imagen'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {isLoading && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.4)' }}
                      >
                        <Loader2 size={16} className="animate-spin" style={{ color: '#fff' }} aria-hidden="true" />
                      </div>
                    )}
                    {isAssigned && (
                      <div
                        className="absolute bottom-1 right-1 flex items-center justify-center"
                        style={{
                          width: 18, height: 18,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                        }}
                      >
                        <Check size={11} style={{ color: '#fff' }} aria-hidden="true" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Generar nueva */}
      {tab === 'generate' && (
        <div className="flex flex-col gap-3">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={`Describe la imagen para ${channel}…`}
            rows={3}
            className="input"
            style={{
              resize: 'vertical',
              minHeight: 80,
              fontSize: 13,
              padding: 10,
              fontFamily: 'inherit',
            }}
            disabled={generating}
          />
          <select
            value={aspectRatio}
            onChange={e => setAspectRatio(e.target.value)}
            className="input"
            style={{ height: 34, fontSize: 12 }}
            disabled={generating}
          >
            {ASPECT_RATIOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {genError && (
            <p style={{ fontSize: 11, color: 'var(--red-2)' }}>Error: {genError}</p>
          )}

          {generatedUrl && (
            <div
              className="rounded-[var(--radius-md)] overflow-hidden"
              style={{ border: '1px solid var(--border)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedUrl}
                alt="Imagen generada"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
              />
              <div
                className="flex items-center gap-1.5 px-3 py-2"
                style={{
                  background: 'var(--green-soft)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--green-2)',
                }}
              >
                <Check size={11} aria-hidden="true" /> Generada y asignada automáticamente
              </div>
            </div>
          )}

          <button
            className="btn-cta"
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
          >
            {generating ? (
              <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Generando con Imagen 4…</>
            ) : (
              <><Sparkles size={13} aria-hidden="true" /> Generar imagen</>
            )}
          </button>

          <p style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Usa Imagen 4 Ultra vía Gemini. El prompt se enriquece automáticamente. La imagen generada se asigna directamente a esta tarjeta (10-30s).
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **4.1** Crear el archivo con el código anterior en `src/components/pipeline/ImageDrivePanel.tsx`

- [ ] **4.2** `npx eslint src/components/pipeline/ImageDrivePanel.tsx --ext .tsx` — fijar warnings si los hay (especialmente `react-hooks/set-state-in-effect` en `setLoadingLib(true)` — añadir `// eslint-disable-next-line react-hooks/set-state-in-effect` encima de esa línea)

- [ ] **4.3** `npx tsc --noEmit` → 0 errores

---

## Task 5 — Integrar `ImageDrivePanel` en `ContentDetailModal`

**Archivo:** `src/components/pipeline/PipelineBoard.tsx`

- [ ] **5.1** Añadir import al top del archivo:

```typescript
import { ImageDrivePanel } from '@/components/pipeline/ImageDrivePanel'
```

- [ ] **5.2** En `ContentDetailModal`, reemplazar el placeholder de Task 3 (y el chip estático "Pendiente de crear los visuales") con:

```typescript
// Sustituye el bloque que dice: item.stage === 'design' → 'Pendiente de crear los visuales'
// y item.stage === 'scheduled' → 'Programado vía PostiZ'
// El bloque completo del else (cuando !canGenerate):

{/* ── Sección Imágenes — disponible en design, scheduled, analyzed ── */}
{(item.stage === 'design' || item.stage === 'scheduled' || item.stage === 'analyzed') && (
  <div
    style={{
      background: 'var(--surface-2)',
      padding: 16,
      borderRadius: 'var(--radius-md)',
      marginBottom: 16,
    }}
  >
    <p
      className="uppercase"
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        color: 'var(--ink-3)', marginBottom: 12,
      }}
    >
      Imagen asignada
    </p>
    <ImageDrivePanel
      itemId={item.id}
      channel={item.channel as Channel}
      assignedImageId={imageId}
      assignedImageUrl={imageUrl}
      onAssigned={(assetId, url) => {
        onImageAssigned?.(item.id, assetId, url)
      }}
      onUnassigned={() => {
        onImageUnassigned?.(item.id)
      }}
    />
  </div>
)}
```

> Esto reemplaza el chip estático de "Pendiente de crear los visuales" con el panel real. El panel funciona también en scheduled/analyzed para poder ver/cambiar la imagen.

- [ ] **5.3** Eliminar o poner `null` el chip estático de "Pendiente de crear los visuales" — ya no se muestra porque el panel lo sustituye.

- [ ] **5.4** `npx tsc --noEmit` → 0 errores
- [ ] **5.5** `npx eslint . --ext .ts,.tsx` → 0 errores, 0 warnings

- [ ] **5.6** Commit final:
```bash
git add src/app/api/images/[id]/route.ts \
        src/components/pipeline/ImageDrivePanel.tsx \
        src/components/pipeline/PipelineBoard.tsx \
        src/app/(dashboard)/pipeline/page.tsx
git commit -m "feat(pipeline): Image Drive panel — browse library + generate inline desde el modal de diseño"
```

---

## Checklist de QA manual

- [ ] Abrir Pipeline → card en stage `design` → click → modal abre
- [ ] Tab "Biblioteca" carga imágenes del canal (o muestra "No hay imágenes" si está vacío)
- [ ] Click en una imagen de biblioteca → se marca con check azul, miniatura aparece arriba
- [ ] Botón X en miniatura → desasigna, imagen vuelve a estar disponible en grid
- [ ] Tab "Generar nueva" → escribir prompt → Generar → spinner → imagen aparece asignada
- [ ] Al cerrar y reabrir el modal, la imagen asignada persiste
- [ ] Card en el board muestra el icono de imagen cuando hay una asignada
- [ ] Stage `ideas` / `copy` → NO muestra el ImageDrivePanel (no aplica)
- [ ] `tsc --noEmit`: 0 errores
- [ ] `eslint . --ext .ts,.tsx`: 0 errores, 0 warnings

---

## Notas para producción

- `POSTIZ_API_URL` en Vercel apunta a localhost → no funciona en prod. Ignorar por ahora.
- El `ImageDrivePanel` hace `GET /api/images?channel=X` — en prod llama a Supabase, sin problema.
- La generación de imagen tarda 10-30s — el spinner en el tab "Generar" lo gestiona.
- Las imágenes generadas van a Supabase Storage `content-assets/` — mismo bucket que el módulo de Imágenes.
