'use client'

import { useMemo } from 'react'
import { AdvancedMarker, Polyline } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { MapMarker } from '@/geo/components/markers/MapMarker'
import {
  getMarker,
  mergeMarkerState,
  MAP_ENTITY_COLORS,
  resolveDoctorMarker
} from '@/geo/marker/MarkerStateResolver'
import type { LatLng } from '@/geo/utils/mapBounds'

export type RouteMapStop = {
  planItemId: string
  sequenceOrder: number
  status: string
  doctor: { id: string; name: string; lat: number | null; lng: number | null } | null
}

export type RouteMapPayload = {
  checkInPoint: { lat: number; lng: number; name: string } | null
  items: RouteMapStop[]
}

export function routeMapPoints(data: RouteMapPayload | null): LatLng[] {
  const pts: LatLng[] = []
  if (data?.checkInPoint) pts.push({ lat: data.checkInPoint.lat, lng: data.checkInPoint.lng })
  for (const item of data?.items || []) {
    if (item.doctor?.lat != null && item.doctor?.lng != null) {
      pts.push({ lat: item.doctor.lat, lng: item.doctor.lng })
    }
  }
  return pts
}

export function RouteMapScene({
  height = 360,
  data
}: {
  height?: number | string
  data: RouteMapPayload | null
}) {
  const points = useMemo(() => routeMapPoints(data), [data])

  return (
    <GeoMapShell height={height} points={points}>
      {points.length >= 2 ? (
        <Polyline path={points} strokeColor={MAP_ENTITY_COLORS.route.polyline} strokeWeight={3} />
      ) : null}
      {data?.checkInPoint ? (
        <AdvancedMarker position={{ lat: data.checkInPoint.lat, lng: data.checkInPoint.lng }} title={data.checkInPoint.name}>
          <MapMarker
            visual={mergeMarkerState(getMarker('callPoint', 'active'), {
              color: MAP_ENTITY_COLORS.route.checkIn
            })}
            title={data.checkInPoint.name}
          />
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
            <MapMarker visual={resolveDoctorMarker({ visitStatus: item.status })} title={item.doctor.name} />
          </AdvancedMarker>
        )
      })}
    </GeoMapShell>
  )
}
