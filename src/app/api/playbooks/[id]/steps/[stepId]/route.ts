import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PlaybookStep, PlaybookTaskType, Profile } from '@/types/database'

const TASK_TYPES: PlaybookTaskType[] = [
  'post', 'email', 'newsletter', 'landing', 'reminder',
  'follow_up', 'blog', 'video', 'banner', 'pdf',
]

async function requireActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { profile, admin }
}

const isPriv = (role: string) => role === 'admin' || role === 'manager'

// PATCH /api/playbooks/[id]/steps/[stepId]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; stepId: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { stepId } = await ctx.params

  if (!isPriv(me.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: Partial<PlaybookStep>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.step_order !== undefined) patch.step_order = body.step_order
  if (body.relative_day_offset !== undefined) patch.relative_day_offset = body.relative_day_offset
  if (body.channel !== undefined) patch.channel = body.channel
  if (body.content_type !== undefined) patch.content_type = body.content_type
  if (body.task_type !== undefined) {
    if (!TASK_TYPES.includes(body.task_type as PlaybookTaskType)) {
      return NextResponse.json({ error: 'invalid_task_type' }, { status: 400 })
    }
    patch.task_type = body.task_type
  }
  if (body.title_template !== undefined) patch.title_template = body.title_template
  if (body.instructions !== undefined) patch.instructions = body.instructions
  if (body.required !== undefined) patch.required = !!body.required
  if (body.approval_gate !== undefined) patch.approval_gate = !!body.approval_gate
  if (body.depends_on_step_id !== undefined) patch.depends_on_step_id = body.depends_on_step_id

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('playbook_steps')
    .update(patch as never)
    .eq('id', stepId)
    .select('*')
    .single<PlaybookStep>()
  if (error) {
    console.error('[playbook_steps/PATCH]', error.message)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/playbooks/[id]/steps/[stepId]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; stepId: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { stepId } = await ctx.params

  if (!isPriv(me.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await admin.from('playbook_steps').delete().eq('id', stepId)
  if (error) {
    console.error('[playbook_steps/DELETE]', error.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
