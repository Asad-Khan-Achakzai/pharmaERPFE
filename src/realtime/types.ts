export interface RealtimeEvent {
  channel: string
  type: string
  payload: Record<string, unknown>
  ts: string
  companyId: string
}

export type RealtimeHandler = (event: RealtimeEvent) => void

export interface RealtimeTransport {
  connect(accessToken: string, channels: string[]): void
  disconnect(): void
  subscribe(handler: RealtimeHandler): () => void
  isConnected(): boolean
}
