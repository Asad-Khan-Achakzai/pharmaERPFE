'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdvancedMarker, Pin, Circle } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
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
            <Pin background='#2e7d32' borderColor='#fff' glyphColor='#fff' />
          </AdvancedMarker>
          {row.expected.radiusMeters ? (
            <Circle
              center={{ lat: row.expected.lat, lng: row.expected.lng }}
              radius={row.expected.radiusMeters}
              strokeColor='#2e7d32'
              fillColor='#2e7d3288'
            />
          ) : null}
        </>
      ) : null}
      {row.checkIn.lat != null && row.checkIn.lng != null ? (
        <AdvancedMarker position={{ lat: row.checkIn.lat, lng: row.checkIn.lng }} title={row.name}>
          <Pin
            background={row.attendanceLocationStatus === 'OUT_OF_ZONE' ? '#d32f2f' : '#1565c0'}
            borderColor='#fff'
            glyphColor='#fff'
          />
        </AdvancedMarker>
      ) : null}
    </>
  )
}
