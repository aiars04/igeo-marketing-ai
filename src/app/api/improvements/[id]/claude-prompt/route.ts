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

/**
 * GET /api/improvements/[id]/claude-prompt
 *
 * Devuelve el prompt formateado listo para pegar en Claude Code y que
 * implemente la mejora. Solo admin/manager.
 */
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

  const senderName = imp.created_by_name || imp.created_by_email?.split('@')[0] || 'Usuario'
  const senderEmail = imp.created_by_email || '(sin email)'
  const fechaLocal = new Date(imp.created_at).toLocaleString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const prompt = `Tarea para iGEO Marketing AI: ${TYPE_LABEL[imp.type] ?? imp.type} · prioridad ${PRIORITY_LABEL[imp.priority] ?? imp.priority}

═══ TÍTULO ═══
${imp.title}

═══ DESCRIPCIÓN DEL USUARIO ═══
${imp.description || '(sin descripción adicional)'}

═══ CAPTURA DE PANTALLA ═══
${imp.attachment_url}

═══ CONTEXTO TÉCNICO ═══
- App: igeo-marketing-ai (Next.js 16 + Supabase + Gemini)
- Repo: aiars04/igeo-marketing-ai (rama master)
- Working directory: C:\\Users\\Adrian Ruiz\\Desktop\\claude code\\Proyectos\\Proyectos Externos\\Marketing\\igeo-marketing-ai
- Reportado por: ${senderName} (${senderEmail})
- Fecha: ${fechaLocal}
- ID interno: ${imp.id}

═══ INSTRUCCIONES ═══
1. Lee la captura de pantalla del usuario para entender el problema visualmente.
2. Localiza el código afectado (usa Grep/Glob).
3. Implementa el cambio respetando los patrones del codebase existente
   (autenticación con requireActor, errores sanitizados, RLS, etc.).
4. Verifica con: npx tsc --noEmit && npx eslint src --max-warnings=0
5. Commit con mensaje descriptivo + git push origin master
   (Vercel hará auto-deploy)
6. Resume al usuario qué cambios hiciste y dónde.
`

  return NextResponse.json({ prompt })
}
