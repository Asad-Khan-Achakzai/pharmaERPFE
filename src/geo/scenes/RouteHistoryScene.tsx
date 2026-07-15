'use client'

import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import { AdvancedMarker, Polyline } from '@vis.gl/react-google-maps'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { DoctorMapPin } from '@/geo/components/DoctorMapPin'
import { LiveRepMapMarker } from '@/geo/components/LiveRepMapMarker'
import { MAP_ENTITY_COLORS } from '@/geo/marker/mapDesignTokens'
import type { LatLng } from '@/geo/utils/mapBounds'
import type {
  RouteHistoryGap,
  RouteHistoryPayload,
  RouteHistoryStop,
  RouteHistoryVisit
} from '@/geo/services/geo.service'

const ACTUAL_COLOR = MAP_ENTITY_COLORS.route.polyline
const PLANNED_COLOR = '#7B1FA2'
const GAP_COLOR = '#90A4AE'
const STOP_COLORS: Record<string, string> = {
  visit: '#2E7D32',
  idle: '#F9A825',
  lunch: '#FB8C00',
  home: '#5C6BC0',
  unknown: '#78909C'
}

export type RouteHistoryLayerKey = 'planned' | 'visits' | 'stops' | 'gaps'

type LayerVisibility = Record<RouteHistoryLayerKey, boolean>

function collectPoints(
  data: RouteHistoryPayload | null,
  playback?: { lat: number; lng: number } | null
): LatLng[] {
  const pts: LatLng[] = []
  for (const p of data?.path || []) {
    if (typeof p.lat === 'number' && typeof p.lng === 'number') pts.push({ lat: p.lat, lng: p.lng })
  }
  for (const p of data?.plannedRoute?.path || []) {
    if (typeof p.lat === 'number' && typeof p.lng === 'number') pts.push({ lat: p.lat, lng: p.lng })
  }
  if (data?.checkIn) pts.push({ lat: data.checkIn.lat, lng: data.checkIn.lng })
  if (data?.checkOut) pts.push({ lat: data.checkOut.lat, lng: data.checkOut.lng })
  for (const v of data?.visits || []) {
    if (typeof v.lat === 'number' && typeof v.lng === 'number') pts.push({ lat: v.lat, lng: v.lng })
  }
  for (const s of data?.stops || []) {
    if (typeof s.lat === 'number' && typeof s.lng === 'number') pts.push({ lat: s.lat, lng: s.lng })
  }
  if (playback) pts.push(playback)
  return pts
}

function pathSegmentsWithoutGaps(
  path: Array<{ lat: number; lng: number; capturedAt?: string }>,
  gaps: RouteHistoryGap[]
): Array<Array<{ lat: number; lng: number }>> {
  const valid = path.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
  if (!valid.length) return []
  if (!gaps.length) {
    return [valid.map((p) => ({ lat: p.lat, lng: p.lng }))]
  }

  const gapWindows = gaps
    .map((g) => {
      const from = g.from ? new Date(g.from).getTime() : NaN
      const to = g.to ? new Date(g.to).getTime() : NaN
      if (!Number.isFinite(from) || !Number.isFinite(to)) return null
      return { from, to }
    })
    .filter(Boolean) as Array<{ from: number; to: number }>

  if (!gapWindows.length) {
    return [valid.map((p) => ({ lat: p.lat, lng: p.lng }))]
  }

  const segments: Array<Array<{ lat: number; lng: number }>> = []
  let current: Array<{ lat: number; lng: number }> = []

  for (const p of valid) {
    const t = p.capturedAt ? new Date(p.capturedAt).getTime() : NaN
    const inGap =
      Number.isFinite(t) && gapWindows.some((g) => t >= g.from && t <= g.to)
    if (inGap) {
      if (current.length >= 2) segments.push(current)
      current = []
      continue
    }
    current.push({ lat: p.lat, lng: p.lng })
  }
  if (current.length >= 2) segments.push(current)
  return segments
}

function stopMarkerColor(stop: RouteHistoryStop): string {
  const key = (stop.class || 'unknown').toLowerCase()
  return STOP_COLORS[key] || STOP_COLORS.unknown
}

function VisitPin({ visit }: { visit: RouteHistoryVisit }) {
  const missed = visit.geoFenceResult === 'OUTSIDE_RADIUS' || visit.verified === false
  return <DoctorMapPin visitStatus={missed ? 'MISSED' : 'VISITED'} />
}

function ScrubPin() {
  return <LiveRepMapMarker name='Playback' attendanceStatus='CHECKED_IN' ageSeconds={0} selected />
}

export function RouteHistoryScene({
  height = 420,
  data,
  playbackPosition,
  layers: layersProp
}: {
  height?: number | string
  data: RouteHistoryPayload | null
  playbackPosition?: { lat: number; lng: number } | null
  layers?: Partial<LayerVisibility>
}) {
  const [layers, setLayers] = useState<LayerVisibility>({
    planned: true,
    visits: true,
    stops: true,
    gaps: true,
    ...layersProp
  })

  const points = useMemo(() => collectPoints(data, playbackPosition), [data, playbackPosition])
  const actualSegments = useMemo(
    () => pathSegmentsWithoutGaps(data?.path || [], layers.gaps ? data?.gaps || [] : []),
    [data, layers.gaps]
  )
  const plannedPath = useMemo(
    () =>
      (data?.plannedRoute?.path || []).filter(
        (p) => typeof p.lat === 'number' && typeof p.lng === 'number'
      ),
    [data]
  )
  const fitKey = useMemo(
    () =>
      [
        data?.date,
        data?.path?.length,
        data?.checkIn?.at,
        data?.checkOut?.at,
        data?.visits?.length
      ].join(':'),
    [data]
  )

  const toggle = (key: RouteHistoryLayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Box sx={{ position: 'relative', height, width: '100%' }}>
      <Stack
        direction='row'
        spacing={0.75}
        useFlexGap
        flexWrap='wrap'
        sx={{ position: 'absolute', zIndex: 2, top: 8, left: 8, right: 8 }}
      >
        {(
          [
            ['planned', 'Planned'],
            ['visits', 'Visits'],
            ['stops', 'Stops'],
            ['gaps', 'Gaps']
          ] as Array<[RouteHistoryLayerKey, string]>
        ).map(([key, label]) => (
          <Chip
            key={key}
            size='small'
            label={label}
            color={layers[key] ? 'primary' : 'default'}
            variant={layers[key] ? 'filled' : 'outlined'}
            onClick={() => toggle(key)}
            sx={{ bgcolor: layers[key] ? undefined : 'background.paper' }}
          />
        ))}
      </Stack>
      <GeoMapShell height='100%' points={points} fitKey={fitKey} autoFit='once'>
        {actualSegments.map((seg, idx) =>
          seg.length >= 2 ? (
            <Polyline
              key={`actual-${idx}`}
              path={seg}
              strokeColor={ACTUAL_COLOR}
              strokeWeight={4}
              strokeOpacity={0.9}
            />
          ) : null
        )}
        {layers.planned && plannedPath.length >= 2 ? (
          <Polyline
            path={plannedPath}
            strokeColor={PLANNED_COLOR}
            strokeWeight={3}
            strokeOpacity={0.65}
          />
        ) : null}
        {layers.gaps
          ? (data?.gaps || []).map((gap, idx) => {
              const hasStart = typeof gap.startLat === 'number' && typeof gap.startLng === 'number'
              const hasEnd = typeof gap.endLat === 'number' && typeof gap.endLng === 'number'
              if (hasStart && hasEnd) {
                return (
                  <Polyline
                    key={`gap-line-${idx}`}
                    path={[
                      { lat: gap.startLat!, lng: gap.startLng! },
                      { lat: gap.endLat!, lng: gap.endLng! }
                    ]}
                    strokeColor={GAP_COLOR}
                    strokeWeight={3}
                    strokeOpacity={0.45}
                  />
                )
              }
              if (hasStart) {
                return (
                  <AdvancedMarker
                    key={`gap-start-${idx}`}
                    position={{ lat: gap.startLat!, lng: gap.startLng! }}
                    title={gap.reason || 'GPS gap'}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: GAP_COLOR,
                        border: '2px solid #fff'
                      }}
                    />
                  </AdvancedMarker>
                )
              }
              return null
            })
          : null}
        {data?.checkIn ? (
          <AdvancedMarker
            position={{ lat: data.checkIn.lat, lng: data.checkIn.lng }}
            title='Check-in'
          >
            <DoctorMapPin variant='verified' />
          </AdvancedMarker>
        ) : null}
        {data?.checkOut ? (
          <AdvancedMarker
            position={{ lat: data.checkOut.lat, lng: data.checkOut.lng }}
            title='Check-out'
          >
            <DoctorMapPin variant='default' />
          </AdvancedMarker>
        ) : null}
        {layers.visits
          ? (data?.visits || []).map((visit, idx) => {
              if (typeof visit.lat !== 'number' || typeof visit.lng !== 'number') return null
              return (
                <AdvancedMarker
                  key={`visit-${visit.doctorId || idx}-${visit.at || idx}`}
                  position={{ lat: visit.lat, lng: visit.lng }}
                  title={visit.doctorName || 'Visit'}
                >
                  <VisitPin visit={visit} />
                </AdvancedMarker>
              )
            })
          : null}
        {layers.stops
          ? (data?.stops || []).map((stop, idx) => {
              if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return null
              const color = stopMarkerColor(stop)
              return (
                <AdvancedMarker
                  key={`stop-${idx}-${stop.startedAt || idx}`}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  title={stop.label || stop.class || 'Stop'}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: color,
                      border: '2px solid #fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.35)'
                    }}
                  />
                </AdvancedMarker>
              )
            })
          : null}
        {playbackPosition ? (
          <AdvancedMarker position={playbackPosition} title='Playback position'>
            <ScrubPin />
          </AdvancedMarker>
        ) : null}
      </GeoMapShell>
    </Box>
  )
}
