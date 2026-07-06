'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchGeoConfig } from '@/geo/services/geo.service'
import {
  DEFAULT_GEO_PLATFORM,
  type GeoFeatureKey,
  type GeoPlatformConfig
} from '@/geo/types'

interface GeoPlatformContextValue {
  geoPlatform: GeoPlatformConfig
  loading: boolean
  isEnabled: (feature: GeoFeatureKey) => boolean
  refresh: () => Promise<void>
}

const GeoPlatformContext = createContext<GeoPlatformContextValue | null>(null)

export function GeoPlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [geoPlatform, setGeoPlatform] = useState<GeoPlatformConfig>(DEFAULT_GEO_PLATFORM)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setGeoPlatform(DEFAULT_GEO_PLATFORM)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const cfg = await fetchGeoConfig()
      setGeoPlatform(cfg)
    } catch {
      setGeoPlatform(DEFAULT_GEO_PLATFORM)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const isEnabled = useCallback(
    (feature: GeoFeatureKey) => geoPlatform.enabled === true && geoPlatform.features[feature] === true,
    [geoPlatform]
  )

  const value = useMemo(
    () => ({ geoPlatform, loading, isEnabled, refresh: load }),
    [geoPlatform, loading, isEnabled, load]
  )

  return <GeoPlatformContext.Provider value={value}>{children}</GeoPlatformContext.Provider>
}

export function useGeoFeatures() {
  const ctx = useContext(GeoPlatformContext)
  if (!ctx) {
    return {
      geoPlatform: DEFAULT_GEO_PLATFORM,
      loading: false,
      isEnabled: () => false,
      refresh: async () => {}
    }
  }
  return ctx
}

/** Render children only when geo feature is enabled for the tenant. */
export function GeoFeatureGate({
  feature,
  children
}: {
  feature: GeoFeatureKey
  children: ReactNode
}) {
  const { isEnabled } = useGeoFeatures()
  if (!isEnabled(feature)) return null
  return <>{children}</>
}
