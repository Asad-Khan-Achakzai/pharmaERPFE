'use client'

import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { LiveRepMapMarker, liveRepMarkerColor } from '@/geo/components/LiveRepMapMarker'
import type { LiveRepLocation } from '@/types/liveTracking'
import type { LatLng } from '@/geo/utils/mapBounds'

type Props = {
  height?: number | string
  /** Live rows from the parent view — avoids a duplicate API call and keeps map in sync with the list. */
  rows: LiveRepLocation[]
  loading?: boolean
}

export function LiveTrackingScene({ height = 420, rows, loading = false }: Props) {
  const [selected, setSelected] = useState<LiveRepLocation | null>(null)

  const locatedRows = useMemo(
    () => rows.filter((r) => r.lat != null && r.lng != null),
    [rows]
  )

  const points: LatLng[] = useMemo(
    () => locatedRows.map((r) => ({ lat: r.lat!, lng: r.lng! })),
    [locatedRows]
  )

  if (!loading && rows.length > 0 && locatedRows.length === 0) {
    return (
      <Box
        className='flex flex-col items-center justify-center text-center'
        sx={{ height, borderRadius: 1, border: 1, borderColor: 'divider', px: 3 }}
      >
        <Typography variant='body2' color='text.secondary'>
          Team members are listed below, but none have a GPS ping in the last 30 minutes. Reps send location every
          ~5 minutes while checked in on the mobile app.
        </Typography>
      </Box>
    )
  }

  return (
    <GeoMapShell height={height} points={points}>
      {locatedRows.map((row) => {
        const color = liveRepMarkerColor(row.attendanceStatus, row.ageSeconds)
        const isSelected = selected?.userId === row.userId
        return (
          <AdvancedMarker
            key={row.userId}
            position={{ lat: row.lat!, lng: row.lng! }}
            onClick={() => setSelected(row)}
          >
            <LiveRepMapMarker name={row.name} color={color} selected={isSelected} />
          </AdvancedMarker>
        )
      })}
      {selected && selected.lat != null && selected.lng != null ? (
        <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
          <div style={{ minWidth: 160 }}>
            <strong>{selected.name}</strong>
            <div>{selected.attendanceStatus.replace(/_/g, ' ')}</div>
            {selected.accuracy != null ? <div>±{Math.round(selected.accuracy)}m</div> : null}
          </div>
        </InfoWindow>
      ) : null}
    </GeoMapShell>
  )
}
