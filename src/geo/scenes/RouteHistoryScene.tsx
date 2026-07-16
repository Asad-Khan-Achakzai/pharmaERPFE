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
const LOW_CONFIDENCE_COLOR = '#F9A825'
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

function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { lat, lng }
  }
  return null
}

function gapStart(gap: RouteHistoryGap): LatLng | null {
  return toLatLng(gap.startLat ?? gap.fromLat, gap.startLng ?? gap.fromLng)
}

function gapEnd(gap: RouteHistoryGap): LatLng | null {
  return toLatLng(gap.endLat ?? gap.toLat, gap.endLng ?? gap.toLng)
}

function collectPoints(
  data: RouteHistoryPayload | null,
  playback?: { lat: number; lng: number } | null
): LatLng[] {
  const pts: LatLng[] = []
  for (const p of data?.path || []) {
    const ll = toLatLng(p.lat, p.lng)
    if (ll) pts.push(ll)
  }
  for (const p of data?.plannedRoute?.path || []) {
    const ll = toLatLng(p.lat, p.lng)
    if (ll) pts.push(ll)
  }
  for (const s of data?.plannedRoute?.stops || []) {
    const ll = toLatLng(s.lat, s.lng)
    if (ll) pts.push(ll)
  }
  if (data?.checkIn) {
    const ll = toLatLng(data.checkIn.lat, data.checkIn.lng)
    if (ll) pts.push(ll)
  }
  if (data?.checkOut) {
    const ll = toLatLng(data.checkOut.lat, data.checkOut.lng)
    if (ll) pts.push(ll)
  }
  for (const v of data?.visits || []) {
    const ll = toLatLng(v.lat, v.lng)
    if (ll) pts.push(ll)
  }
  for (const s of data?.stops || []) {
    const ll = toLatLng(s.lat, s.lng)
    if (ll) pts.push(ll)
  }
  if (playback) {
    const ll = toLatLng(playback.lat, playback.lng)
    if (ll) pts.push(ll)
  }
  return pts
}

function pathSegmentsWithoutGaps(
  path: Array<{ lat?: number | null; lng?: number | null; capturedAt?: string }>,
  gaps: RouteHistoryGap[]
): Array<Array<{ lat: number; lng: number }>> {
  const valid: Array<{ lat: number; lng: number; capturedAt?: string }> = []
  for (const p of path) {
    const ll = toLatLng(p.lat, p.lng)
    if (ll) valid.push({ ...ll, capturedAt: p.capturedAt })
  }
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
    const inGap = Number.isFinite(t) && gapWindows.some((g) => t >= g.from && t <= g.to)
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
  const qualityPolylines = useMemo(() => {
    const segs = data?.segments || []
    if (segs.length) {
      return segs
        .map((seg, idx) => {
          const path = (seg.coordinates || [])
            .map((c) => toLatLng(c.lat, c.lng))
            .filter(Boolean) as LatLng[]
          if (path.length < 2) return null
          const low =
            seg.band === 'low_confidence' || seg.qualityLevel === 'low_confidence'
          return {
            key: `qseg-${idx}`,
            path,
            low,
          }
        })
        .filter(Boolean) as Array<{ key: string; path: LatLng[]; low: boolean }>
    }
    // Fallback: split flat path by qualityLevel
    const path = data?.path || []
    const out: Array<{ key: string; path: LatLng[]; low: boolean }> = []
    let cur: LatLng[] = []
    let curLow = false
    path.forEach((p, i) => {
      const ll = toLatLng(p.lat, p.lng)
      if (!ll) return
      const low = p.qualityLevel === 'low_confidence'
      if (!cur.length) {
        cur = [ll]
        curLow = low
        return
      }
      if (low !== curLow) {
        if (cur.length >= 2) out.push({ key: `fb-${out.length}`, path: cur, low: curLow })
        cur = [cur[cur.length - 1], ll]
        curLow = low
      } else {
        cur.push(ll)
      }
      if (i === path.length - 1 && cur.length >= 2) {
        out.push({ key: `fb-${out.length}`, path: cur, low: curLow })
      }
    })
    return out
  }, [data])
  const actualSegments = useMemo(
    () =>
      qualityPolylines.length
        ? []
        : pathSegmentsWithoutGaps(data?.path || [], layers.gaps ? data?.gaps || [] : []),
    [data, layers.gaps, qualityPolylines.length]
  )
  const plannedPath = useMemo(() => {
    const fromPath: LatLng[] = []
    for (const p of data?.plannedRoute?.path || []) {
      const ll = toLatLng(p.lat, p.lng)
      if (ll) fromPath.push(ll)
    }
    if (fromPath.length) return fromPath
    const fromStops: LatLng[] = []
    for (const s of data?.plannedRoute?.stops || []) {
      const ll = toLatLng(s.lat, s.lng)
      if (ll) fromStops.push(ll)
    }
    return fromStops
  }, [data])
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

  const scrub = playbackPosition ? toLatLng(playbackPosition.lat, playbackPosition.lng) : null
  const checkInPos = data?.checkIn ? toLatLng(data.checkIn.lat, data.checkIn.lng) : null
  const checkOutPos = data?.checkOut ? toLatLng(data.checkOut.lat, data.checkOut.lng) : null

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
        <Chip
          size='small'
          label='High confidence'
          variant='outlined'
          sx={{ bgcolor: 'background.paper', borderColor: ACTUAL_COLOR, color: ACTUAL_COLOR }}
        />
        <Chip
          size='small'
          label='Low confidence GPS'
          variant='outlined'
          sx={{
            bgcolor: 'background.paper',
            borderColor: LOW_CONFIDENCE_COLOR,
            color: LOW_CONFIDENCE_COLOR
          }}
        />
      </Stack>
      <GeoMapShell height='100%' points={points} fitKey={fitKey} autoFit='once'>
        {qualityPolylines.map((seg) => (
          <Polyline
            key={seg.key}
            path={seg.path}
            strokeColor={seg.low ? LOW_CONFIDENCE_COLOR : ACTUAL_COLOR}
            strokeWeight={seg.low ? 3 : 4}
            strokeOpacity={seg.low ? 0.55 : 0.9}
          />
        ))}
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
              const start = gapStart(gap)
              const end = gapEnd(gap)
              if (start && end) {
                return (
                  <Polyline
                    key={`gap-line-${idx}`}
                    path={[start, end]}
                    strokeColor={GAP_COLOR}
                    strokeWeight={3}
                    strokeOpacity={0.45}
                  />
                )
              }
              if (start) {
                return (
                  <AdvancedMarker
                    key={`gap-start-${idx}`}
                    position={start}
                    title={gap.reason || gap.type || 'GPS gap'}
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
        {checkInPos ? (
          <AdvancedMarker position={checkInPos} title='Check-in'>
            <DoctorMapPin variant='verified' />
          </AdvancedMarker>
        ) : null}
        {checkOutPos ? (
          <AdvancedMarker position={checkOutPos} title='Check-out'>
            <DoctorMapPin variant='default' />
          </AdvancedMarker>
        ) : null}
        {layers.visits
          ? (data?.visits || []).map((visit, idx) => {
              const pos = toLatLng(visit.lat, visit.lng)
              if (!pos) return null
              return (
                <AdvancedMarker
                  key={`visit-${visit.doctorId || idx}-${visit.at || idx}`}
                  position={pos}
                  title={visit.doctorName || 'Visit'}
                >
                  <VisitPin visit={visit} />
                </AdvancedMarker>
              )
            })
          : null}
        {layers.stops
          ? (data?.stops || []).map((stop, idx) => {
              const pos = toLatLng(stop.lat, stop.lng)
              if (!pos) return null
              const color = stopMarkerColor(stop)
              return (
                <AdvancedMarker
                  key={`stop-${idx}-${stop.startedAt || idx}`}
                  position={pos}
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
        {scrub ? (
          <AdvancedMarker position={scrub} title='Playback position'>
            <ScrubPin />
          </AdvancedMarker>
        ) : null}
      </GeoMapShell>
    </Box>
  )
}
