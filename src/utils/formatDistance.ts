/** Format meters for display: under 1 km → "450m", otherwise → "4.304km". */
export function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return ''
  const m = Math.max(0, Math.round(meters))
  if (m < 1000) return `${m}m`
  const km = m / 1000
  const text = km.toFixed(3).replace(/\.?0+$/, '')
  return `${text}km`
}

export type AttendanceLocationStatus = 'WITHIN_ZONE' | 'OUT_OF_ZONE'

/** Human label for V2 check-in point compliance. */
export function formatCheckInZoneLabel(
  status?: AttendanceLocationStatus | null,
  distanceMeters?: number | null,
  options?: { short?: boolean }
): string | null {
  if (!status) return null
  if (status === 'WITHIN_ZONE') {
    return options?.short ? 'In zone' : 'Within check-in point'
  }
  const dist = formatDistanceMeters(distanceMeters)
  if (dist) {
    return options?.short ? `Out · ${dist}` : `Outside check-in point · ${dist}`
  }
  return options?.short ? 'Out of zone' : 'Outside check-in point'
}
