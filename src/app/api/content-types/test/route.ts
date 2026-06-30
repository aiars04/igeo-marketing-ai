import { NextRequest, NextResponse } from 'next/server'
import { genai } from '@/lib/gemini'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Profile, Channel } from '@/types/database'

const VALID_CHANNELS: Channel[] = ['linkedin','instagram','facebook','x','blog','email','newsletter']

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('id, role, active').eq('id', user.id)
    .single<Pick<Profile, 'id' | 'role' | 'active'>>()
  if (!profile || !profile.active) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Rate-limit: 10 previews/min por usuario (Gemini)
  const rl = checkRateLimit(`ct-test:${user.id}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', resetInMs: rl.resetInMs },
      { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetInMs / 1000).toString() } },
    )
  }

  let body: { process?: string; style?: string; channel?: string; example_title?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const processInstr = body.process?.trim()
  const styleInstr = body.style?.trim()
  const channel = body.channel as Channel
  const example_title = body.example_title?.trim() || 'Ejemplo de contenido para iGEO'

  if (!processInstr || !styleInstr) return NextResponse.json({ error: 'process_and_style_required' }, { status: 400 })
  if (!channel || !VALID_CHANNELS.includes(channel)) return NextResponse.json({ error: 'invalid_channel' }, { status: 400 })

  const systemPrompt = `Eres un copywriter B2B para iGEO (ERP especializado en sanidad ambiental, control de plagas y Legionella).
Genera un EJEMPLO BREVE (máx 150 palabras) que ilustre cómo será el copy producido con estas instrucciones.
PROCESO: ${processInstr}
ESTILO: ${styleInstr}
CANAL: ${channel}
Devuelve SOLO el ejemplo, sin meta-comentarios ni explicaciones tuyas.`

  try {
    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Genera un ejemplo breve para un contenido titulado: "${example_title}"` }] }],
      config: { systemInstruction: systemPrompt, maxOutputTokens: 500 },
    })
    const preview = (res.text ?? '').trim()
    if (!preview) return NextResponse.json({ error: 'empty_response' }, { status: 502 })
    return NextResponse.json({ preview })
  } catch (err: unknown) {
    console.error('[content-types/test]', err instanceof Error ? err.message : err)
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    const isTransient = msg.includes('unavailable') || msg.includes('exhausted') || msg.includes('quota')
    return NextResponse.json(
      { error: isTransient ? 'models_unavailable' : 'test_failed' },
      { status: isTransient ? 503 : 500 },
    )
  }
}
