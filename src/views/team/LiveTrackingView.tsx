'use client'

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { attendanceService } from '@/services/attendance.service'
import { useAuth } from '@/contexts/AuthContext'
import { LiveTrackingScene } from '@/geo/scenes/LiveTrackingScene'
import { GeoFeatureGate } from '@/geo/GeoPlatformProvider'
import { showApiError } from '@/utils/apiErrors'
import type { LiveAttendanceStatus, LiveRepLocation } from '@/types/liveTracking'

const REFRESH_MS = 60_000

function canAccessLiveTracking(hasPermission: (p: string) => boolean): boolean {
  return (
    hasPermission('admin.access') ||
    hasPermission('team.view') ||
    hasPermission('team.viewAllReports') ||
    hasPermission('attendance.viewTeam')
  )
}

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function hasLiveLocation(item: LiveRepLocation): boolean {
  return item.lat != null && item.lng != null && item.ageSeconds != null
}

function freshnessChip(item: LiveRepLocation): { label: string; color: 'success' | 'warning' | 'default' } {
  if (!hasLiveLocation(item)) return { label: 'No recent location', color: 'default' }
  if (item.ageSeconds! < 60) return { label: 'Live', color: 'success' }
  if (item.ageSeconds! < 600) {
    return { label: `${Math.round(item.ageSeconds! / 60)}m ago`, color: 'success' }
  }
  return { label: `${Math.round(item.ageSeconds! / 60)}m ago`, color: 'warning' }
}

function attendanceChip(status: LiveAttendanceStatus): {
  label: string
  color: 'success' | 'warning' | 'default' | 'info'
} {
  switch (status) {
    case 'CHECKED_IN':
      return { label: 'Checked in', color: 'success' }
    case 'CHECKED_OUT':
      return { label: 'Checked out', color: 'default' }
    case 'LATE_CHECKIN_PENDING':
      return { label: 'Late check-in pending', color: 'warning' }
    default:
      return { label: 'Not checked in', color: 'default' }
  }
}

function locationSubtitle(item: LiveRepLocation, located: boolean): string {
  if (located) {
    const coords = `${item.lat!.toFixed(5)}, ${item.lng!.toFixed(5)}${
      item.accuracy != null ? ` · ±${Math.round(item.accuracy)}m` : ''
    }`
    if (item.locationSource === 'checkin') return `${coords} · check-in location`
    if (item.attendanceStatus === 'CHECKED_OUT') return `${coords} · last ping before check-out`
    return coords
  }
  if (item.attendanceStatus === 'CHECKED_OUT') return 'Checked out · no GPS ping in the last 30 minutes'
  if (item.attendanceStatus === 'NOT_CHECKED_IN') return 'Not checked in today'
  return 'Checked in · no GPS ping in the last 30 minutes'
}

export default function LiveTrackingView() {
  const { hasPermission } = useAuth()
  const canAccess = canAccessLiveTracking(hasPermission)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rows, setRows] = useState<LiveRepLocation[]>([])
  const [disabledMessage, setDisabledMessage] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!canAccess) return
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await attendanceService.live()
      setRows((res.data?.data as LiveRepLocation[]) || [])
      setDisabledMessage(null)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      if (status === 403) {
        setRows([])
        setDisabledMessage(
          message || 'Live tracking is not enabled for this company. Ask an administrator to turn it on.'
        )
      } else {
        showApiError(err, 'Could not load live locations')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [canAccess])

  useEffect(() => {
    if (!canAccess) return
    void load()
    const timer = window.setInterval(() => void load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load, canAccess])

  if (!canAccess) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center gap-3 p-8 text-center'>
          <i className='tabler-lock text-5xl text-error' />
          <Typography variant='h6'>Access denied</Typography>
          <Typography color='text.secondary'>
            You need team or attendance oversight permissions to view live rep locations.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Live tracking'
        subheader='Your team roster with last known field locations (refreshes every minute). Reps send GPS every ~5 minutes while checked in, including in the background. Location data is kept for 30 minutes after each ping.'
        action={
          <Button
            variant='outlined'
            size='small'
            startIcon={<i className='tabler-refresh' />}
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            Refresh
          </Button>
        }
      />
      <CardContent>
        <GeoFeatureGate feature='managerLiveMap'>
          <Box sx={{ mb: 3 }}>
            <LiveTrackingScene height={420} rows={rows} loading={loading} />
          </Box>
        </GeoFeatureGate>
        {disabledMessage ? (
          <Box className='flex flex-col items-center gap-2 p-8 text-center'>
            <i className='tabler-map-off text-5xl text-textSecondary' />
            <Typography variant='h6'>Live tracking unavailable</Typography>
            <Typography color='text.secondary'>{disabledMessage}</Typography>
          </Box>
        ) : loading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map(n => (
              <Skeleton key={n} variant='rounded' height={96} />
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <Box className='flex flex-col items-center gap-2 p-8 text-center'>
            <i className='tabler-map-pin text-5xl text-textSecondary' />
            <Typography variant='h6'>No team members</Typography>
            <Typography color='text.secondary'>
              You have no active reports in your team scope. Assign managers on the User List if this looks wrong.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {rows.map(item => {
              const chip = freshnessChip(item)
              const attendance = attendanceChip(item.attendanceStatus ?? 'NOT_CHECKED_IN')
              const located = hasLiveLocation(item)
              const captured = item.capturedAt ? parseISO(item.capturedAt) : null
              const checkOutAt = item.checkOutTime ? parseISO(item.checkOutTime) : null
              return (
                <Grid size={{ xs: 12, md: 6 }} key={item.userId}>
                  <Card variant='outlined' sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack direction='row' alignItems='flex-start' justifyContent='space-between' spacing={2}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction='row' alignItems='center' spacing={1} sx={{ minWidth: 0 }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 700 }} noWrap>
                              {item.name}
                            </Typography>
                            <Chip size='small' label={attendance.label} color={attendance.color} variant='tonal' />
                          </Stack>
                          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                            {locationSubtitle(item, located)}
                          </Typography>
                          {located ? (
                            <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.75 }}>
                              {captured && isValid(captured)
                                ? formatDistanceToNow(captured, { addSuffix: true })
                                : 'Unknown time'}
                            </Typography>
                          ) : item.attendanceStatus === 'CHECKED_OUT' && checkOutAt && isValid(checkOutAt) ? (
                            <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.75 }}>
                              Checked out {formatDistanceToNow(checkOutAt, { addSuffix: true })}
                            </Typography>
                          ) : null}
                        </Box>
                        <Stack direction='row' spacing={1} alignItems='center'>
                          <Chip size='small' label={chip.label} color={chip.color} variant='tonal' />
                          {located ? (
                            <IconButton
                              component='a'
                              href={mapsUrl(item.lat!, item.lng!)}
                              target='_blank'
                              rel='noopener noreferrer'
                              aria-label={`Open ${item.name} on map`}
                              size='small'
                            >
                              <i className='tabler-external-link' />
                            </IconButton>
                          ) : null}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </CardContent>
    </Card>
  )
}
