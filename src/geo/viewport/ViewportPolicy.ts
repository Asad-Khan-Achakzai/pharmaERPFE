import type { LatLng } from '@/geo/utils/mapBounds'

export type AutoFitMode = 'once' | 'always' | 'never'

export type ViewportFitOptions = {
  maxZoomAfterFit?: number
  singlePointZoom?: number
  padding?: { top: number; bottom: number; left: number; right: number }
}

const DEFAULT_PADDING = { top: 64, bottom: 64, left: 64, right: 64 }

/** Apply bounds fit without fighting manual user zoom when used with fitKey + autoFit once. */
export function fitMapToPoints(
  map: google.maps.Map,
  points: LatLng[],
  options: ViewportFitOptions = {}
): void {
  if (!points.length) return

  const padding = options.padding ?? DEFAULT_PADDING

  if (points.length === 1) {
    map.setCenter(points[0])
    map.setZoom(options.singlePointZoom ?? 14)
    return
  }

  const bounds = new google.maps.LatLngBounds()
  for (const p of points) {
    bounds.extend(p)
  }
  map.fitBounds(bounds, padding)

  const maxZoom = options.maxZoomAfterFit
  if (maxZoom == null) return

  const listener = map.addListener('idle', () => {
    const z = map.getZoom()
    if (z != null && z > maxZoom) {
      map.setZoom(maxZoom)
    }
    google.maps.event.removeListener(listener)
  })
}

export function shouldApplyViewportFit(
  autoFit: AutoFitMode,
  fitKey: string,
  lastAppliedKey: string | null
): boolean {
  if (autoFit === 'never') return false
  if (autoFit === 'always') return true
  return lastAppliedKey !== fitKey
}
