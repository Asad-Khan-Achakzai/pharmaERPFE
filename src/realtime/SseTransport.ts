'use client'

import type { RealtimeEvent, RealtimeHandler, RealtimeTransport } from '@/realtime/types'

function apiBase(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')
  if (base.endsWith('/api/v1')) return base
  return `${base}/api/v1`
}

const MAX_RECONNECT_MS = 60_000

export class SseTransport implements RealtimeTransport {
  private source: EventSource | null = null
  private handlers = new Set<RealtimeHandler>()
  private token: string | null = null
  private channels: string[] = ['live-map']
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  connect(accessToken: string, channels: string[] = ['live-map']) {
    this.stopped = false
    this.token = accessToken
    this.channels = channels.length ? channels : ['live-map']
    this.open()
  }

  private open() {
    this.closeSource()
    if (!this.token || this.stopped) return

    const channelParam = encodeURIComponent(this.channels.join(','))
    const url = `${apiBase()}/realtime/stream?channel=${channelParam}&token=${encodeURIComponent(this.token)}`
    this.source = new EventSource(url)

    this.source.onopen = () => {
      this.reconnectAttempt = 0
    }

    this.source.onmessage = (msg) => {
      this.dispatch(msg.data)
    }

    this.source.addEventListener('rep.location.updated', (msg) => {
      this.dispatch((msg as MessageEvent).data)
    })

    this.source.addEventListener('notification.created', (msg) => {
      this.dispatch((msg as MessageEvent).data)
    })

    this.source.onerror = () => {
      this.closeSource()
      if (this.stopped) return
      const delay = Math.min(MAX_RECONNECT_MS, 1000 * 2 ** this.reconnectAttempt)
      this.reconnectAttempt += 1
      this.reconnectTimer = setTimeout(() => this.open(), delay)
    }
  }

  private dispatch(raw: string) {
    try {
      const event = JSON.parse(raw) as RealtimeEvent
      this.handlers.forEach((h) => h(event))
    } catch {
      /* ignore malformed */
    }
  }

  private closeSource() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.source?.close()
    this.source = null
  }

  disconnect() {
    this.stopped = true
    this.closeSource()
    this.token = null
  }

  subscribe(handler: RealtimeHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  isConnected(): boolean {
    return this.source?.readyState === EventSource.OPEN
  }
}

export const sseTransport = new SseTransport()
