import type { MapMouseEvent } from '@vis.gl/react-google-maps'

/** Read lat/lng from a vis.gl `Map` onClick event. */
export function latLngFromMapClick(event: MapMouseEvent): { lat: number; lng: number } | null {
  const ll = event.detail?.latLng
  if (ll == null || typeof ll.lat !== 'number' || typeof ll.lng !== 'number') return null
  return { lat: ll.lat, lng: ll.lng }
}

/** Read lat/lng from AdvancedMarker drag events (native Maps API shape). */
export function latLngFromDragEvent(event: google.maps.MapMouseEvent): { lat: number; lng: number } | null {
  const ll = event.latLng
  if (!ll) return null
  return { lat: ll.lat(), lng: ll.lng() }
}
