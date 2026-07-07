'use client'

import { useMemo, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { APIProvider, Map } from '@vis.gl/react-google-maps'
import { useGeoMapApiKey, useGeoMapId } from '@/geo/hooks/useGeoMapApiKey'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'
import { fitBounds, type LatLng } from '@/geo/utils/mapBounds'
import { EMBEDDED_GEO_MAP_UI } from '@/geo/constants/mapUi'
import { GeoMapResizeSync } from '@/geo/components/GeoMapResizeSync'
import { GeoMapViewportSync } from '@/geo/components/GeoMapViewportSync'

type Props = {
  height?: number | string
  className?: string
  points?: LatLng[]
  /** Stable key (e.g. user ids) — map refits only when this changes, not on live GPS ticks. */
  fitKey?: string
  autoFit?: 'once' | 'always' | 'never'
  children?: ReactNode
  defaultCenter?: LatLng
  defaultZoom?: number
  mapId?: string
  /** Extra Google Maps JS libraries (e.g. visualization for heatmaps). */
  libraries?: ('places' | 'geocoding' | 'visualization')[]
}

export function GeoMapShell({
  height = 360,
  className,
  points = [],
  fitKey,
  autoFit = 'once',
  children,
  defaultCenter,
  defaultZoom = 12,
  mapId,
  libraries
}: Props) {
  const apiKey = useGeoMapApiKey()
  const defaultMapId = useGeoMapId()
  const { geoPlatform } = useGeoFeatures()
  const tenantCenter = geoPlatform.defaults.mapCenter
  const tenantZoom = geoPlatform.defaults.mapZoom ?? defaultZoom
  const resolvedCenter = useMemo(() => {
    if (defaultCenter) return defaultCenter
    if (tenantCenter?.lat != null && tenantCenter?.lng != null) return tenantCenter
    return { lat: 31.5204, lng: 74.3587 }
  }, [defaultCenter, tenantCenter?.lat, tenantCenter?.lng])
  const view = useMemo(() => {
    if (points.length) return fitBounds(points)
    return { center: resolvedCenter, zoom: tenantZoom }
  }, [points, resolvedCenter, tenantZoom])

  if (!apiKey) {
    return (
      <Box className='flex items-center justify-center p-6 text-center' sx={{ height }}>
        <Typography color='text.secondary'>
          Google Maps API key is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </Typography>
      </Box>
    )
  }

  return (
    <Box className={className} sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
      <APIProvider apiKey={apiKey} libraries={libraries}>
        <Map
          defaultCenter={view.center}
          defaultZoom={view.zoom}
          gestureHandling='greedy'
          mapId={mapId || defaultMapId || undefined}
          style={{ width: '100%', height: '100%' }}
          {...EMBEDDED_GEO_MAP_UI}
        >
          <GeoMapResizeSync />
          <GeoMapViewportSync points={points} fitKey={fitKey} autoFit={autoFit} />
          {children}
        </Map>
      </APIProvider>
    </Box>
  )
}

export function GeoMapLoading({ height = 360 }: { height?: number | string }) {
  return (
    <Box className='flex items-center justify-center' sx={{ height }}>
      <CircularProgress size={28} />
    </Box>
  )
}
