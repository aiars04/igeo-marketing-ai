# Feature: Sugerir Mejoras — guía de réplica

Documentación técnica completa del sistema de sugerencias / mejoras tal y como está
implementado en iGEO Marketing AI. Sirve para replicarlo en cualquier otra app
Next.js 16 + Supabase.

Permite a cualquier usuario logueado mandar **bugs / mejoras / ideas** con
título, descripción, prioridad y **captura obligatoria** (imagen o vídeo). El
admin/manager ve la lista completa con preview ampliable y puede generar un
**prompt formateado para Claude Code** que implementa la mejora.

---

## 1. Características diferenciales

- 🔒 **Bucket privado** con signed URLs temporales (no público)
- 📥 **3 formas de subir captura**: click, drag & drop, paste (Ctrl+V)
- 🎯 **Drawer desde la derecha** (no fullscreen) con overlay transparente — la
  app de detrás se sigue viendo normal
- 🪟 **Plegable**: botón minimizar conserva todo el form intacto; tab vertical
  pegada a la derecha para restaurar
- 🔍 **Lightbox** con zoom (rueda/teclas), desplazamiento, atajos de teclado
- 🤖 **Botón "Copiar prompt para Claude"** que genera un prompt formateado con
  todo el contexto técnico + signed URL de 7 días para que Claude lea la captura
- 🛡️ **Anti-suplantación**: el path del adjunto se valida server-side contra el
  ID del usuario autenticado

---

## 2. Stack

- **Frontend**: Next.js 16 App Router + React 18 (`'use client'`)
- **Backend**: Route handlers (Next.js API routes), runtime Node.js
- **BD**: Supabase Postgres con RLS
- **Auth**: Supabase Auth (cookies SSR via `@supabase/ssr`)
- **Storage**: Supabase Storage (bucket **privado** con signed URLs)
- **Iconos**: `lucide-react`
- **Estilos**: CSS variables del sistema (Tailwind opcional)

---

## 3. Modelo de datos

### Tabla `public.improvements`

```sql
create table if not exists public.improvements (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text not null default '',
  -- attachment_url guarda el PATH interno del bucket (ej. "userId/timestamp-rand.png")
  -- El cliente NUNCA recibe el path en raw; los endpoints lo traducen a signed URL.
  attachment_url      text not null,
  type                text not null default 'mejora',  -- 'bug' | 'mejora' | 'idea'
  priority            text not null default 'media',   -- 'baja' | 'media' | 'alta'
  status              text not null default 'pendiente',
  -- 'pendiente' | 'revisada' | 'completada' | 'descartada'
  created_by          uuid references public.profiles(id) on delete set null,
  created_by_email    text,
  created_by_name     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_improvements_status     on public.improvements(status);
create index if not exists idx_improvements_type       on public.improvements(type);
create index if not exists idx_improvements_priority   on public.improvements(priority);
create index if not exists idx_improvements_created_at on public.improvements(created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.improvements enable row level security;

-- Lectura: solo admin/manager
drop policy if exists improvements_select on public.improvements;
create policy improvements_select on public.improvements for select
  using (public.is_admin_or_manager());

-- Inserción: cualquier usuario activo
drop policy if exists improvements_insert on public.improvements;
create policy improvements_insert on public.improvements for insert
  with check (public.is_active_user());

-- Update: solo admin/manager
drop policy if exists improvements_update on public.improvements;
create policy improvements_update on public.improvements for update
  using (public.is_admin_or_manager());

-- Delete: solo admin
drop policy if exists improvements_delete on public.improvements;
create policy improvements_delete on public.improvements for delete
  using (public.is_admin());

-- Trigger updated_at
drop trigger if exists trg_improvements_updated_at on public.improvements;
create trigger trg_improvements_updated_at
  before update on public.improvements
  for each row execute function public.set_updated_at_generic();
```

> **Requisito previo**: las funciones helper `public.is_admin_or_manager()`,
> `public.is_active_user()`, `public.is_admin()` y `public.set_updated_at_generic()`
> deben existir. Ver sección 11 al final.

### Bucket Storage `improvements`

Crear desde **Supabase Dashboard → Storage → New bucket**:

- **Nombre**: `improvements`
- **Public bucket**: ❌ **DESACTIVADO** (privado)
- **File size limit**: `52428800` (50 MB)
- **Allowed MIME types**: `image/*, video/*`

### Storage policies

```sql
-- 1) INSERT: cualquier usuario activo puede subir capturas a su propia carpeta
drop policy if exists "Active users can upload improvements"
  on storage.objects;
create policy "Active users can upload improvements"
  on storage.objects for insert
  with check (
    bucket_id = 'improvements'
    and auth.uid() is not null
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and active = true
    )
  );

-- 2) SELECT: NO se define. Solo el server con service_role puede leer (genera
--    signed URLs). El cliente no accede directo al bucket privado.

-- 3) DELETE: el dueño puede borrar su propia subida (útil para cleanup tras
--    fallo de inserción en la BD).
drop policy if exists "Users can delete own improvement uploads"
  on storage.objects;
create policy "Users can delete own improvement uploads"
  on storage.objects for delete
  using (
    bucket_id = 'improvements'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 4. Tipos TypeScript

`src/types/database.ts`:

```ts
export type ImprovementType     = 'bug' | 'mejora' | 'idea'
export type ImprovementPriority = 'baja' | 'media' | 'alta'
export type ImprovementStatus   = 'pendiente' | 'revisada' | 'completada' | 'descartada'

export interface Improvement {
  id:                string
  title:             string
  description:       string
  // En BD guarda el PATH interno del bucket privado.
  // Cuando el GET devuelve este campo al cliente, ya está traducido a signed URL temporal.
  attachment_url:    string
  type:              ImprovementType
  priority:          ImprovementPriority
  status:            ImprovementStatus
  created_by:        string | null
  created_by_email:  string | null
  created_by_name:   string | null
  created_at:        string
  updated_at:        string
}
```

---

## 5. API endpoints

Patrón común — helper de auth reutilizable:

```ts
async function requireActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, email, full_name, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'email' | 'full_name' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin, user }
}

const isPriv = (role: string) => role === 'admin' || role === 'manager'
```

### 5.1 — `GET /api/improvements` (lista) + `POST` (crear)

`src/app/api/improvements/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Improvement, ImprovementPriority, ImprovementType, Profile,
} from '@/types/database'

const TYPES:      ImprovementType[]     = ['bug', 'mejora', 'idea']
const PRIORITIES: ImprovementPriority[] = ['baja', 'media', 'alta']

// (requireActor + isPriv idénticos al patrón común)

// GET — solo admin/manager. Traduce el path interno → signed URL de 1h.
export async function GET(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  if (!isPriv(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  let query = admin
    .from('improvements').select('*')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query.returns<Improvement[]>()
  if (error) {
    console.error('[improvements/GET]', error.message)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  // attachment_url en BD guarda el PATH interno → traducir a signed URL temporal (1h).
  const items = data ?? []
  const enriched = await Promise.all(items.map(async (it) => {
    const path = it.attachment_url
    if (!path) return it
    const { data: signed } = await admin.storage
      .from('improvements').createSignedUrl(path, 3600)
    return { ...it, attachment_url: signed?.signedUrl ?? '' }
  }))

  return NextResponse.json(enriched)
}

// POST — cualquier usuario activo. Recibe attachment_path (NO URL).
export async function POST(req: NextRequest) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth

  let body: Partial<Improvement> & { attachment_path?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const title = (body.title ?? '').toString().trim()
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: 'title_too_long' }, { status: 400 })

  // Path interno del bucket privado. El cliente NUNCA nos envía URL.
  const attachmentPath = (body.attachment_path ?? '').toString().trim()
  if (!attachmentPath) {
    return NextResponse.json({ error: 'attachment_required' }, { status: 400 })
  }

  // Validación: formato seguro
  if (
    attachmentPath.length > 300 ||
    attachmentPath.includes('..') ||
    attachmentPath.startsWith('/') ||
    !/^[A-Za-z0-9_\-./]+$/.test(attachmentPath)
  ) {
    return NextResponse.json({ error: 'invalid_attachment_path' }, { status: 400 })
  }

  // Anti-suplantación: el path debe arrancar con el id del usuario que sube
  if (!attachmentPath.startsWith(`${me.id}/`)) {
    return NextResponse.json({ error: 'invalid_attachment_path' }, { status: 400 })
  }

  const type = (body.type ?? 'mejora') as ImprovementType
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  const priority = (body.priority ?? 'media') as ImprovementPriority
  if (!PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'invalid_priority' }, { status: 400 })
  }

  const description = (body.description ?? '').toString().trim().slice(0, 2000)

  const insertRow = {
    title,
    description,
    attachment_url: attachmentPath,  // guarda el PATH, no la URL
    type,
    priority,
    status: 'pendiente',
    created_by: me.id,
    created_by_email: me.email,
    created_by_name: me.full_name,
  }

  const { data, error } = await admin
    .from('improvements')
    .insert(insertRow as never)
    .select('*').single<Improvement>()
  if (error) {
    console.error('[improvements/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
```

### 5.2 — `PATCH /api/improvements/[id]` + `DELETE`

`src/app/api/improvements/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Improvement, ImprovementStatus, Profile } from '@/types/database'

const STATUSES: ImprovementStatus[] = ['pendiente', 'revisada', 'completada', 'descartada']

// PATCH — solo admin/manager. Solo cambia status.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (!isPriv(me.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { status?: ImprovementStatus }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  if (!body.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('improvements')
    .update({ status: body.status } as never)
    .eq('id', id)
    .select('*').single<Improvement>()
  if (error) {
    console.error('[improvements/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE — solo admin
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id } = await ctx.params

  if (me.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin.from('improvements').delete().eq('id', id)
  if (error) {
    console.error('[improvements/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

### 5.3 — `GET /api/improvements/[id]/claude-prompt`

Genera un prompt formateado con signed URL de 7 días para que Claude tenga
tiempo de leer la captura.

`src/app/api/improvements/[id]/claude-prompt/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Improvement, Profile } from '@/types/database'

const TYPE_LABEL: Record<string, string> = {
  bug:    'BUG (algo que no funciona)',
  mejora: 'MEJORA (algo que se puede pulir)',
  idea:   'IDEA NUEVA (funcionalidad que no existe)',
}
const PRIORITY_LABEL: Record<string, string> = {
  baja:  'baja (puede esperar)',
  media: 'media (cuanto antes)',
  alta:  'ALTA (urgente)',
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  const { data: imp, error } = await admin
    .from('improvements').select('*').eq('id', id)
    .single<Improvement>()
  if (error || !imp) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Signed URL de 7 días para que Claude tenga tiempo de leer la captura.
  const SEVEN_DAYS = 60 * 60 * 24 * 7
  const { data: signed } = await admin.storage
    .from('improvements').createSignedUrl(imp.attachment_url, SEVEN_DAYS)
  const attachmentSignedUrl = signed?.signedUrl ?? '(no se pudo generar URL temporal)'

  const senderName  = imp.created_by_name || imp.created_by_email?.split('@')[0] || 'Usuario'
  const senderEmail = imp.created_by_email || '(sin email)'
  const fechaLocal = new Date(imp.created_at).toLocaleString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const prompt = `Tarea para [TU_APP]: ${TYPE_LABEL[imp.type] ?? imp.type} · prioridad ${PRIORITY_LABEL[imp.priority] ?? imp.priority}

═══ TÍTULO ═══
${imp.title}

═══ DESCRIPCIÓN DEL USUARIO ═══
${imp.description || '(sin descripción adicional)'}

═══ CAPTURA DE PANTALLA ═══
${attachmentSignedUrl}
(URL temporal válida 7 días — usa Read/WebFetch para verla)

═══ CONTEXTO TÉCNICO ═══
- App: [nombre-del-proyecto]
- Repo: [usuario/repo] (rama master)
- Working directory: [ruta absoluta del proyecto]
- Reportado por: ${senderName} (${senderEmail})
- Fecha: ${fechaLocal}
- ID interno: ${imp.id}

═══ INSTRUCCIONES ═══
1. Lee la captura de pantalla del usuario para entender el problema visualmente.
2. Localiza el código afectado (usa Grep/Glob).
3. Implementa el cambio respetando los patrones del codebase existente
   (autenticación, errores sanitizados, RLS, etc.).
4. Verifica con: npx tsc --noEmit && npx eslint src --max-warnings=0
5. Commit con mensaje descriptivo + git push origin master
   (auto-deploy en CI/CD)
6. Resume al usuario qué cambios hiciste y dónde.
`

  return NextResponse.json({ prompt })
}
```

> Reemplaza `[TU_APP]`, `[nombre-del-proyecto]`, `[usuario/repo]` y la ruta del
> working directory por los valores reales de tu proyecto.

---

## 6. UI · Drawer "Sugerir mejoras"

`src/components/SuggestImprovementDrawer.tsx` — componente self-contained con:

### Estados y lógica

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Send, CheckCircle2, Bug, Wrench, Sparkles,
  AlertTriangle, Zap, Upload, Trash2, Loader2, Image as ImageIcon,
  ChevronsRight, ChevronsLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ImprovementType, ImprovementPriority } from '@/types/database'

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

  // Reset al cerrar
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setType('mejora'); setTitle(''); setPriority('media'); setDescription('')
      setFile(null); setFilePreview(null); setFileError(null)
      setSentOk(false); setGeneralError(null); setMinimized(false)
    }, 250)
    return () => clearTimeout(t)
  }, [open])

  // Cleanup objectURL del preview
  useEffect(() => {
    if (!filePreview) return
    return () => { URL.revokeObjectURL(filePreview) }
  }, [filePreview])

  // ESC: expandido → minimizar; minimizado → cerrar
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

  // acceptFile — declarado ANTES del useEffect del paste
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
  }

  // Pegar imagen desde portapapeles
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) { e.preventDefault(); acceptFile(f); return }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open])

  const canSubmit = title.trim().length > 0 && !!file && !sending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !file) return
    setSending(true)
    setGeneralError(null)
    try {
      // 1) Subir adjunto al bucket privado
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

      // 2) Crear improvement con el PATH interno
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
        // Cleanup del archivo huérfano en Storage
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
        style={{
          position: 'fixed', top: '50%', right: 0,
          transform: open && minimized ? 'translate(0, -50%)' : 'translate(100%, -50%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          width: 44, padding: '14px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          background: '#fff', border: '1px solid #e2e8f0', borderRight: 'none',
          borderRadius: '10px 0 0 10px',
          boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.10)',
          cursor: 'pointer', zIndex: 80,
        }}
      >
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          color: '#b45309',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={14} />
        </span>
        <ChevronsLeft size={16} style={{ color: '#64748b' }} />
        {(title.trim() || description.trim() || file) && (
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: '#f59e0b',
            boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.20)',
          }} />
        )}
      </button>

      {/* Drawer principal — SIN overlay difuminado */}
      <aside
        aria-label="Sugerir mejora"
        aria-hidden={!open || minimized}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(560px, 100vw)',
          background: '#ffffff',
          boxShadow: '-12px 0 48px rgba(15, 23, 42, 0.18)',
          transform: open && !minimized ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          zIndex: 80,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0', borderRight: 'none',
        }}
      >
        {/* Header con icono ✨ + título + botones minimizar / cerrar */}
        {/* Form con: tipo (3 cards), título, prioridad (3 chips),
            descripción, dropzone con drag+paste, preview, error, footer */}
        {/* Ver el código completo en el repo */}
      </aside>
    </>
  )
}
```

### Integración en el AppShell

```tsx
import { SuggestImprovementDrawer } from '@/components/SuggestImprovementDrawer'

const [suggestOpen, setSuggestOpen] = useState(false)

// Botón del sidebar:
<button
  type="button"
  className="nav-button"
  onClick={() => setSuggestOpen(true)}
  title="Sugerir mejoras"
>
  <MessageSquarePlus />
  <span>Sugerir mejoras</span>
</button>

// Al final del shell, montar el drawer globalmente:
<SuggestImprovementDrawer
  open={suggestOpen}
  onClose={() => setSuggestOpen(false)}
  userId={profile?.user_id ?? null}
/>
```

---

## 7. UI · Tab Admin con lightbox

`src/components/admin/ImprovementsTab.tsx`:

- Filtros por estado con contadores (Pendientes / Revisadas / Completadas / Descartadas)
- Cards con borde izquierdo del color del tipo
- Modal detalle con captura **clickable que abre lightbox fullscreen**

### Lightbox de la captura

```tsx
function ImageLightbox({
  src, alt, onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ startX, startY, baseX, baseY } | null>(null)

  // ESC cierra, +/- zoom, 0 reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z * 1.25, 4))
      if (e.key === '-') setZoom(z => Math.max(z / 1.25, 0.5))
      if (e.key === '0') { setZoom(1); setTranslate({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Translate efectivo: si no hay zoom, ignora desplazamiento
  const effectiveTranslate = zoom > 1 ? translate : { x: 0, y: 0 }

  // onWheel zoom in/out
  // onMouseDown/Move/Up arrastrar cuando zoom > 1
  // Toolbar con zoom-, %, zoom+, 1:1, X
  // Pie con atajos visibles

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: zoom > 1 ? 'grab' : 'zoom-out',
      }}
    >
      {/* Toolbar + imagen con transform */}
    </div>
  )
}
```

### Botón "Copiar prompt para Claude"

```tsx
const handleCopyPrompt = async () => {
  setCopying(true)
  try {
    const res = await fetch(`/api/improvements/${item.id}/claude-prompt`)
    if (!res.ok) {
      toast('Error generando prompt', 'error')
      return
    }
    const { prompt } = await res.json() as { prompt: string }
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast('Prompt copiado — pégalo en Claude Code', 'success')
    setTimeout(() => setCopied(false), 2500)
  } finally { setCopying(false) }
}

// Botón con gradiente naranja cuando idle, verde cuando copiado:
<button
  onClick={handleCopyPrompt}
  disabled={copying}
  style={{
    background: copied
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
    color: '#fff', fontWeight: 700,
    boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
    // ...
  }}
>
  {copying ? <Loader2 className="animate-spin" /> : copied ? <ClipboardCheck /> : <CopyIcon />}
  {copying ? 'Generando…' : copied ? 'Copiado · pégalo en Claude' : 'Copiar prompt para Claude'}
</button>
```

---

## 8. Estados del workflow

```
pendiente  →  revisada  →  completada
     ↓           ↓
     └───────────┴── descartada (reabrir → pendiente)
```

Transiciones permitidas (todas vía PATCH):
- `pendiente` → `revisada` / `completada` / `descartada`
- `revisada` → `completada` / `descartada` / `pendiente`
- `completada` / `descartada` → `pendiente` (reabrir)

---

## 9. Permisos / gating

| Acción | Quién |
|---|---|
| Crear sugerencia | Cualquier usuario activo |
| Ver listado completo | admin + manager |
| Cambiar estado | admin + manager |
| Eliminar | solo admin |
| Generar prompt Claude | admin + manager |

Implementación:
- `requireActor()` exige `profile.active = true` en TODOS los endpoints
- `isPriv(role)` filtra acciones admin/manager
- DELETE filtra solo admin
- RLS de tabla + Storage policies refuerzan a nivel BD (defensa en profundidad)

---

## 10. Checklist de réplica

```
[ ] 1. Crear tabla 'improvements' (SQL del punto 3)
[ ] 2. Crear bucket 'improvements' PRIVADO en Supabase Storage
       (limit 50MB, MIME image/*,video/*)
[ ] 3. Aplicar storage policies (INSERT + DELETE)
[ ] 4. Añadir tipos TS en src/types/database.ts (punto 4)
[ ] 5. Crear /api/improvements/route.ts (GET + POST)
[ ] 6. Crear /api/improvements/[id]/route.ts (PATCH + DELETE)
[ ] 7. Crear /api/improvements/[id]/claude-prompt/route.ts (GET)
[ ] 8. Crear src/components/SuggestImprovementDrawer.tsx
[ ] 9. Crear src/components/admin/ImprovementsTab.tsx con lightbox
[ ] 10. Integrar drawer en AppShell + botón del sidebar
[ ] 11. Añadir tab "Sugerencias" en /admin
[ ] 12. Confirmar lucide-react instalado
[ ] 13. Verificar helpers SQL (is_admin, is_admin_or_manager,
        is_active_user, set_updated_at_generic) — ver sección 11
[ ] 14. Personalizar prompt de Claude (nombre app, repo, working dir)
[ ] 15. Test end-to-end:
        a) Abrir drawer, subir con drag+click+paste → enviar
        b) Verificar en /admin → Sugerencias que aparece
        c) Abrir detalle, click en captura → lightbox abre
        d) Click "Copiar prompt" → pegar en notepad y revisar URL
```

---

## 11. Funciones helper SQL (prerequisito)

Si tu proyecto no las tiene aún, crea estos helpers de RLS reutilizables:

```sql
-- Helpers de RLS — security definer para que la policy los pueda llamar
create or replace function public.is_active_user()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  );
$$;

create or replace function public.is_admin_or_manager()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'manager')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'admin'
  );
$$;

-- Trigger genérico de updated_at
create or replace function public.set_updated_at_generic()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

> Adapta `public.profiles` y los nombres de columnas (`role`, `active`) si tu
> schema de usuarios usa otros nombres.

---

## 12. Decisiones técnicas y por qué

### Bucket privado en lugar de público
**Por qué**: las capturas pueden contener info sensible (datos de clientes, copys
sin aprobar, KPIs internos). URLs públicas permanentes sin auditoría = riesgo de
leak. Privado + signed URLs temporales = control total.

### Cliente envía `attachment_path`, no `attachment_url`
**Por qué**: anti-SSRF total. El cliente jamás puede meter URLs externas. El
server valida que el path siga el patrón `${userId}/...` y solo permite caracteres
seguros (`A-Za-z0-9_\-./`).

### `attachment_url` en BD guarda el PATH (no URL)
**Por qué**: la URL firmada caduca cada hora. El path es estable. Cuando el
endpoint GET devuelve los items al cliente, los enriquece con signed URLs
frescas en el momento. El campo se llama `attachment_url` por compatibilidad
histórica (la migración inicial), pero documentado en código que contiene path.

### Signed URLs de 1h para el listado admin, 7 días para el prompt Claude
**Por qué**: el admin ve la lista en ~1h máximo (no necesita más). El prompt
Claude puede tardar días en procesarse (un humano lo copia, lo pega, Claude lo
ejecuta), por eso 7 días.

### Drawer SIN overlay difuminado
**Por qué**: el usuario quiere seguir VIENDO lo que hay en la pantalla mientras
describe la mejora — ya está mirando el contexto del bug, no tiene sentido
ocultárselo.

### Botón "minimizar" preserva todo el form
**Por qué**: a veces necesitas plegar el drawer para inspeccionar la pantalla
con más detalle. Cerrar perdería el draft. Minimizar deja una tab vertical
pegada a la derecha que avisa con un punto naranja si hay contenido sin enviar.

### Lightbox con zoom y desplazamiento
**Por qué**: el thumbnail del modal es 380px. A veces el bug está en texto
pequeño o un detalle concreto. El admin necesita ver la captura al detalle
antes de copiar el prompt para Claude (sobre todo si Claude tiene dudas con
una imagen pequeña).

### Botón "Copiar prompt para Claude" en lugar de integración directa
**Por qué**: la forma más simple y barata. No requiere infra adicional, ni API
key de Anthropic, ni costes de tokens. El admin lee el prompt antes de pegarlo,
puede ajustar contexto si quiere. Si en el futuro hay mucho volumen, se puede
montar un webhook al Claude Agent SDK headless — pero no se necesita ahora.

---

## 13. Mejoras opcionales (no implementadas, ideas para tu app)

- **Notificaciones por email/Slack al admin** al crear una sugerencia (webhook
  Supabase o cron). En iGEO se gestiona con scan manual en `/admin`.
- **Comentarios bidireccionales** (tabla `improvement_comments`) para que el
  admin responda al autor.
- **Vista para el autor** (`/mis-mejoras`) filtrando por `created_by = me.id`.
- **Voto / +1** (tabla `improvement_votes`) para priorizar comunidad.
- **Asignación** (`assigned_to_user_id`) si tienes varios devs.
- **Tags / categorías** array para filtrar por área (`frontend`, `backend`,
  `ux`...).
- **Captura DOM en lugar de imagen**: el cliente podría capturar `outerHTML` +
  `getBoundingClientRect()` del elemento bajo el cursor — Claude tendría aún
  más contexto. Más complejo de implementar.
- **Integración Claude Agent SDK headless**: en lugar de copiar el prompt al
  portapapeles, un endpoint server que invoca el SDK con la API key del
  organisation y devuelve un PR de GitHub abierto automáticamente. Coste real
  $0.5-2 por mejora.
