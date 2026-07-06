'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker, Pin, Polyline } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { fetchGeoDayRoute } from '@/geo/services/geo.service'
import type { LatLng } from '@/geo/utils/mapBounds'

type DayRouteItem = {
  planItemId: string
  sequenceOrder: number
  status: string
  doctor: { id: string; name: string; lat: number | null; lng: number | null } | null
}

type DayRoutePayload = {
  checkInPoint: { lat: number; lng: number; name: string } | null
  items: DayRouteItem[]
}

export function DailyRouteScene({
  height = 360,
  employeeId,
  date
}: {
  height?: number | string
  employeeId?: string
  date?: string
}) {
  const [data, setData] = useState<DayRoutePayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchGeoDayRoute({ employeeId, date })
      .then((res) => {
        if (!cancelled) setData(res as DayRoutePayload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId, date])

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

  const polylinePath = points

  const statusColor = (status: string) => {
    if (status === 'VISITED') return '#2e7d32'
    if (status === 'MISSED') return '#d32f2f'
    return '#1976d2'
  }

  return (
    <GeoMapShell height={height} points={points}>
      {polylinePath.length >= 2 ? <Polyline path={polylinePath} strokeColor='#1565c0' strokeWeight={3} /> : null}
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
