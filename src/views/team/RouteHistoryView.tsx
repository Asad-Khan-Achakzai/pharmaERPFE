'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { format, isValid } from 'date-fns'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'
import { downloadCsv } from '@/utils/teamForest'
import { showApiError } from '@/utils/apiErrors'
import { usersService } from '@/services/users.service'
import { useGeoFeatures, GeoFeatureGate } from '@/geo/GeoPlatformProvider'
import { RouteHistoryScene } from '@/geo/scenes/RouteHistoryScene'
import { useRoutePlayback, type RoutePlaybackSpeed } from '@/geo/hooks/useRoutePlayback'
import {
  fetchGeoRouteHistory,
  fetchGeoRouteHistoryCompare,
  fetchGeoRouteHistoryRange,
  fetchGeoRouteHistoryHeatmap,
  type RouteHistoryComparePayload,
  type RouteHistoryDaySummaryRow,
  type RouteHistoryEvent,
  type RouteHistoryGap,
  type RouteHistoryPayload,
  type RouteHistoryQuality,
  type RouteHistorySummary
} from '@/geo/services/geo.service'

type TeamMember = { _id: string; name: string }
type Mode = 'day' | 'compare' | 'range'

function formatDurationMs(ms?: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function formatDistance(summary?: RouteHistorySummary): string {
  if (!summary) return '—'
  if (summary.distanceKm != null && Number.isFinite(summary.distanceKm)) {
    return `${summary.distanceKm.toFixed(1)} km`
  }
  if (summary.distanceMeters != null && Number.isFinite(summary.distanceMeters)) {
    return `${(summary.distanceMeters / 1000).toFixed(1)} km`
  }
  return '—'
}

function formatWorkingHours(summary?: RouteHistorySummary): string {
  if (!summary) return '—'
  if (summary.workingHoursHours != null) return `${summary.workingHoursHours.toFixed(1)}h`
  return formatDurationMs(summary.workingHoursMs)
}

function formatCoverage(summary?: RouteHistorySummary): string {
  const pct = summary?.coveragePercent ?? summary?.territoryCoveragePercent
  if (pct == null || !Number.isFinite(pct)) return '—'
  return `${Math.round(pct)}%`
}

function qualityChip(
  quality?: RouteHistoryQuality | null
): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  const raw = (quality?.label || quality?.band || '').toString()
  const lower = raw.toLowerCase()
  if (lower.includes('trust')) return { label: raw || 'Trusted', color: 'success' }
  if (lower.includes('partial')) return { label: raw || 'Partial', color: 'warning' }
  if (lower.includes('unreliab')) return { label: raw || 'Unreliable', color: 'error' }
  if (quality?.score != null) {
    if (quality.score >= 75) return { label: `Trusted (${quality.score})`, color: 'success' }
    if (quality.score >= 45) return { label: `Partial (${quality.score})`, color: 'warning' }
    return { label: `Unreliable (${quality.score})`, color: 'error' }
  }
  return { label: 'Unknown', color: 'default' }
}

function formatClock(ms: number | null): string {
  if (ms == null) return '—'
  const d = new Date(ms)
  if (!isValid(d)) return '—'
  return format(d, 'HH:mm:ss')
}

type TimelineItem = {
  id: string
  atMs: number
  label: string
  kind: 'event' | 'gap' | 'visit' | 'checkin' | 'checkout'
  secondary?: string
}

function buildTimeline(data: RouteHistoryPayload | null): TimelineItem[] {
  if (!data) return []
  const items: TimelineItem[] = []

  if (data.checkIn?.at) {
    const t = new Date(data.checkIn.at).getTime()
    if (Number.isFinite(t)) {
      items.push({ id: 'checkin', atMs: t, label: 'Check-in', kind: 'checkin' })
    }
  }
  if (data.checkOut?.at) {
    const t = new Date(data.checkOut.at).getTime()
    if (Number.isFinite(t)) {
      items.push({ id: 'checkout', atMs: t, label: 'Check-out', kind: 'checkout' })
    }
  }

  ;(data.events || []).forEach((ev: RouteHistoryEvent, idx) => {
    if (!ev.at) return
    const t = new Date(ev.at).getTime()
    if (!Number.isFinite(t)) return
    items.push({
      id: `event-${idx}`,
      atMs: t,
      label: ev.label || ev.type || 'Event',
      kind: 'event',
      secondary: ev.type
    })
  })

  ;(data.gaps || []).forEach((gap: RouteHistoryGap, idx) => {
    if (!gap.from) return
    const t = new Date(gap.from).getTime()
    if (!Number.isFinite(t)) return
    items.push({
      id: `gap-${idx}`,
      atMs: t,
      label: gap.reason || 'GPS gap',
      kind: 'gap',
      secondary: formatDurationMs(gap.durationMs)
    })
  })

  ;(data.visits || []).forEach((v, idx) => {
    if (!v.at) return
    const t = new Date(v.at).getTime()
    if (!Number.isFinite(t)) return
    const fence =
      v.geoFenceResult === 'OUTSIDE_RADIUS'
        ? 'Outside fence'
        : v.geoFenceResult === 'INSIDE_RADIUS'
          ? 'Inside fence'
          : undefined
    items.push({
      id: `visit-${idx}`,
      atMs: t,
      label: v.doctorName || 'Visit',
      kind: 'visit',
      secondary: fence
    })
  })

  items.sort((a, b) => a.atMs - b.atMs)
  return items
}

function exportRouteHistoryCsv(data: RouteHistoryPayload, memberName: string) {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const lines: string[] = []
  lines.push('section,key,value')
  lines.push(`meta,rep,${escape(memberName)}`)
  lines.push(`meta,date,${escape(data.date)}`)
  const q = qualityChip(data.quality)
  lines.push(`meta,quality,${escape(q.label)}`)
  const s = data.summary
  if (s) {
    lines.push(`summary,workingHours,${escape(formatWorkingHours(s))}`)
    lines.push(`summary,distance,${escape(formatDistance(s))}`)
    lines.push(`summary,drivingTime,${escape(formatDurationMs(s.drivingTimeMs))}`)
    lines.push(`summary,visitTime,${escape(formatDurationMs(s.visitTimeMs))}`)
    lines.push(`summary,idleTime,${escape(formatDurationMs(s.idleTimeMs))}`)
    lines.push(`summary,visits,${escape(s.visitsCompleted)}`)
    lines.push(`summary,orders,${escape(s.ordersBooked)}`)
    lines.push(`summary,coverage,${escape(formatCoverage(s))}`)
  }
  lines.push('')
  lines.push('at,type,label,detail')
  for (const item of buildTimeline(data)) {
    lines.push(
      [
        escape(new Date(item.atMs).toISOString()),
        escape(item.kind),
        escape(item.label),
        escape(item.secondary || '')
      ].join(',')
    )
  }
  downloadCsv(`route-history-${data.date || 'day'}.csv`, lines.join('\n'))
}

function SummaryCards({
  summary,
  quality,
  pathCount
}: {
  summary?: RouteHistorySummary
  quality?: RouteHistoryQuality | null
  pathCount?: number
}) {
  const q = qualityChip(quality)
  const cards: Array<{ label: string; value: string }> = [
    { label: 'Working hours', value: formatWorkingHours(summary) },
    { label: 'Distance', value: formatDistance(summary) },
    { label: 'Driving', value: formatDurationMs(summary?.drivingTimeMs) },
    { label: 'Visiting', value: formatDurationMs(summary?.visitTimeMs) },
    { label: 'Idle', value: formatDurationMs(summary?.idleTimeMs) },
    {
      label: 'Visits',
      value:
        summary?.visitsCompleted != null
          ? summary.visitsPlanned != null
            ? `${summary.visitsCompleted}/${summary.visitsPlanned}`
            : String(summary.visitsCompleted)
          : pathCount != null
            ? '—'
            : '—'
    },
    { label: 'Orders', value: summary?.ordersBooked != null ? String(summary.ordersBooked) : '—' },
    { label: 'Coverage', value: formatCoverage(summary) }
  ]

  return (
    <Grid container spacing={2} className='mbe-3'>
      {cards.map((c) => (
        <Grid key={c.label} size={{ xs: 6, sm: 4, md: 3 }}>
          <Card variant='outlined' sx={{ height: '100%' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                {c.label}
              </Typography>
              <Typography variant='subtitle1' fontWeight={700}>
                {c.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
      <Grid size={{ xs: 6, sm: 4, md: 3 }}>
        <Card variant='outlined' sx={{ height: '100%' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant='caption' color='text.secondary' display='block'>
              Quality
            </Typography>
            <Chip size='small' label={q.label} color={q.color} variant='tonal' sx={{ mt: 0.5 }} />
            {quality?.reasons?.length ? (
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                {quality.reasons[0]}
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

function DeltaCards({ compare }: { compare: RouteHistoryComparePayload }) {
  const a = compare.a?.summary
  const b = compare.b?.summary
  const rows: Array<{ label: string; a: string; b: string; delta?: string }> = [
    {
      label: 'Working hours',
      a: formatWorkingHours(a),
      b: formatWorkingHours(b),
      delta:
        a?.workingHoursMs != null && b?.workingHoursMs != null
          ? formatDurationMs(b.workingHoursMs - a.workingHoursMs)
          : undefined
    },
    {
      label: 'Distance',
      a: formatDistance(a),
      b: formatDistance(b)
    },
    {
      label: 'Visits',
      a: a?.visitsCompleted != null ? String(a.visitsCompleted) : '—',
      b: b?.visitsCompleted != null ? String(b.visitsCompleted) : '—',
      delta:
        a?.visitsCompleted != null && b?.visitsCompleted != null
          ? String(b.visitsCompleted - a.visitsCompleted)
          : undefined
    },
    {
      label: 'Coverage',
      a: formatCoverage(a),
      b: formatCoverage(b)
    },
    {
      label: 'Quality',
      a: qualityChip(compare.a?.quality).label,
      b: qualityChip(compare.b?.quality).label
    }
  ]

  return (
    <Grid container spacing={2} className='mbe-3'>
      {rows.map((r) => (
        <Grid key={r.label} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant='outlined'>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant='caption' color='text.secondary'>
                {r.label}
              </Typography>
              <Stack direction='row' spacing={2} alignItems='baseline' sx={{ mt: 0.5 }}>
                <Typography variant='body2'>
                  {compare.dateA}: <strong>{r.a}</strong>
                </Typography>
                <Typography variant='body2'>
                  {compare.dateB}: <strong>{r.b}</strong>
                </Typography>
                {r.delta != null ? (
                  <Chip size='small' label={`Δ ${r.delta}`} variant='tonal' />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

export default function RouteHistoryView() {
  const searchParams = useSearchParams()
  const { isEnabled } = useGeoFeatures()
  const enabled = isEnabled('routeReplay')

  const [members, setMembers] = useState<TeamMember[]>([])
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState(formatYyyyMmDd(new Date()))
  const [compareDate, setCompareDate] = useState('')
  const [rangeFrom, setRangeFrom] = useState(formatYyyyMmDd(new Date(Date.now() - 6 * 86400000)))
  const [rangeTo, setRangeTo] = useState(formatYyyyMmDd(new Date()))
  const [mode, setMode] = useState<Mode>('day')
  const [data, setData] = useState<RouteHistoryPayload | null>(null)
  const [compare, setCompare] = useState<RouteHistoryComparePayload | null>(null)
  const [rangeRows, setRangeRows] = useState<RouteHistoryDaySummaryRow[]>([])
  const [heatmapPoints, setHeatmapPoints] = useState<
    Array<{ lat: number; lng: number; weight?: number }>
  >([])
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const uid = searchParams.get('userId')
    const d = searchParams.get('date')
    if (uid) setUserId(uid)
    if (d === 'today' || !d) {
      if (d === 'today') setDate(formatYyyyMmDd(new Date()))
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setDate(d)
    }
    setHydrated(true)
  }, [searchParams])

  useEffect(() => {
    if (!enabled) return
    void usersService
      .assignable()
      .then((res) => setMembers((res?.data?.data || res?.data || []) as TeamMember[]))
      .catch(() => setMembers([]))
  }, [enabled])

  const memberName = useMemo(
    () => members.find((m) => m._id === userId)?.name || userId,
    [members, userId]
  )

  const playback = useRoutePlayback(data?.path || [])
  const timeline = useMemo(() => buildTimeline(data), [data])

  const loadDay = useCallback(async () => {
    if (!userId || !date) return
    setLoading(true)
    setCompare(null)
    setRangeRows([])
    try {
      const res = await fetchGeoRouteHistory({ userId, date, downsample: true, maxPoints: 2000 })
      setData(res)
    } catch (e) {
      setData(null)
      showApiError(e, 'Could not load route history')
    } finally {
      setLoading(false)
    }
  }, [userId, date])

  const loadCompare = useCallback(async () => {
    if (!userId || !date || !compareDate) return
    setLoading(true)
    try {
      const [day, cmp] = await Promise.all([
        fetchGeoRouteHistory({ userId, date, downsample: true, maxPoints: 2000 }),
        fetchGeoRouteHistoryCompare({ userId, dateA: date, dateB: compareDate }).catch(() => null)
      ])
      setData(day)
      if (cmp) {
        setCompare(cmp)
      } else {
        const other = await fetchGeoRouteHistory({
          userId,
          date: compareDate,
          downsample: true,
          maxPoints: 500
        })
        setCompare({
          dateA: date,
          dateB: compareDate,
          a: { summary: day.summary, quality: day.quality },
          b: { summary: other.summary, quality: other.quality }
        })
      }
      setRangeRows([])
    } catch (e) {
      setData(null)
      setCompare(null)
      showApiError(e, 'Could not compare route history')
    } finally {
      setLoading(false)
    }
  }, [userId, date, compareDate])

  const loadRange = useCallback(async () => {
    if (!userId || !rangeFrom || !rangeTo) return
    setLoading(true)
    setData(null)
    setCompare(null)
    setHeatmapPoints([])
    try {
      const [rows, heat] = await Promise.all([
        fetchGeoRouteHistoryRange({ userId, from: rangeFrom, to: rangeTo }),
        fetchGeoRouteHistoryHeatmap({ userId, from: rangeFrom, to: rangeTo }).catch(() => ({
          points: [] as Array<{ lat: number; lng: number; weight?: number }>
        }))
      ])
      setRangeRows(rows)
      setHeatmapPoints(heat.points || [])
    } catch (e) {
      setRangeRows([])
      setHeatmapPoints([])
      showApiError(e, 'Could not load route history range')
    } finally {
      setLoading(false)
    }
  }, [userId, rangeFrom, rangeTo])

  const handleLoad = useCallback(() => {
    if (mode === 'compare') void loadCompare()
    else if (mode === 'range') void loadRange()
    else void loadDay()
  }, [mode, loadCompare, loadRange, loadDay])

  useEffect(() => {
    if (!hydrated || !enabled || !userId || !date) return
    if (searchParams.get('userId')) void loadDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-load once from deep link
  }, [hydrated, enabled, userId])

  if (!enabled) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center gap-3 p-8 text-center'>
          <i className='tabler-route-off text-5xl text-textSecondary' />
          <Typography variant='h6'>Route history unavailable</Typography>
          <Typography color='text.secondary'>
            Route replay is not enabled for this company. Ask an administrator to turn on the Route
            replay geo feature.
          </Typography>
          <Button component={Link} href='/team/live' variant='outlined'>
            Back to live tracking
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <GeoFeatureGate feature='routeReplay'>
      <Card>
        <CardHeader
          title='Route history'
          subheader='Day trail, visits, gaps, and productivity for a field rep'
          action={
            <Button component={Link} href='/team/live' size='small' variant='text'>
              Live tracking
            </Button>
          }
        />
        <CardContent>
          <ToggleButtonGroup
            exclusive
            size='small'
            value={mode}
            onChange={(_, v: Mode | null) => v && setMode(v)}
            className='mbe-3'
          >
            <ToggleButton value='day'>Day</ToggleButton>
            <ToggleButton value='compare'>Compare</ToggleButton>
            <ToggleButton value='range'>Range</ToggleButton>
          </ToggleButtonGroup>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'flex-end' }}
            className='mbe-3'
            useFlexGap
            flexWrap='wrap'
          >
            <CustomTextField
              select
              size='small'
              label='Field rep'
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {members.map((m) => (
                <MenuItem key={m._id} value={m._id}>
                  {m.name}
                </MenuItem>
              ))}
            </CustomTextField>

            {mode !== 'range' ? (
              <AppReactDatepicker
                selected={parseYyyyMmDd(date) ?? null}
                dateFormat='yyyy-MM-dd'
                onChange={(d: Date | null) => setDate(d ? formatYyyyMmDd(d) : '')}
                customInput={<CustomTextField size='small' label='Date' sx={{ minWidth: 170 }} />}
              />
            ) : null}

            {mode === 'compare' ? (
              <AppReactDatepicker
                selected={parseYyyyMmDd(compareDate) ?? null}
                dateFormat='yyyy-MM-dd'
                onChange={(d: Date | null) => setCompareDate(d ? formatYyyyMmDd(d) : '')}
                customInput={
                  <CustomTextField size='small' label='Compare date' sx={{ minWidth: 170 }} />
                }
              />
            ) : null}

            {mode === 'range' ? (
              <>
                <AppReactDatepicker
                  selected={parseYyyyMmDd(rangeFrom) ?? null}
                  dateFormat='yyyy-MM-dd'
                  onChange={(d: Date | null) => setRangeFrom(d ? formatYyyyMmDd(d) : '')}
                  customInput={<CustomTextField size='small' label='From' sx={{ minWidth: 170 }} />}
                />
                <AppReactDatepicker
                  selected={parseYyyyMmDd(rangeTo) ?? null}
                  dateFormat='yyyy-MM-dd'
                  onChange={(d: Date | null) => setRangeTo(d ? formatYyyyMmDd(d) : '')}
                  customInput={<CustomTextField size='small' label='To' sx={{ minWidth: 170 }} />}
                />
              </>
            ) : null}

            <Button
              variant='contained'
              onClick={handleLoad}
              disabled={
                !userId ||
                loading ||
                (mode === 'compare' && !compareDate) ||
                (mode === 'range' && (!rangeFrom || !rangeTo))
              }
            >
              {loading ? 'Loading…' : 'Load'}
            </Button>

            {data && mode !== 'range' ? (
              <Button
                variant='outlined'
                startIcon={<i className='tabler-download' />}
                onClick={() => exportRouteHistoryCsv(data, memberName)}
              >
                Export CSV
              </Button>
            ) : null}
          </Stack>

          {loading ? <Skeleton variant='rounded' height={120} className='mbe-3' /> : null}

          {!loading && mode === 'compare' && compare ? <DeltaCards compare={compare} /> : null}

          {!loading && mode !== 'range' && data ? (
            <SummaryCards
              summary={data.summary}
              quality={data.quality}
              pathCount={data.path?.length}
            />
          ) : null}

          {mode === 'range' ? (
            loading ? (
              <Skeleton variant='rounded' height={240} />
            ) : rangeRows.length ? (
              <>
                {heatmapPoints.length ? (
                  <Alert severity='info' sx={{ mb: 2 }}>
                    Historical density: {heatmapPoints.length} grid cells from GPS trail (
                    {heatmapPoints.reduce((s, p) => s + (p.weight || 1), 0)} samples). Frequent
                    corridors appear as higher weight cells for coverage analysis.
                  </Alert>
                ) : null}
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Working hours</TableCell>
                    <TableCell>Distance</TableCell>
                    <TableCell>Visits</TableCell>
                    <TableCell>Coverage</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell align='right'>Open</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rangeRows.map((row) => {
                    const q = qualityChip(row.quality)
                    const summary = row.summary
                    return (
                      <TableRow key={row.date} hover>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{formatWorkingHours(summary)}</TableCell>
                        <TableCell>
                          {row.distanceKm != null
                            ? `${row.distanceKm.toFixed(1)} km`
                            : formatDistance(summary)}
                        </TableCell>
                        <TableCell>
                          {row.visitsCompleted ?? summary?.visitsCompleted ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.coveragePercent != null
                            ? `${Math.round(row.coveragePercent)}%`
                            : formatCoverage(summary)}
                        </TableCell>
                        <TableCell>
                          <Chip size='small' label={q.label} color={q.color} variant='tonal' />
                        </TableCell>
                        <TableCell align='right'>
                          <Button
                            size='small'
                            onClick={() => {
                              setMode('day')
                              setDate(row.date)
                              setLoading(true)
                              void fetchGeoRouteHistory({
                                userId,
                                date: row.date,
                                downsample: true,
                                maxPoints: 2000
                              })
                                .then((res) => {
                                  setData(res)
                                  setRangeRows([])
                                })
                                .catch((e) => {
                                  setData(null)
                                  showApiError(e, 'Could not load route history')
                                })
                                .finally(() => setLoading(false))
                            }}
                          >
                            View day
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </>
            ) : (
              <Typography color='text.secondary'>
                Select a rep and date range, then load daily summaries.
              </Typography>
            )
          ) : null}

          {mode !== 'range' ? (
            loading && !data ? (
              <Skeleton variant='rounded' height={420} />
            ) : data ? (
              <>
                <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                  {(data.path?.length ?? 0)} GPS points · {(data.visits?.length ?? 0)} visits ·{' '}
                  {(data.gaps?.length ?? 0)} gaps · {(data.stops?.length ?? 0)} stops
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <RouteHistoryScene
                      height={420}
                      data={data}
                      playbackPosition={playback.currentPosition}
                    />
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ sm: 'center' }}
                      sx={{ mt: 2 }}
                    >
                      <Button
                        variant='contained'
                        size='small'
                        onClick={playback.toggle}
                        disabled={!playback.hasPath}
                        startIcon={
                          <i className={playback.playing ? 'tabler-player-pause' : 'tabler-player-play'} />
                        }
                      >
                        {playback.playing ? 'Pause' : 'Play'}
                      </Button>
                      <ToggleButtonGroup
                        exclusive
                        size='small'
                        value={playback.speed}
                        onChange={(_, v: RoutePlaybackSpeed | null) => v && playback.setSpeed(v)}
                      >
                        {([1, 2, 4, 8] as RoutePlaybackSpeed[]).map((s) => (
                          <ToggleButton key={s} value={s}>
                            {s}x
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <Typography variant='caption' color='text.secondary' sx={{ minWidth: 110 }}>
                        {formatClock(playback.currentTime)} / {formatClock(playback.endMs)}
                      </Typography>
                      <Slider
                        size='small'
                        value={playback.progress * 100}
                        disabled={!playback.hasPath}
                        onChange={(_, v) => playback.seekProgress((v as number) / 100)}
                        sx={{ flex: 1, minWidth: 120 }}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, lg: 5 }}>
                    <Card variant='outlined' sx={{ height: 420, overflow: 'auto' }}>
                      <CardContent>
                        <Typography variant='subtitle2' className='mbe-2'>
                          Timeline
                        </Typography>
                        {timeline.length === 0 ? (
                          <Typography color='text.secondary' variant='body2'>
                            No timeline events for this day.
                          </Typography>
                        ) : (
                          <Stack spacing={1}>
                            {timeline.map((item) => {
                              const active =
                                playback.currentTime != null &&
                                Math.abs(playback.currentTime - item.atMs) < 90_000
                              return (
                                <Box
                                  key={item.id}
                                  onClick={() => playback.seek(item.atMs)}
                                  sx={{
                                    p: 1,
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    bgcolor: active ? 'action.selected' : 'transparent',
                                    '&:hover': { bgcolor: 'action.hover' }
                                  }}
                                >
                                  <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography
                                      variant='caption'
                                      color='text.secondary'
                                      sx={{ minWidth: 56 }}
                                    >
                                      {format(new Date(item.atMs), 'HH:mm')}
                                    </Typography>
                                    <Chip
                                      size='small'
                                      label={item.kind}
                                      variant='tonal'
                                      color={
                                        item.kind === 'gap'
                                          ? 'warning'
                                          : item.kind === 'visit'
                                            ? 'success'
                                            : 'default'
                                      }
                                    />
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography variant='body2' noWrap>
                                        {item.label}
                                      </Typography>
                                      {item.secondary ? (
                                        <Typography variant='caption' color='text.secondary'>
                                          {item.secondary}
                                        </Typography>
                                      ) : null}
                                    </Box>
                                  </Stack>
                                </Box>
                              )
                            })}
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
            ) : (
              <Typography color='text.secondary'>
                Select a field rep and date, then load their route history.
              </Typography>
            )
          ) : null}
        </CardContent>
      </Card>
    </GeoFeatureGate>
  )
}
