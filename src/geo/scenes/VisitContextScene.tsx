'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { DoctorMapPin } from '@/geo/components/DoctorMapPin'
import { fetchGeoVisitContext } from '@/geo/services/geo.service'
import type { LatLng } from '@/geo/utils/mapBounds'

type VisitContextPayload = {
  planItemId: string
  status: string
  doctor: { id: string; name: string; lat: number | null; lng: number | null; locationStatus?: string } | null
}

export function VisitContextScene({
  planItemId,
  height = 280
}: {
  planItemId: string
  height?: number | string
}) {
  const [data, setData] = useState<VisitContextPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchGeoVisitContext(planItemId)
      .then((res) => {
        if (!cancelled) setData(res as VisitContextPayload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [planItemId])

  const points: LatLng[] = useMemo(() => {
    if (data?.doctor?.lat != null && data?.doctor?.lng != null) {
      return [{ lat: data.doctor.lat, lng: data.doctor.lng }]
    }
    return []
  }, [data])

  if (!data?.doctor?.lat || !data?.doctor?.lng) return null

  return (
    <GeoMapShell height={height} points={points} defaultZoom={15}>
      <AdvancedMarker
        position={{ lat: data.doctor.lat, lng: data.doctor.lng }}
        title={data.doctor.name}
      >
        <DoctorMapPin visitStatus={data.status} locationStatus={data.doctor.locationStatus} />
      </AdvancedMarker>
    </GeoMapShell>
  )
}
