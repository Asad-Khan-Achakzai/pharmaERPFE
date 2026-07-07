'use client'

import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'
import { fetchGeoTravelAnalytics } from '@/geo/services/geo.service'
import { showApiError } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'
import { usersService } from '@/services/users.service'

type TravelAnalytics = {
  userId: string
  date: string
  heartbeatPings: number
  estimatedDistanceMeters: number | null
  visitsCompleted: number
}

type TeamMember = { _id: string; name: string }

export default function GeoTravelAnalyticsSection() {
  const { isEnabled } = useGeoFeatures()
  const enabled = isEnabled('travelAnalytics')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState(formatYyyyMmDd(new Date()))
  const [data, setData] = useState<TravelAnalytics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    void usersService
      .assignable()
      .then((res) => setMembers((res?.data?.data || res?.data || []) as TeamMember[]))
      .catch(() => setMembers([]))
  }, [enabled])

  const load = async () => {
    if (!userId || !date) return
    setLoading(true)
    try {
      const res = (await fetchGeoTravelAnalytics({ userId, date })) as TravelAnalytics
      setData(res)
    } catch (e) {
      setData(null)
      showApiError(e, 'Could not load travel analytics')
    } finally {
      setLoading(false)
    }
  }

  if (!enabled) return null

  return (
    <Card variant='outlined' className='mbe-4'>
      <CardContent>
        <Typography variant='subtitle2' className='mbe-2'>
          Travel analytics
        </Typography>
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
          <Button variant='outlined' onClick={() => void load()} disabled={!userId || loading}>
            Load
          </Button>
        </Stack>
        {loading ? (
          <Skeleton variant='rounded' height={72} />
        ) : data ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                GPS pings
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {data.heartbeatPings}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Est. distance
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {data.estimatedDistanceMeters != null
                  ? `${Math.round(data.estimatedDistanceMeters / 1000)} km`
                  : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Visits completed
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {data.visitsCompleted}
              </Typography>
            </Grid>
          </Grid>
        ) : (
          <Typography color='text.secondary'>Select a rep and date for travel summary.</Typography>
        )}
      </CardContent>
    </Card>
  )
}
