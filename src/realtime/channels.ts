export const REALTIME_CHANNELS = {
  LIVE_MAP: 'live-map',
  ATTENDANCE: 'attendance',
  NOTIFICATIONS: 'notifications'
} as const

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS]

export const DEFAULT_REALTIME_CHANNELS: RealtimeChannel[] = [
  REALTIME_CHANNELS.LIVE_MAP,
  REALTIME_CHANNELS.NOTIFICATIONS
]
