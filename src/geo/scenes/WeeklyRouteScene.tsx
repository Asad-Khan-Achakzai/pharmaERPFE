'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker, Pin, Polyline } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { fetchGeoWeeklyRoute } from '@/geo/services/geo.service'
import type { LatLng } from '@/geo/utils/mapBounds'

type RouteItem = {
  planItemId: string
  sequenceOrder: number
  status: string
  doctor: { id: string; name: string; lat: number | null; lng: number | null } | null
}

type WeeklyRoutePayload = {
  checkInPoint: { lat: number; lng: number; name: string } | null
  items: RouteItem[]
}

export function WeeklyRouteScene({
  height = 360,
  weeklyPlanId,
  date
}: {
  height?: number | string
  weeklyPlanId: string
  date?: string
}) {
  const [data, setData] = useState<WeeklyRoutePayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchGeoWeeklyRoute({ weeklyPlanId, date })
      .then((res) => {
        if (!cancelled) setData(res as WeeklyRoutePayload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [weeklyPlanId, date])

  const points: LatLng[] = useMemo(() => {
    const pts: LatLng[] = []
    if (data?.checkInPoint) pts.push({ lat: data.checkInPoint.lat, lng: data.checkInPoint.lng })
    for (const item of data?.items || []) {
      if (item.doctor?.lat != null && item.doctor?.lng != null) {
        pts.push({ lat: item.doctor.lat, lng: item.doctor.lng })
      }
    }
    return pts
  }, [data])

  const statusColor = (status: string) => {
    if (status === 'VISITED') return '#2e7d32'
    if (status === 'MISSED') return '#d32f2f'
    return '#1976d2'
  }

  return (
    <GeoMapShell height={height} points={points}>
      {points.length >= 2 ? <Polyline path={points} strokeColor='#1565c0' strokeWeight={3} /> : null}
      {data?.checkInPoint ? (
        <AdvancedMarker position={{ lat: data.checkInPoint.lat, lng: data.checkInPoint.lng }}>
          <Pin background='#6a1b9a' borderColor='#fff' glyphColor='#fff' />
        </AdvancedMarker>
      ) : null}
      {(data?.items || []).map((item) => {
        if (item.doctor?.lat == null || item.doctor?.lng == null) return null
        return (
          <AdvancedMarker
            key={item.planItemId}
            position={{ lat: item.doctor.lat, lng: item.doctor.lng }}
            title={`${item.sequenceOrder}. ${item.doctor.name}`}
          >
            <Pin background={statusColor(item.status)} borderColor='#fff' glyphColor='#fff' />
          </AdvancedMarker>
        )
      })}
    </GeoMapShell>
  )
}
