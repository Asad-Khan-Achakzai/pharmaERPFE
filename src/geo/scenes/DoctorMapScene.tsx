'use client'

import { useMemo } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { DoctorMapPin } from '@/geo/components/DoctorMapPin'
import type { LatLng } from '@/geo/utils/mapBounds'

export function DoctorMapScene({
  lat,
  lng,
  name,
  height = 240,
  locationStatus
}: {
  lat: number
  lng: number
  name?: string
  height?: number | string
  locationStatus?: string
}) {
  const points: LatLng[] = useMemo(() => [{ lat, lng }], [lat, lng])

  return (
    <GeoMapShell height={height} points={points} defaultZoom={15}>
      <AdvancedMarker position={{ lat, lng }} title={name || 'Doctor'}>
        <DoctorMapPin locationStatus={locationStatus} />
      </AdvancedMarker>
    </GeoMapShell>
  )
}
