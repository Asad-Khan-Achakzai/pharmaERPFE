'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'
import { fetchGeoReplay } from '@/geo/services/geo.service'
import { ReplayMapScene, type ReplayPayload } from '@/geo/scenes/ReplayMapScene'
import { showApiError } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'
import { usersService } from '@/services/users.service'

type TeamMember = { _id: string; name: string }

export default function GeoReplaySection() {
  const { isEnabled } = useGeoFeatures()
  const enabled = isEnabled('routeReplay')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState(formatYyyyMmDd(new Date()))
  const [data, setData] = useState<ReplayPayload | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    void usersService
      .assignable()
      .then((res) => setMembers((res?.data?.data || res?.data || []) as TeamMember[]))
      .catch(() => setMembers([]))
  }, [enabled])

  const loadReplay = useCallback(async () => {
    if (!userId || !date) return
    setLoading(true)
    try {
      const res = (await fetchGeoReplay({ userId, date })) as ReplayPayload
      setData(res)
    } catch (e) {
      setData(null)
      showApiError(e, 'Could not load route replay')
    } finally {
      setLoading(false)
    }
  }, [userId, date])

  if (!enabled) return null

  const fullHistoryHref =
    userId && date
      ? `/team/route-history?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`
      : '/team/route-history'

  return (
    <Card variant='outlined' className='mbe-4'>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent='space-between'
          className='mbe-2'
        >
          <Typography variant='subtitle2'>Route replay</Typography>
          <Button
            component={Link}
            href={fullHistoryHref}
            size='small'
            variant='text'
            startIcon={<i className='tabler-route' />}
          >
            Open full Route History
          </Button>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className='mbe-3'>
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
          <AppReactDatepicker
            selected={parseYyyyMmDd(date) ?? null}
            dateFormat='yyyy-MM-dd'
            onChange={(d: Date | null) => setDate(d ? formatYyyyMmDd(d) : '')}
            customInput={<CustomTextField size='small' label='Date' sx={{ minWidth: 180 }} />}
          />
          <Button variant='outlined' onClick={() => void loadReplay()} disabled={!userId || loading}>
            {loading ? 'Loading…' : 'Load replay'}
          </Button>
        </Stack>
        {loading ? (
          <Skeleton variant='rounded' height={320} />
        ) : data ? (
          <>
            <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
              {data.path.length} GPS points · {data.visits.length} visits
            </Typography>
            <ReplayMapScene data={data} height={320} />
          </>
        ) : (
          <Typography color='text.secondary'>Select a rep and date to replay their route.</Typography>
        )}
      </CardContent>
    </Card>
  )
}
