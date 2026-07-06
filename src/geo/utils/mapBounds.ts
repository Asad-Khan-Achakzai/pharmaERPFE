export type LatLng = { lat: number; lng: number }

export function fitBounds(points: LatLng[]): { center: LatLng; zoom: number } {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!valid.length) return { center: { lat: 31.5204, lng: 74.3587 }, zoom: 11 }
  if (valid.length === 1) return { center: valid[0], zoom: 14 }

  let minLat = valid[0].lat
  let maxLat = valid[0].lat
  let minLng = valid[0].lng
  let maxLng = valid[0].lng
  for (const p of valid) {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  }
  return {
    center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
    zoom: 12
  }
}

export function pathFromPoints(points: LatLng[]): string {
  return points.map((p) => `${p.lat},${p.lng}`).join('|')
}

export function openExternalMaps(lat: number, lng: number) {
  if (typeof window === 'undefined') return
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer')
}
