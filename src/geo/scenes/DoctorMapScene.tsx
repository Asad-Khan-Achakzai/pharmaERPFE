'use client'

import { useMemo } from 'react'
import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import type { LatLng } from '@/geo/utils/mapBounds'

export function DoctorMapScene({
  lat,
  lng,
  name,
  height = 240
}: {
  lat: number
  lng: number
  name?: string
  height?: number | string
}) {
  const points: LatLng[] = useMemo(() => [{ lat, lng }], [lat, lng])

  return (
    <GeoMapShell height={height} points={points} defaultZoom={15}>
      <AdvancedMarker position={{ lat, lng }} title={name || 'Doctor'}>
        <Pin background='#1565c0' borderColor='#fff' glyphColor='#fff' />
      </AdvancedMarker>
    </GeoMapShell>
  )
}
