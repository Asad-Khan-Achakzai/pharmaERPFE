'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { MapBbox } from '@/geo/types/mapContext'

type Props = {
  onBoundsChange: (bbox: MapBbox) => void
}

export function GeoMapBoundsReporter({ onBoundsChange }: Props) {
  const map = useMap()
  const handlerRef = useRef(onBoundsChange)
  handlerRef.current = onBoundsChange

  useEffect(() => {
    if (!map) return

    const report = () => {
      const bounds = map.getBounds()
      if (!bounds) return
      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      handlerRef.current({
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng()
      })
    }

    report()
    const idleListener = map.addListener('idle', report)
    return () => {
      google.maps.event.removeListener(idleListener)
    }
  }, [map])

  return null
}
