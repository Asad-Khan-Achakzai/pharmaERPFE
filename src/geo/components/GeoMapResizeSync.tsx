'use client'

import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

/** Keeps tile layout correct when the map container size changes (dialog, resize, etc.). */
export function GeoMapResizeSync() {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const sync = () => {
      google.maps.event.trigger(map, 'resize')
      const center = map.getCenter()
      if (center) map.setCenter(center)
    }

    const t = window.setTimeout(sync, 0)
    window.addEventListener('resize', sync)
    document.addEventListener('fullscreenchange', sync)

    const host = map.getDiv()?.parentElement
    const ro = host ? new ResizeObserver(() => sync()) : null
    ro?.observe(host!)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', sync)
      document.removeEventListener('fullscreenchange', sync)
      ro?.disconnect()
    }
  }, [map])

  return null
}
