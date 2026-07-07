import type { GeoHeatMapPoint } from '@/geo/services/geo.service'
import type { RouteMapStop } from '@/geo/scenes/RouteMapScene'
import type { GeoJsonGeometry } from '@/geo/utils/geoJsonPaths'

export type MapBbox = {
  north: number
  south: number
  east: number
  west: number
}

export type LiveMapLayerKey =
  | 'doctors'
  | 'pharmacies'
  | 'callPoints'
  | 'territories'
  | 'geofences'
  | 'heatmap'
  | 'route'

export type LiveMapLayerState = Record<LiveMapLayerKey, boolean>

export const DEFAULT_LIVE_MAP_LAYERS: LiveMapLayerState = {
  doctors: true,
  pharmacies: true,
  callPoints: false,
  territories: false,
  geofences: true,
  heatmap: false,
  route: true
}

export type MapContextDoctor = {
  id: string
  name: string
  specialization?: string | null
  address?: string | null
  city?: string | null
  lat: number
  lng: number
  locationStatus?: string
  territoryId?: string | null
  distanceMeters?: number
}

export type MapContextPharmacy = {
  id: string
  name: string
  address?: string | null
  city?: string | null
  lat: number
  lng: number
  territoryId?: string | null
  distanceMeters?: number
}

export type MapContextCallPoint = {
  id: string
  name: string
  lat: number
  lng: number
  distanceMeters?: number
}

export type MapContextTerritory = {
  id: string
  territoryId: string
  label?: string
  geometry: GeoJsonGeometry
}

export type MapContextGeofence = {
  type: string
  doctorId?: string
  lat: number
  lng: number
  radiusMeters: number
  mode?: string
  status: 'INSIDE_RADIUS' | 'OUTSIDE_RADIUS' | 'UNKNOWN'
}

export type MapContextVisit = {
  planItemId: string
  status: string
  doctor: {
    id: string
    name: string
    lat: number | null
    lng: number | null
    specialization?: string | null
    address?: string | null
  } | null
  inferredFrom?: string
}

export type MapContextEmployee = {
  userId: string
  location: { lat: number; lng: number; source?: string } | null
  activeVisit: MapContextVisit | null
  plannedVisit: MapContextVisit | null
  todayRoute: RouteMapStop[]
  distanceTravelledMeters: number | null
  trackingContext?: string | null
  nearbyCounts?: {
    doctors: number
    pharmacies: number
    callPoints: number
  }
}

export type GeoMapContextPayload = {
  bbox: MapBbox
  radiusMeters: number
  doctors: MapContextDoctor[]
  pharmacies: MapContextPharmacy[]
  callPoints: MapContextCallPoint[]
  territories: MapContextTerritory[]
  geofences: MapContextGeofence[]
  heatmap: { points: GeoHeatMapPoint[]; metric: string } | null
  employee: MapContextEmployee | null
  counts: { doctors: number; pharmacies: number; callPoints: number }
}
