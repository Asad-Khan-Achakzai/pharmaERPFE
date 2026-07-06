'use client'

import { useEffect, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'
import { fetchGeoRouteAnalytics } from '@/geo/services/geo.service'
import { showApiError } from '@/utils/apiErrors'

type RouteAnalytics = {
  from: string
  to: string
  visitsRecorded: number
  visitsOutsideGeoFence: number
  averageDistanceFromDoctorMeters: number | null
}

export default function GeoAnalyticsSection({ from, to }: { from?: string; to?: string }) {
  const { isEnabled } = useGeoFeatures()
  const enabled = isEnabled('routeAnalytics')
  const [data, setData] = useState<RouteAnalytics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchGeoRouteAnalytics({ from, to })
      .then((res) => {
        if (!cancelled) setData(res as RouteAnalytics)
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null)
          showApiError(e, 'Could not load geo analytics')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, enabled])

  if (!enabled) return null

  return (
    <>
      <Card variant='outlined' className='mbe-4'>
        <CardContent>
          <Typography variant='subtitle2' className='mbe-2'>
            Geo route analytics
          </Typography>
          {loading ? (
            <Skeleton variant='rounded' height={72} />
          ) : data ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Visits recorded
                </Typography>
                <Typography variant='h6' fontWeight={700}>
                  {data.visitsRecorded}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Outside geo-fence
                </Typography>
                <Typography variant='h6' fontWeight={700}>
                  {data.visitsOutsideGeoFence}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Avg distance from doctor
                </Typography>
                <Typography variant='h6' fontWeight={700}>
                  {data.averageDistanceFromDoctorMeters != null
                    ? `${data.averageDistanceFromDoctorMeters} m`
                    : '—'}
                </Typography>
              </Grid>
            </Grid>
          ) : (
            <Typography color='text.secondary'>No geo analytics for this period.</Typography>
          )}
        </CardContent>
      </Card>
    </>
  )
}
