'use client'

type RealtimeHandler = (event: RealtimeEvent) => void

export interface RealtimeEvent {
  channel: string
  type: string
  payload: Record<string, unknown>
  ts: string
  companyId: string
}

function apiBase(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')
  if (base.endsWith('/api/v1')) return base
  return `${base}/api/v1`
}

export class SseClient {
  private source: EventSource | null = null
  private handlers = new Set<RealtimeHandler>()
  private channel = 'live-map'

  connect(accessToken: string, channel = 'live-map') {
    this.disconnect()
    this.channel = channel
    const url = `${apiBase()}/realtime/stream?channel=${encodeURIComponent(channel)}&token=${encodeURIComponent(accessToken)}`
    this.source = new EventSource(url)

    this.source.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as RealtimeEvent
        this.handlers.forEach((h) => h(event))
      } catch {
        /* ignore malformed */
      }
    }

    this.source.addEventListener('rep.location.updated', (msg) => {
      try {
        const event = JSON.parse((msg as MessageEvent).data) as RealtimeEvent
        this.handlers.forEach((h) => h(event))
      } catch {
        /* ignore */
      }
    })

    this.source.onerror = () => {
      this.disconnect()
    }
  }

  subscribe(handler: RealtimeHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect() {
    this.source?.close()
    this.source = null
  }
}

export const sseClient = new SseClient()
