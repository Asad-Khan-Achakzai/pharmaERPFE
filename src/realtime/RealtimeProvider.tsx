'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { sseClient, type RealtimeEvent } from './sseClient'

interface RealtimeContextValue {
  connected: boolean
  subscribe: (channel: string, handler: (event: RealtimeEvent) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const channelHandlers = useRef(new Map<string, Set<(event: RealtimeEvent) => void>>())

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) {
      sseClient.disconnect()
      setConnected(false)
      return undefined
    }

    sseClient.connect(token, 'live-map')
    setConnected(true)

    const off = sseClient.subscribe((event) => {
      const set = channelHandlers.current.get(event.channel)
      set?.forEach((h) => h(event))
    })

    return () => {
      off()
      sseClient.disconnect()
      setConnected(false)
    }
  }, [])

  const subscribe = useCallback((channel: string, handler: (event: RealtimeEvent) => void) => {
    if (!channelHandlers.current.has(channel)) {
      channelHandlers.current.set(channel, new Set())
    }
    channelHandlers.current.get(channel)!.add(handler)
    return () => {
      channelHandlers.current.get(channel)?.delete(handler)
    }
  }, [])

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtimeChannel(
  channel: string,
  handler: (event: RealtimeEvent) => void,
  enabled = true
) {
  const ctx = useContext(RealtimeContext)
  useEffect(() => {
    if (!ctx || !enabled) return undefined
    return ctx.subscribe(channel, handler)
  }, [ctx, channel, handler, enabled])
}

export function useRealtimeStatus() {
  const ctx = useContext(RealtimeContext)
  return { connected: ctx?.connected ?? false }
}
