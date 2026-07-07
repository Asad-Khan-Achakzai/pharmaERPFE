import type { LatLng } from '@/geo/utils/mapBounds'

/** Approximate geodesic circle path for dashed geofence overlays. */
export function circlePolylinePath(
  lat: number,
  lng: number,
  radiusMeters: number,
  segments = 64
): LatLng[] {
  const path: LatLng[] = []
  const latRad = (lat * Math.PI) / 180
  const metersPerDegLat = 111_320
  const metersPerDegLng = Math.max(metersPerDegLat * Math.cos(latRad), 1)

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * 2 * Math.PI
    path.push({
      lat: lat + (radiusMeters / metersPerDegLat) * Math.cos(angle),
      lng: lng + (radiusMeters / metersPerDegLng) * Math.sin(angle)
    })
  }
  return path
}
