'use client'

import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { LiveRepMapMarker, liveRepMarkerColor } from '@/geo/components/LiveRepMapMarker'
import { useAnimatedLiveMarkers } from '@/geo/hooks/useAnimatedLiveMarkers'
import { useLiveMapClusters } from '@/geo/hooks/useLiveMapClusters'
import { confidenceLabel } from '@/types/liveTracking'
import type { LiveRepLocation } from '@/types/liveTracking'
import type { LatLng } from '@/geo/utils/mapBounds'

type Props = {
  height?: number | string
  rows: LiveRepLocation[]
  loading?: boolean
  selectedUserId?: string | null
  onSelectUser?: (row: LiveRepLocation | null) => void
}

export function LiveTrackingScene({
  height = 420,
  rows,
  loading = false,
  selectedUserId = null,
  onSelectUser
}: Props) {
  const [internalSelected, setInternalSelected] = useState<LiveRepLocation | null>(null)
  const selected =
    selectedUserId != null
      ? rows.find((r) => r.userId === selectedUserId) ?? internalSelected
      : internalSelected

  const animated = useAnimatedLiveMarkers(rows)
  const clusters = useLiveMapClusters(rows, 10)

  const locatedRows = useMemo(
    () => rows.filter((r) => r.lat != null && r.lng != null),
    [rows]
  )

  const points: LatLng[] = useMemo(
    () => locatedRows.map((r) => animated.get(r.userId) || { lat: r.lat!, lng: r.lng! }),
    [locatedRows, animated]
  )

  const setSelected = (row: LiveRepLocation | null) => {
    setInternalSelected(row)
    onSelectUser?.(row)
  }

  if (!loading && rows.length > 0 && locatedRows.length === 0) {
    return (
      <Box
        className='flex flex-col items-center justify-center text-center'
        sx={{ height, borderRadius: 1, border: 1, borderColor: 'divider', px: 3 }}
      >
        <Typography variant='body2' color='text.secondary'>
          Team members are listed below, but none have a recent GPS ping. Reps send adaptive location
          updates while checked in on the mobile app.
        </Typography>
      </Box>
    )
  }

  return (
    <GeoMapShell height={height} points={points}>
      {clusters
        ? clusters.map((cluster) => (
            <AdvancedMarker
              key={cluster.id}
              position={{ lat: cluster.lat, lng: cluster.lng }}
              onClick={() => setSelected(cluster.rows[0] ?? null)}
            >
              <div
                style={{
                  minWidth: 36,
                  height: 36,
                  borderRadius: 18,
                  background: '#2563eb',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  border: '2px solid #fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                }}
              >
                {cluster.count}
              </div>
            </AdvancedMarker>
          ))
        : locatedRows.map((row) => {
            const pos = animated.get(row.userId) || { lat: row.lat!, lng: row.lng! }
            const color = liveRepMarkerColor(row.attendanceStatus, row.ageSeconds, row.confidence)
            const isSelected = selected?.userId === row.userId
            return (
              <AdvancedMarker
                key={row.userId}
                position={pos}
                onClick={() => setSelected(row)}
              >
                <LiveRepMapMarker name={row.name} color={color} selected={isSelected} />
              </AdvancedMarker>
            )
          })}
      {selected && selected.lat != null && selected.lng != null ? (
        <InfoWindow
          position={animated.get(selected.userId) || { lat: selected.lat, lng: selected.lng! }}
          onCloseClick={() => setSelected(null)}
        >
          <div style={{ minWidth: 180 }}>
            <strong>{selected.name}</strong>
            <div>{selected.attendanceStatus.replace(/_/g, ' ')}</div>
            {selected.accuracy != null ? <div>±{Math.round(selected.accuracy)}m</div> : null}
            {selected.confidence != null ? (
              <div>{confidenceLabel(selected.confidence)}</div>
            ) : null}
            {selected.trackingContext ? (
              <div style={{ fontSize: 12, opacity: 0.8 }}>{selected.trackingContext.replace(/_/g, ' ')}</div>
            ) : null}
          </div>
        </InfoWindow>
      ) : null}
    </GeoMapShell>
  )
}
