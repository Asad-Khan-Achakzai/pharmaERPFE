'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker, Circle } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { MapMarker } from '@/geo/components/markers/MapMarker'
import { MAP_ENTITY_COLORS, resolveDoctorMarker, resolveRepMarker } from '@/geo/marker/MarkerStateResolver'
import { fetchGeoAttendanceZones } from '@/geo/services/geo.service'
import type { LatLng } from '@/geo/utils/mapBounds'

type ZoneRow = {
  name: string
  checkIn: { lat: number | null; lng: number | null }
  expected: { name?: string; lat?: number; lng?: number; radiusMeters?: number } | null
  attendanceLocationStatus?: string
}

export function AttendanceZoneScene({ height = 280, date }: { height?: number | string; date?: string }) {
  const [rows, setRows] = useState<ZoneRow[]>([])

  useEffect(() => {
    void fetchGeoAttendanceZones({ date }).then((data) => setRows((data as ZoneRow[]) || []))
  }, [date])

  const points: LatLng[] = useMemo(() => {
    const pts: LatLng[] = []
    for (const row of rows) {
      if (row.checkIn.lat != null && row.checkIn.lng != null) pts.push({ lat: row.checkIn.lat, lng: row.checkIn.lng })
      if (row.expected?.lat != null && row.expected?.lng != null) {
        pts.push({ lat: row.expected.lat, lng: row.expected.lng })
      }
    }
    return pts
  }, [rows])

  return (
    <GeoMapShell height={height} points={points}>
      {rows.map((row, idx) => (
        <AttendanceZoneMarkers key={idx} row={row} />
      ))}
    </GeoMapShell>
  )
}

function AttendanceZoneMarkers({ row }: { row: ZoneRow }) {
  return (
    <>
      {row.expected?.lat != null && row.expected?.lng != null ? (
        <>
          <AdvancedMarker position={{ lat: row.expected.lat, lng: row.expected.lng }}>
            <MapMarker visual={resolveDoctorMarker({})} title={row.expected.name || 'Expected zone'} />
          </AdvancedMarker>
          {row.expected.radiusMeters ? (
            <Circle
              center={{ lat: row.expected.lat, lng: row.expected.lng }}
              radius={row.expected.radiusMeters}
              strokeColor={MAP_ENTITY_COLORS.geofence.inside}
              fillColor={`${MAP_ENTITY_COLORS.geofence.inside}33`}
            />
          ) : null}
        </>
      ) : null}
      {row.checkIn.lat != null && row.checkIn.lng != null ? (
        <AdvancedMarker position={{ lat: row.checkIn.lat, lng: row.checkIn.lng }} title={row.name}>
          <MapMarker
            visual={resolveRepMarker({
              attendanceStatus:
                row.attendanceLocationStatus === 'OUT_OF_ZONE' ? 'CHECKED_OUT' : 'CHECKED_IN'
            })}
            title={row.name}
            initials={row.name}
          />
        </AdvancedMarker>
      ) : null}
    </>
  )
}
