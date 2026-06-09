'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PostizChannel {
  id: string
  name: string
  identifier: string
  picture: string | null
  disabled: boolean
  profile: string | null
}

export interface PublishOptions {
  channelIds: string[]
  content: string
  imageUrl?: string
  scheduledAt?: string       // ISO — si no se pasa, publica ahora
  type?: 'schedule' | 'draft' | 'now'
}

export interface PublishResult {
  ok: boolean
  type: string
  channelIds: string[]
  result?: unknown
  error?: string
}

// ─── Hook: canales disponibles en Postiz ─────────────────────────────────────

export function usePostizChannels() {
  const [channels, setChannels] = useState<PostizChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch('/api/postiz/channels')
      .then((r) => r.json())
      .then((data: { channels?: PostizChannel[]; error?: string }) => {
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        setChannels(data.channels ?? [])
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error de red')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { channels, loading, error }
}

// ─── Hook: publicar en Postiz ─────────────────────────────────────────────────

export function usePostizPublish() {
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)

  const publish = useCallback(async (opts: PublishOptions): Promise<PublishResult> => {
    setPublishing(true)
    setResult(null)
    try {
      const res = await fetch('/api/postiz/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      })
      const data: PublishResult = await res.json()
      setResult(data)
      return data
    } catch (e) {
      const err: PublishResult = { ok: false, type: '', channelIds: [], error: e instanceof Error ? e.message : 'Error de red' }
      setResult(err)
      return err
    } finally {
      setPublishing(false)
    }
  }, [])

  return { publish, publishing, result }
}

// ─── Hook: estado de conexión ─────────────────────────────────────────────────

export function usePostizStatus() {
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/postiz/status')
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setConnected(d.connected))
      .catch(() => setConnected(false))
  }, [])

  return connected
}
