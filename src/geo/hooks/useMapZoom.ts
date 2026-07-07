'use client'

import { useEffect, useState } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

/** Track map zoom for zoom-aware clustering and overlays. */
export function useMapZoom(defaultZoom = 10): number {
  const map = useMap()
  const [zoom, setZoom] = useState(defaultZoom)

  useEffect(() => {
    if (!map) return undefined

    const sync = () => {
      const z = map.getZoom()
      if (z != null) setZoom(z)
    }

    sync()
    const listener = map.addListener('zoom_changed', sync)
    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [map])

  return zoom
}
