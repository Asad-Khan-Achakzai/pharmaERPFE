'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGeoMapContext } from '@/geo/services/geo.service'
import type { GeoMapContextPayload, MapBbox } from '@/geo/types/mapContext'

type Params = {
  bounds: MapBbox | null
  employeeId?: string | null
  trackingContext?: string | null
  radiusMeters: number
  layersQuery: string
  enabled?: boolean
}

export function useMapContext({
  bounds,
  employeeId,
  trackingContext,
  radiusMeters,
  layersQuery,
  enabled = true
}: Params) {
  const [data, setData] = useState<GeoMapContextPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!enabled || !bounds) return
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchGeoMapContext({
        ...bounds,
        employeeId: employeeId ?? undefined,
        trackingContext: trackingContext ?? undefined,
        radiusMeters,
        layers: layersQuery
      })
      if (requestId === requestIdRef.current) {
        setData(payload)
      }
    } catch (err: unknown) {
      if (requestId === requestIdRef.current) {
        setData(null)
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setError(message || 'Could not load map context')
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [bounds, employeeId, trackingContext, radiusMeters, layersQuery, enabled])

  useEffect(() => {
    if (!enabled || !bounds) return
    const timer = window.setTimeout(() => {
      void load()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [load, enabled, bounds])

  return { data, loading, error, refresh: load }
}
