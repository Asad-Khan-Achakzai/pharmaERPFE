'use client'

import { sseTransport } from '@/realtime/SseTransport'
import type { RealtimeEvent } from '@/realtime/types'

/** @deprecated Use sseTransport from SseTransport.ts */
export type { RealtimeEvent }

export class SseClient {
  connect(accessToken: string, channel = 'live-map') {
    sseTransport.connect(accessToken, [channel])
  }

  subscribe(handler: (event: RealtimeEvent) => void) {
    return sseTransport.subscribe(handler)
  }

  disconnect() {
    sseTransport.disconnect()
  }
}

export const sseClient = new SseClient()
