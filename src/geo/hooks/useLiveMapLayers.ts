'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'
import type { GeoFeatureKey } from '@/geo/types'
import {
  DEFAULT_LIVE_MAP_LAYERS,
  type LiveMapLayerKey,
  type LiveMapLayerState
} from '@/geo/types/mapContext'

const LAYER_FEATURE: Partial<Record<LiveMapLayerKey, GeoFeatureKey>> = {
  doctors: 'doctorMaps',
  pharmacies: 'pharmacyMaps',
  callPoints: 'callPointMaps',
  territories: 'territoryPolygons',
  geofences: 'geofencing',
  heatmap: 'heatMaps',
  route: 'dailyPlanMaps'
}

const LAYER_LABELS: Record<LiveMapLayerKey, string> = {
  doctors: 'Doctors',
  pharmacies: 'Pharmacies',
  callPoints: 'Call points',
  territories: 'Territories',
  geofences: 'Geofences',
  heatmap: 'Heat map',
  route: "Today's route"
}

const PROXIMITY_STORAGE_KEY = 'liveMapProximityRadius'
const LAYERS_STORAGE_PREFIX = 'liveMapLayers'

function storageKey(userId: string | undefined, suffix: string): string | null {
  if (!userId) return null
  return `${suffix}:${userId}`
}

function readLayers(userId: string | undefined): LiveMapLayerState {
  const key = storageKey(userId, LAYERS_STORAGE_PREFIX)
  if (!key || typeof window === 'undefined') return DEFAULT_LIVE_MAP_LAYERS
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return DEFAULT_LIVE_MAP_LAYERS
    const parsed = JSON.parse(raw) as Partial<LiveMapLayerState>
    return { ...DEFAULT_LIVE_MAP_LAYERS, ...parsed }
  } catch {
    return DEFAULT_LIVE_MAP_LAYERS
  }
}

function readProximityRadius(userId: string | undefined): number {
  const key = storageKey(userId, PROXIMITY_STORAGE_KEY)
  if (!key || typeof window === 'undefined') return 250
  try {
    const raw = window.localStorage.getItem(key)
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 50 && n <= 5000) return Math.round(n)
  } catch {
    /* ignore */
  }
  return 250
}

export function useLiveMapLayers() {
  const { user } = useAuth()
  const { isEnabled } = useGeoFeatures()
  const userId = user?._id

  const [layers, setLayersState] = useState<LiveMapLayerState>(() => readLayers(userId))
  const [proximityRadiusMeters, setProximityRadiusState] = useState(() => readProximityRadius(userId))

  useEffect(() => {
    setLayersState(readLayers(userId))
    setProximityRadiusState(readProximityRadius(userId))
  }, [userId])

  const availableLayers = useMemo(() => {
    return (Object.keys(DEFAULT_LIVE_MAP_LAYERS) as LiveMapLayerKey[]).filter((key) => {
      const feature = LAYER_FEATURE[key]
      return !feature || isEnabled(feature)
    })
  }, [isEnabled])

  const setLayer = useCallback(
    (key: LiveMapLayerKey, visible: boolean) => {
      setLayersState((prev) => {
        const next = { ...prev, [key]: visible }
        const storage = storageKey(userId, LAYERS_STORAGE_PREFIX)
        if (storage) window.localStorage.setItem(storage, JSON.stringify(next))
        return next
      })
    },
    [userId]
  )

  const setProximityRadiusMeters = useCallback(
    (radius: number) => {
      const clamped = Math.max(50, Math.min(Math.round(radius), 5000))
      setProximityRadiusState(clamped)
      const storage = storageKey(userId, PROXIMITY_STORAGE_KEY)
      if (storage) window.localStorage.setItem(storage, String(clamped))
    },
    [userId]
  )

  const activeLayersQuery = useMemo(() => {
    const keys = (Object.keys(layers) as LiveMapLayerKey[]).filter((key) => {
      if (!layers[key]) return false
      const feature = LAYER_FEATURE[key]
      return !feature || isEnabled(feature)
    })
    return keys.join(',')
  }, [layers, isEnabled])

  return {
    layers,
    setLayer,
    availableLayers,
    layerLabels: LAYER_LABELS,
    proximityRadiusMeters,
    setProximityRadiusMeters,
    activeLayersQuery,
    isLayerAvailable: (key: LiveMapLayerKey) => availableLayers.includes(key)
  }
}
