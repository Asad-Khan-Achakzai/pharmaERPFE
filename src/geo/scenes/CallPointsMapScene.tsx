'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { CallPointMapPin } from '@/geo/components/CallPointMapPin'
import { fetchGeoCallPoints } from '@/geo/services/geo.service'
import type { LatLng } from '@/geo/utils/mapBounds'

type CallPointPin = {
  id: string
  name: string
  lat: number | null
  lng: number | null
}

export function CallPointsMapScene({ height = 320 }: { height?: number | string }) {
  const [rows, setRows] = useState<CallPointPin[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchGeoCallPoints()
      .then((res) => {
        if (!cancelled) setRows((res || []) as CallPointPin[])
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const points: LatLng[] = useMemo(
    () =>
      rows
        .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number')
        .map((r) => ({ lat: r.lat!, lng: r.lng! })),
    [rows]
  )

  return (
    <GeoMapShell height={height} points={points}>
      {rows.map((row) => {
        if (typeof row.lat !== 'number' || typeof row.lng !== 'number') return null
        return (
          <AdvancedMarker key={row.id} position={{ lat: row.lat, lng: row.lng }} title={row.name}>
            <CallPointMapPin />
          </AdvancedMarker>
        )
      })}
    </GeoMapShell>
  )
}
