export const GEO_FEATURE_KEYS = [
  'liveTracking',
  'managerLiveMap',
  'doctorMaps',
  'doctorLocationReviewMaps',
  'callPointMaps',
  'attendanceMaps',
  'weeklyPlanMaps',
  'dailyPlanMaps',
  'activeVisitMaps',
  'navigation',
  'routeOptimization',
  'routeReplay',
  'heatMaps',
  'territoryPolygons',
  'geofencing',
  'placesAutocomplete',
  'geocoding',
  'distanceAndEta',
  'routeAnalytics',
  'travelAnalytics',
  'aiGeoApis'
] as const

export type GeoFeatureKey = (typeof GEO_FEATURE_KEYS)[number]

export type GeoFeatures = Record<GeoFeatureKey, boolean>

export interface GeoPlatformConfig {
  enabled: boolean
  configVersion: number
  defaults: {
    mapCenter: { lat: number; lng: number } | null
    mapZoom: number
    countryCode: string
  }
  features: GeoFeatures
  limits: { maxGoogleCallsPerDay: number | null }
  liveTracking: {
    heartbeatIntervalMs: number
    maxAccuracyMeters: number
    trackingProfile?: 'balanced' | 'fresh' | 'conservative'
    schedulerMinIntervalMs?: number
    schedulerMaxIntervalMs?: number
    staleDisplayMs?: number
    retentionDays?: number
  }
  maps: {
    webApiKey: string
    androidApiKey: string
    iosApiKey: string
  }
}

export const DEFAULT_GEO_FEATURES: GeoFeatures = GEO_FEATURE_KEYS.reduce(
  (acc, key) => {
    acc[key] = false
    return acc
  },
  {} as GeoFeatures
)

export const DEFAULT_GEO_PLATFORM: GeoPlatformConfig = {
  enabled: false,
  configVersion: 1,
  defaults: { mapCenter: null, mapZoom: 12, countryCode: 'PK' },
  features: DEFAULT_GEO_FEATURES,
  limits: { maxGoogleCallsPerDay: null },
  liveTracking: { heartbeatIntervalMs: 300000, maxAccuracyMeters: 150 },
  maps: { webApiKey: '', androidApiKey: '', iosApiKey: '' }
}
