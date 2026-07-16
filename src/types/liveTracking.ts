export type LiveAttendanceStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' | 'LATE_CHECKIN_PENDING'

export type LiveLocationSource = 'heartbeat' | 'checkin' | 'snapshot' | null

export interface LiveRepLocation {
  userId: string
  name: string
  attendanceStatus: LiveAttendanceStatus
  checkInTime: string | null
  checkOutTime: string | null
  lat: number | null
  lng: number | null
  accuracy?: number | null
  confidence?: number | null
  qualityLevel?: string | null
  usableForLive?: boolean | null
  speed?: number | null
  heading?: number | null
  trackingContext?: string | null
  expectedNextPingMs?: number | null
  capturedAt: string | null
  ageSeconds: number | null
  locationSource?: LiveLocationSource
}

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'poor'

export function confidenceBand(confidence: number | null | undefined): ConfidenceBand {
  const c = confidence ?? 0
  if (c >= 80) return 'high'
  if (c >= 50) return 'medium'
  if (c >= 20) return 'low'
  return 'poor'
}

export function confidenceLabel(confidence: number | null | undefined): string {
  const band = confidenceBand(confidence)
  if (band === 'high') return 'High confidence'
  if (band === 'medium') return 'Medium confidence'
  if (band === 'low') return 'Approximate'
  return 'Poor signal'
}
