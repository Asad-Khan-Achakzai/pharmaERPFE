'use client'

import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'

const MapPlaceholder = dynamic(
  () => import('@/geo/components/GeoMapInner').then(m => m.GeoMapInner),
  {
    ssr: false,
    loading: () => (
      <Box className='flex h-full min-h-[280px] items-center justify-center'>
        <CircularProgress size={28} />
      </Box>
    )
  }
)

type GeoMapProps = {
  height?: number | string
  className?: string
}

/** Single web map entry point — loads Google Maps SDK when tenant has geo enabled. */
export function GeoMap({ height = 360, className }: GeoMapProps) {
  const { geoPlatform, loading, isEnabled } = useGeoFeatures()

  if (loading) {
    return (
      <Box className='flex items-center justify-center' sx={{ height }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (!geoPlatform.enabled) {
    return (
      <Box className='flex items-center justify-center p-6 text-center' sx={{ height }}>
        <Typography color='text.secondary'>Geo Platform is not enabled for this company.</Typography>
      </Box>
    )
  }

  if (!isEnabled('managerLiveMap') && !isEnabled('dailyPlanMaps') && !isEnabled('doctorMaps') && !isEnabled('heatMaps') && !isEnabled('territoryPolygons')) {
    return (
      <Box className='flex items-center justify-center p-6 text-center' sx={{ height }}>
        <Typography color='text.secondary'>No map features are enabled for this company.</Typography>
      </Box>
    )
  }

  const apiKey = geoPlatform.maps.webApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  if (!apiKey) {
    return (
      <Box className='flex items-center justify-center p-6 text-center' sx={{ height }}>
        <Typography color='text.secondary'>
          Google Maps API key is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or server maps.webApiKey.
        </Typography>
      </Box>
    )
  }

  return <MapPlaceholder apiKey={apiKey} height={height} className={className} />
}
