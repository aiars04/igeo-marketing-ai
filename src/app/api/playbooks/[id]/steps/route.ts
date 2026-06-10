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

// POST /api/playbooks/[id]/steps
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireActor()
  if ('response' in auth) return auth.response
  const { profile: me, admin } = auth
  const { id: playbookId } = await ctx.params

  if (!isPriv(me.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: Partial<PlaybookStep>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const taskType = body.task_type as PlaybookTaskType
  if (!taskType || !TASK_TYPES.includes(taskType)) {
    return NextResponse.json({ error: 'invalid_task_type' }, { status: 400 })
  }

  // Si no se especifica step_order, lo calculamos automáticamente
  let stepOrder = body.step_order
  if (stepOrder === undefined || stepOrder === null) {
    const { data: last } = await admin
      .from('playbook_steps')
      .select('step_order')
      .eq('playbook_id', playbookId)
      .order('step_order', { ascending: false })
      .limit(1)
      .maybeSingle<{ step_order: number }>()
    stepOrder = (last?.step_order ?? -1) + 1
  }

  const insertRow = {
    playbook_id: playbookId,
    step_order: stepOrder,
    relative_day_offset: body.relative_day_offset ?? 0,
    channel: body.channel ?? null,
    content_type: body.content_type ?? null,
    task_type: taskType,
    title_template: body.title_template ?? null,
    instructions: body.instructions ?? null,
    required: body.required ?? true,
    approval_gate: body.approval_gate ?? true,
    depends_on_step_id: body.depends_on_step_id ?? null,
  }

  const { data, error } = await admin
    .from('playbook_steps')
    .insert(insertRow as never)
    .select('*')
    .single<PlaybookStep>()
  if (error) {
    console.error('[playbook_steps/POST]', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  return NextResponse.json(data)
}
