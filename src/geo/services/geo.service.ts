import api from '@/services/api'
import type { GeoPlatformConfig } from '@/geo/types'
import { DEFAULT_GEO_PLATFORM } from '@/geo/types'
import type { GeoMapContextPayload } from '@/geo/types/mapContext'

export async function fetchGeoConfig(): Promise<GeoPlatformConfig> {
  const res = await api.get('/geo/config')
  return (res.data?.data as GeoPlatformConfig) || DEFAULT_GEO_PLATFORM
}

export async function fetchGeoLive() {
  const res = await api.get('/geo/live')
  return res.data?.data
}

export async function fetchGeoDayRoute(params?: { employeeId?: string; date?: string }) {
  const res = await api.get('/geo/day-route', { params })
  return res.data?.data
}

export async function fetchGeoWeeklyRoute(params: { weeklyPlanId: string; date?: string }) {
  const res = await api.get('/geo/weekly-route', { params })
  return res.data?.data
}

export async function fetchGeoDoctors(params?: Record<string, string | number>) {
  const res = await api.get('/geo/doctors', { params })
  return res.data?.data
}

export async function fetchGeoCallPoints() {
  const res = await api.get('/geo/call-points')
  return res.data?.data
}

export async function fetchGeoVisitContext(planItemId: string) {
  const res = await api.get(`/geo/visit-context/${planItemId}`)
  return res.data?.data
}

export async function fetchGeoReplay(params: { userId: string; date?: string }) {
  const res = await api.get('/geo/replay', { params })
  return res.data?.data
}

export async function fetchGeoAttendanceZones(params?: { date?: string; attendanceLocationStatus?: string }) {
  const res = await api.get('/geo/attendance-zones', { params })
  return res.data?.data
}

export type GeoHeatMapPoint = { lat: number; lng: number; weight?: number }

export type GeoHeatMapPayload = {
  from: string
  to: string
  metric: string
  points: GeoHeatMapPoint[]
}

export type GeoTerritoryBoundary = {
  _id: string
  territoryId: string
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
  label?: string
}

export async function fetchGeoHeatMap(params?: { from?: string; to?: string }) {
  const res = await api.get('/geo/heatmaps', { params })
  return res.data?.data as GeoHeatMapPayload
}

export async function fetchGeoTerritoryBoundaries(params?: { territoryId?: string }) {
  const res = await api.get('/geo/territory-boundaries', { params })
  return (res.data?.data || []) as GeoTerritoryBoundary[]
}

export async function fetchGeoRouteAnalytics(params?: { from?: string; to?: string }) {
  const res = await api.get('/geo/analytics/routes', { params })
  return res.data?.data
}

export async function fetchGeoTravelAnalytics(params: { userId: string; date?: string }) {
  const res = await api.get('/geo/analytics/travel', { params })
  return res.data?.data
}

export async function geocodeAddress(address: string) {
  const res = await api.post('/geo/geocode', { address })
  return res.data?.data
}

export async function reverseGeocode(lat: number, lng: number) {
  const res = await api.post('/geo/reverse-geocode', { lat, lng })
  return res.data?.data
}

export async function placesAutocomplete(input: string, sessionToken?: string) {
  const res = await api.get('/geo/places/autocomplete', { params: { input, sessionToken } })
  return res.data?.data
}

export async function optimizeGeoRoute(body: {
  weeklyPlanId: string
  date: string
  startLat?: number
  startLng?: number
}) {
  const res = await api.post('/geo/optimize-route', body)
  return res.data?.data
}

export async function fetchGeoMapContext(params: {
  north: number
  south: number
  east: number
  west: number
  employeeId?: string
  trackingContext?: string
  radiusMeters?: number
  layers?: string
  date?: string
}): Promise<GeoMapContextPayload> {
  const res = await api.get('/geo/context', { params })
  return res.data?.data as GeoMapContextPayload
}
