'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker, Polyline } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { DoctorMapPin } from '@/geo/components/DoctorMapPin'
import type { LatLng } from '@/geo/utils/mapBounds'

export type ReplayPathPoint = {
  lat: number
  lng: number
  capturedAt?: string
  type?: string
}

export type ReplayVisitMarker = {
  lat?: number | null
  lng?: number | null
  at?: string
  doctorId?: string
  geoFenceResult?: string
}

export type ReplayPayload = {
  date: string
  path: ReplayPathPoint[]
  checkIn: { lat: number; lng: number; at?: string } | null
  checkOut: { lat: number; lng: number; at?: string } | null
  visits: ReplayVisitMarker[]
}

function replayPoints(data: ReplayPayload | null): LatLng[] {
  const pts: LatLng[] = []
  for (const p of data?.path || []) {
    if (typeof p.lat === 'number' && typeof p.lng === 'number') pts.push({ lat: p.lat, lng: p.lng })
  }
  if (
    data?.checkIn &&
    typeof data.checkIn.lat === 'number' &&
    typeof data.checkIn.lng === 'number'
  ) {
    pts.push({ lat: data.checkIn.lat, lng: data.checkIn.lng })
  }
  if (
    data?.checkOut &&
    typeof data.checkOut.lat === 'number' &&
    typeof data.checkOut.lng === 'number'
  ) {
    pts.push({ lat: data.checkOut.lat, lng: data.checkOut.lng })
  }
  for (const v of data?.visits || []) {
    if (typeof v.lat === 'number' && typeof v.lng === 'number') pts.push({ lat: v.lat, lng: v.lng })
  }
  return pts
}

export function ReplayMapScene({
  height = 360,
  data
}: {
  height?: number | string
  data: ReplayPayload | null
}) {
  const points = useMemo(() => replayPoints(data), [data])
  const path = useMemo(
    () =>
      (data?.path || [])
        .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
        .map((p) => ({ lat: p.lat, lng: p.lng })),
    [data]
  )

  return (
    <GeoMapShell height={height} points={points}>
      {path.length >= 2 ? <Polyline path={path} strokeColor='#455a64' strokeWeight={3} /> : null}
      {data?.checkIn &&
      typeof data.checkIn.lat === 'number' &&
      typeof data.checkIn.lng === 'number' ? (
        <AdvancedMarker position={{ lat: data.checkIn.lat, lng: data.checkIn.lng }} title='Check-in'>
          <DoctorMapPin variant='verified' />
        </AdvancedMarker>
      ) : null}
      {data?.checkOut &&
      typeof data.checkOut.lat === 'number' &&
      typeof data.checkOut.lng === 'number' ? (
        <AdvancedMarker
          position={{ lat: data.checkOut.lat, lng: data.checkOut.lng }}
          title='Check-out'
        >
          <DoctorMapPin variant='default' />
        </AdvancedMarker>
      ) : null}
      {(data?.visits || []).map((visit, idx) => {
        if (typeof visit.lat !== 'number' || typeof visit.lng !== 'number') return null
        const missed = visit.geoFenceResult === 'OUTSIDE_RADIUS'
        return (
          <AdvancedMarker
            key={`${visit.doctorId || idx}-${visit.at || idx}`}
            position={{ lat: visit.lat, lng: visit.lng }}
            title={missed ? 'Visit (outside geo-fence)' : 'Visit'}
          >
            <DoctorMapPin visitStatus={missed ? 'MISSED' : 'VISITED'} />
          </AdvancedMarker>
        )
      })}
    </GeoMapShell>
  )
}

export function ReplayMapSceneLoader({
  height = 360,
  load
}: {
  height?: number | string
  load: () => Promise<ReplayPayload | null>
}) {
  const [data, setData] = useState<ReplayPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void load()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  return <ReplayMapScene height={height} data={data} />
}
