const EARTH_RADIUS_METERS = 6371000

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number | null {
  if (
    typeof lat1 !== 'number' ||
    typeof lng1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lng2 !== 'number'
  ) {
    return null
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const aLat1 = toRad(lat1)
  const aLat2 = toRad(lat2)
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(aLat1) * Math.cos(aLat2)
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(x))
}

export function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}
