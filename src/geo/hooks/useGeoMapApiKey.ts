'use client'

import { useMemo } from 'react'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'

export function useGeoMapApiKey() {
  const { geoPlatform } = useGeoFeatures()
  return useMemo(
    () => geoPlatform.maps.webApiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    [geoPlatform.maps.webApiKey]
  )
}

/** Cloud map style ID — required for Advanced Markers. Create in Google Cloud → Map Management. */
export function useGeoMapId() {
  return useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || '', [])
}
