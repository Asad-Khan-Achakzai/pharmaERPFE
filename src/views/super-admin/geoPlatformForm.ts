import {
  DEFAULT_GEO_FEATURES,
  GEO_FEATURE_KEYS,
  type GeoFeatureKey,
  type GeoFeatures
} from '@/geo/types'

export type GeoPlatformFormState = {
  enabled: boolean
  features: GeoFeatures
  maxGoogleCallsPerDay: string
}

export const emptyGeoPlatformForm = (): GeoPlatformFormState => ({
  enabled: false,
  features: { ...DEFAULT_GEO_FEATURES },
  maxGoogleCallsPerDay: ''
})

export type GeoFeaturePlatform = 'mobile' | 'web' | 'both'

const FEATURE_LABELS: Record<GeoFeatureKey, string> = {
  liveTracking: 'Rep location sharing (GPS while checked in on mobile)',
  managerLiveMap: 'Manager live map (view reps on web & mobile)',
  doctorMaps: 'Doctor maps',
  doctorLocationReviewMaps: 'Doctor location review maps',
  callPointMaps: 'Call point maps',
  attendanceMaps: 'Attendance zone maps',
  weeklyPlanMaps: 'Weekly plan route maps',
  dailyPlanMaps: 'Daily plan route maps',
  activeVisitMaps: 'Active visit maps',
  navigation: 'In-app navigation',
  routeOptimization: 'Route optimization',
  routeReplay: 'Route replay',
  heatMaps: 'Heat maps',
  territoryPolygons: 'Territory polygons',
  geofencing: 'Geofencing',
  placesAutocomplete: 'Places autocomplete',
  geocoding: 'Geocoding',
  distanceAndEta: 'Distance & ETA',
  routeAnalytics: 'Route analytics',
  travelAnalytics: 'Travel analytics',
  aiGeoApis: 'AI-ready geo APIs'
}

const FEATURE_DESCRIPTIONS: Record<GeoFeatureKey, string> = {
  liveTracking:
    'When enabled, checked-in field reps on mobile send periodic GPS heartbeats while on duty. When disabled, no live location is collected during attendance.',
  managerLiveMap:
    'When enabled, managers can view real-time rep locations on the live map (web Team Live page and mobile manager Live screen). Enabling this also requires rep location sharing. When disabled, live map screens and APIs are hidden.',
  doctorMaps:
    'When enabled, doctor list and detail screens show map pins for doctors with coordinates (web and mobile). When disabled, map views are hidden.',
  doctorLocationReviewMaps:
    'When enabled, admins and managers can review and correct doctor GPS coordinates on the location review map (web). When disabled, that page and API are unavailable.',
  callPointMaps:
    'When enabled, the call points module shows a geographic map of coverage points (web). When disabled, the map view is hidden.',
  attendanceMaps:
    'When enabled, team attendance views show check-in zone maps for reviewing where reps checked in (web). When disabled, zone maps are hidden.',
  weeklyPlanMaps:
    'When enabled, weekly plan detail shows the planned visit route on a map (web). When disabled, the weekly route map is hidden.',
  dailyPlanMaps:
    'When enabled, today\'s visits show the daily route map (web and mobile). When disabled, the daily route map is hidden.',
  activeVisitMaps:
    'When enabled, the active visit screen shows a map with the visit location during a call (mobile). When disabled, the visit map is hidden.',
  navigation:
    'When enabled, reps can launch turn-by-turn navigation to the next visit from the mobile app. When disabled, in-app navigation actions are hidden.',
  routeOptimization:
    'When enabled, the backend can reorder daily visit stops for a shorter driving route (web and mobile clients that request optimization). When disabled, the optimization API is blocked.',
  routeReplay:
    'When enabled, managers can replay historical rep GPS trails for a selected day. When disabled, route replay APIs and UI are unavailable.',
  heatMaps:
    'When enabled, doctor visit density heat maps are available in geo analytics (web). When disabled, heat map APIs are blocked.',
  territoryPolygons:
    'When enabled, territory boundaries render on maps and territory polygon APIs are available (web and mobile). When disabled, polygon overlays are hidden.',
  geofencing:
    'When enabled, check-in and check-out can enforce proximity to allowed zones per company policy (web configuration, mobile enforcement). When disabled, geofence validation is skipped.',
  placesAutocomplete:
    'When enabled, address search with Google Places autocomplete is available when picking locations (web and mobile). When disabled, autocomplete API calls are blocked.',
  geocoding:
    'When enabled, addresses can be converted to and from coordinates via the geocoding API (web and mobile). When disabled, geocode endpoints are blocked.',
  distanceAndEta:
    'When enabled, drive distance and ETA calculations between stops are available (web and mobile). When disabled, the distance-eta API is blocked.',
  routeAnalytics:
    'When enabled, route compliance and planning analytics appear in geo reports (web). When disabled, route analytics APIs are blocked.',
  travelAnalytics:
    'When enabled, travel time and distance summary analytics are available for managers (web). When disabled, travel analytics APIs are blocked.',
  aiGeoApis:
    'When enabled, AI-assisted geo summary endpoints are available for admins (web). When disabled, AI geo API routes return forbidden.'
}

const FEATURE_PLATFORMS: Record<GeoFeatureKey, GeoFeaturePlatform> = {
  liveTracking: 'mobile',
  managerLiveMap: 'both',
  doctorMaps: 'both',
  doctorLocationReviewMaps: 'web',
  callPointMaps: 'web',
  attendanceMaps: 'web',
  weeklyPlanMaps: 'web',
  dailyPlanMaps: 'both',
  activeVisitMaps: 'mobile',
  navigation: 'mobile',
  routeOptimization: 'both',
  routeReplay: 'both',
  heatMaps: 'web',
  territoryPolygons: 'both',
  geofencing: 'both',
  placesAutocomplete: 'both',
  geocoding: 'both',
  distanceAndEta: 'both',
  routeAnalytics: 'web',
  travelAnalytics: 'web',
  aiGeoApis: 'web'
}

/** Features that power manager live map + rep GPS — kept in sync in Super Admin. */
export const LIVE_FIELD_TRACKING_KEYS = ['liveTracking', 'managerLiveMap'] as const

export type GeoFeatureSection = {
  id: string
  title: string
  description: string
  keys: readonly GeoFeatureKey[]
}

export const GEO_FEATURE_SECTIONS: GeoFeatureSection[] = [
  {
    id: 'liveFieldTracking',
    title: 'Live field tracking',
    description:
      'Turn both on together: reps share GPS while checked in, and managers see them on the live map. Enabling the manager map automatically enables rep location sharing.',
    keys: LIVE_FIELD_TRACKING_KEYS
  },
  {
    id: 'entityMaps',
    title: 'Entity & location maps',
    description: 'Map views for doctors, call points, and attendance check-in zones.',
    keys: ['doctorMaps', 'doctorLocationReviewMaps', 'callPointMaps', 'attendanceMaps']
  },
  {
    id: 'planVisitMaps',
    title: 'Plan & visit maps',
    description: 'Route maps for weekly and daily plans, plus maps during active field visits.',
    keys: ['weeklyPlanMaps', 'dailyPlanMaps', 'activeVisitMaps']
  },
  {
    id: 'routingNavigation',
    title: 'Routing & navigation',
    description: 'Turn-by-turn navigation, route optimization, and historical GPS replay.',
    keys: ['navigation', 'routeOptimization', 'routeReplay']
  },
  {
    id: 'territoryHeatMaps',
    title: 'Territory & heat maps',
    description: 'Territory boundary overlays and visit-density heat maps.',
    keys: ['heatMaps', 'territoryPolygons']
  },
  {
    id: 'locationServices',
    title: 'Geofencing & location services',
    description: 'Proximity rules and shared location APIs for places search, geocoding, and distance.',
    keys: ['geofencing', 'placesAutocomplete', 'geocoding', 'distanceAndEta']
  },
  {
    id: 'analyticsAi',
    title: 'Analytics & AI',
    description: 'Manager geo reports and AI-assisted location insights.',
    keys: ['routeAnalytics', 'travelAnalytics', 'aiGeoApis']
  }
]

export const PLATFORM_GROUP_ORDER: GeoFeaturePlatform[] = ['both', 'mobile', 'web']

export const PLATFORM_GROUP_LABELS: Record<GeoFeaturePlatform, string> = {
  both: 'Web & mobile',
  mobile: 'Mobile',
  web: 'Web'
}

export function geoPlatformFormFromCompany(company: {
  geoPlatform?: {
    enabled?: boolean
    features?: Partial<GeoFeatures>
    limits?: { maxGoogleCallsPerDay?: number | null }
  }
  liveTrackingEnabled?: boolean
  geoFencingEnabled?: boolean
  attendanceGeofenceEnabled?: boolean
}): GeoPlatformFormState {
  const base = emptyGeoPlatformForm()
  const gp = company.geoPlatform
  if (gp?.features) {
    base.features = { ...base.features, ...gp.features }
  }
  if (gp?.enabled != null) {
    base.enabled = gp.enabled === true
  } else if (company.liveTrackingEnabled || company.geoFencingEnabled) {
    base.enabled = true
    if (company.liveTrackingEnabled) {
      base.features.liveTracking = true
      base.features.managerLiveMap = true
    }
    if (company.geoFencingEnabled) base.features.geofencing = true
    if (company.attendanceGeofenceEnabled) base.features.attendanceMaps = true
  }
  if (gp?.limits?.maxGoogleCallsPerDay != null) {
    base.maxGoogleCallsPerDay = String(gp.limits.maxGoogleCallsPerDay)
  }
  if (base.features.managerLiveMap) {
    base.features.liveTracking = true
  }
  return base
}

export { GEO_FEATURE_KEYS, FEATURE_LABELS, FEATURE_DESCRIPTIONS, FEATURE_PLATFORMS }

export function applyLiveFieldTrackingBundle(
  geo: GeoPlatformFormState,
  enabled: boolean
): GeoPlatformFormState {
  return {
    ...geo,
    enabled: enabled ? true : geo.enabled,
    features: {
      ...geo.features,
      liveTracking: enabled,
      managerLiveMap: enabled
    }
  }
}

export function setGeoFeatureWithDeps(
  geo: GeoPlatformFormState,
  key: GeoFeatureKey,
  checked: boolean
): GeoPlatformFormState {
  const features = { ...geo.features, [key]: checked }
  if (key === 'managerLiveMap' && checked) {
    features.liveTracking = true
  }
  if (key === 'liveTracking' && !checked) {
    features.managerLiveMap = false
  }
  return { ...geo, features }
}

function normalizeLiveTrackingFeatures(features: GeoFeatures): GeoFeatures {
  const next = { ...features }
  if (next.managerLiveMap) {
    next.liveTracking = true
  }
  return next
}

export function buildGeoPlatformPayload(form: GeoPlatformFormState) {
  const limitRaw = form.maxGoogleCallsPerDay.trim()
  const features = normalizeLiveTrackingFeatures(form.features)
  return {
    enabled: form.enabled,
    features,
    limits: {
      maxGoogleCallsPerDay: limitRaw === '' ? null : Number(limitRaw)
    }
  }
}
