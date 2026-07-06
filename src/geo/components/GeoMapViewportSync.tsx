'use client'

import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { LatLng } from '@/geo/utils/mapBounds'

/** Re-centers the map when async marker data arrives (defaultCenter only applies on first mount). */
export function GeoMapViewportSync({ points }: { points: LatLng[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !points.length) return

    if (points.length === 1) {
      map.setCenter(points[0])
      map.setZoom(14)
      return
    }

    const bounds = new google.maps.LatLngBounds()
    for (const p of points) {
      bounds.extend(p)
    }
    map.fitBounds(bounds, { top: 48, bottom: 48, left: 48, right: 48 })
  }, [map, points])

  return null
}
