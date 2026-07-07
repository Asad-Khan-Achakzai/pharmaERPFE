'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { LatLng } from '@/geo/utils/mapBounds'
import { fitMapToPoints, shouldApplyViewportFit, type AutoFitMode } from '@/geo/viewport/ViewportPolicy'

type Props = {
  points: LatLng[]
  autoFit?: AutoFitMode
  fitKey?: string
  maxZoomAfterFit?: number
  singlePointZoom?: number
}

export function GeoMapViewportSync({
  points,
  autoFit = 'once',
  fitKey,
  maxZoomAfterFit = 14,
  singlePointZoom = 14
}: Props) {
  const map = useMap()
  const lastAppliedKeyRef = useRef<string | null>(null)
  const pointsRef = useRef(points)
  pointsRef.current = points

  useEffect(() => {
    if (!map) return

    const pts = pointsRef.current
    if (!pts.length) return

    const key = fitKey ?? String(pts.length)
    if (!shouldApplyViewportFit(autoFit, key, lastAppliedKeyRef.current)) return

    lastAppliedKeyRef.current = key
    fitMapToPoints(map, pts, { maxZoomAfterFit, singlePointZoom })
  }, [map, autoFit, fitKey, maxZoomAfterFit, singlePointZoom, points.length])

  return null
}
