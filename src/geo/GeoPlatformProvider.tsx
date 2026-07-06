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
  /** True after a successful /geo/config fetch for the signed-in user. */
  configReady: boolean
  isEnabled: (feature: GeoFeatureKey) => boolean
  refresh: () => Promise<void>
}

const GeoPlatformContext = createContext<GeoPlatformContextValue | null>(null)

export function GeoPlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [geoPlatform, setGeoPlatform] = useState<GeoPlatformConfig>(DEFAULT_GEO_PLATFORM)
  const [loading, setLoading] = useState(true)
  const [configReady, setConfigReady] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setGeoPlatform(DEFAULT_GEO_PLATFORM)
      setConfigReady(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const cfg = await fetchGeoConfig()
      setGeoPlatform(cfg)
      setConfigReady(true)
    } catch {
      setGeoPlatform(DEFAULT_GEO_PLATFORM)
      setConfigReady(false)
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
    () => ({ geoPlatform, loading, configReady, isEnabled, refresh: load }),
    [geoPlatform, loading, configReady, isEnabled, load]
  )

  return <GeoPlatformContext.Provider value={value}>{children}</GeoPlatformContext.Provider>
}

export function useGeoFeatures() {
  const ctx = useContext(GeoPlatformContext)
  if (!ctx) {
    return {
      geoPlatform: DEFAULT_GEO_PLATFORM,
      loading: false,
      configReady: false,
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
