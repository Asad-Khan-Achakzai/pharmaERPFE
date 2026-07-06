'use client'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { APIProvider, Map } from '@vis.gl/react-google-maps'

type Props = {
  apiKey: string
  height?: number | string
  className?: string
}

export function GeoMapInner({ apiKey, height = 360, className }: Props) {
  const defaultCenter = useMemo(() => ({ lat: 31.5204, lng: 74.3587 }), [])

  return (
    <Box className={className} sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden' }}>
      <APIProvider apiKey={apiKey}>
        <Map defaultCenter={defaultCenter} defaultZoom={11} gestureHandling='greedy' disableDefaultUI={false} />
      </APIProvider>
    </Box>
  )
}
