'use client'

import { useMemo } from 'react'
import { AdvancedMarker, Polyline } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { MapMarker } from '@/geo/components/markers/MapMarker'
import { resolveDoctorMarker } from '@/geo/marker/MarkerStateResolver'
import type { LatLng } from '@/geo/utils/mapBounds'

type ReviewPin = {
  lat: number
  lng: number
  label: string
  color: string
}

export function DoctorLocationReviewScene({
  suggestedLat,
  suggestedLng,
  verifiedLat,
  verifiedLng,
  doctorName,
  height = 280
}: {
  suggestedLat: number
  suggestedLng: number
  verifiedLat?: number | null
  verifiedLng?: number | null
  doctorName?: string
  height?: number | string
}) {
  const pins: ReviewPin[] = useMemo(() => {
    const list: ReviewPin[] = [
      { lat: suggestedLat, lng: suggestedLng, label: 'Suggested', color: '#ed6c02' }
    ]
    if (typeof verifiedLat === 'number' && typeof verifiedLng === 'number') {
      list.push({ lat: verifiedLat, lng: verifiedLng, label: 'Verified', color: '#1565c0' })
    }
    return list
  }, [suggestedLat, suggestedLng, verifiedLat, verifiedLng])

  const points: LatLng[] = pins.map((p) => ({ lat: p.lat, lng: p.lng }))

  return (
    <GeoMapShell height={height} points={points}>
      {pins.length === 2 ? (
        <Polyline path={points} strokeColor='#757575' strokeWeight={2} strokeOpacity={0.8} />
      ) : null}
      {pins.map((pin) => (
        <AdvancedMarker key={pin.label} position={{ lat: pin.lat, lng: pin.lng }} title={`${doctorName || 'Doctor'} — ${pin.label}`}>
          <MapMarker
            visual={resolveDoctorMarker({
              variant: pin.label === 'Suggested' ? 'suggested' : 'verified',
              selected: pin.label === 'Verified'
            })}
            title={pin.label}
          />
        </AdvancedMarker>
      ))}
    </GeoMapShell>
  )
}
