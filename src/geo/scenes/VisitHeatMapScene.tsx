'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { GeoHeatmapLayer } from '@/geo/components/GeoHeatmapLayer'
import { fetchGeoHeatMap, type GeoHeatMapPayload } from '@/geo/services/geo.service'
import type { LatLng } from '@/geo/utils/mapBounds'

export function VisitHeatMapScene({
  from,
  to,
  height = 380
}: {
  from?: string
  to?: string
  height?: number | string
}) {
  const [data, setData] = useState<GeoHeatMapPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchGeoHeatMap({ from, to })
      .then(res => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load visit heat map.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  const points: LatLng[] = useMemo(
    () => (data?.points || []).map(p => ({ lat: p.lat, lng: p.lng })),
    [data]
  )

  if (loading) {
    return (
      <Box className='flex items-center justify-center' sx={{ height }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box className='flex items-center justify-center p-6 text-center' sx={{ height }}>
        <Typography color='text.secondary'>{error}</Typography>
      </Box>
    )
  }

  if (!points.length) {
    return (
      <Box
        className='flex flex-col items-center justify-center p-6 text-center'
        sx={{ height, borderRadius: 1, border: 1, borderColor: 'divider' }}
      >
        <Typography variant='body2' color='text.secondary'>
          No visit GPS points in this date range. Heat maps need completed visits with location coordinates.
        </Typography>
      </Box>
    )
  }

  return (
    <GeoMapShell height={height} points={points}>
      <GeoHeatmapLayer points={data?.points || []} />
    </GeoMapShell>
  )
}
