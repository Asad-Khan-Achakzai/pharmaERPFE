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

/** GPS path point for route history / replay. */
export type RouteHistoryPathPoint = {
  lat: number
  lng: number
  accuracy?: number | null
  capturedAt?: string
  type?: string
  source?: string
}

export type RouteHistoryCheckPoint = {
  lat?: number | null
  lng?: number | null
  at?: string
} | null

export type RouteHistoryVisit = {
  lat?: number | null
  lng?: number | null
  at?: string
  doctorId?: string
  doctorName?: string
  geoFenceResult?: string
  distanceFromDoctor?: number | null
  verified?: boolean
  durationMs?: number | null
}

export type RouteHistoryStop = {
  lat?: number | null
  lng?: number | null
  startedAt?: string
  endedAt?: string
  durationMs?: number | null
  /** e.g. visit | idle | lunch | unknown | home */
  class?: string
  label?: string
}

export type RouteHistoryGap = {
  type?: string
  from?: string
  to?: string
  durationMs?: number | null
  reason?: string
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  fromLat?: number | null
  fromLng?: number | null
  toLat?: number | null
  toLng?: number | null
}

export type RouteHistoryEvent = {
  type?: string
  at?: string
  label?: string
  lat?: number | null
  lng?: number | null
  meta?: Record<string, unknown>
}

export type RouteHistoryPlannedRoute = {
  path?: Array<{ lat: number; lng: number }>
  stops?: Array<{
    lat?: number | null
    lng?: number | null
    doctorId?: string
    doctorName?: string
    status?: string
  }>
} | null

export type RouteHistorySummary = {
  workingHoursMs?: number | null
  workingHoursHours?: number | null
  distanceMeters?: number | null
  distanceKm?: number | null
  drivingTimeMs?: number | null
  visitTimeMs?: number | null
  idleTimeMs?: number | null
  visitCount?: number | null
  visitsCompleted?: number | null
  visitsPlanned?: number | null
  orderCount?: number | null
  ordersBooked?: number | null
  doctorsVisited?: number | null
  pharmaciesVisited?: number | null
  plannedCompleted?: number | null
  plannedMissed?: number | null
  unplannedVisits?: number | null
  coveragePercent?: number | null
  territoryCoveragePercent?: number | null
  productiveTimeMs?: number | null
  nonProductiveTimeMs?: number | null
  gapMinutes?: number | null
  pathPointCount?: number | null
} | null

export type RouteHistoryQuality = {
  score?: number | null
  /** Trusted | Partial | Unreliable */
  label?: string | null
  band?: string | null
  reasons?: string[]
  completenessRatio?: number | null
  gapMinutes?: number | null
  medianAccuracy?: number | null
  backgroundHealthHint?: string | null
} | null

export type RouteHistoryPayload = {
  date: string
  path: RouteHistoryPathPoint[]
  events?: RouteHistoryEvent[]
  stops?: RouteHistoryStop[]
  gaps?: RouteHistoryGap[]
  visits?: RouteHistoryVisit[]
  plannedRoute?: RouteHistoryPlannedRoute
  summary?: RouteHistorySummary
  quality?: RouteHistoryQuality
  checkIn?: RouteHistoryCheckPoint
  checkOut?: RouteHistoryCheckPoint
  downsample?: boolean | number | null
}

export type RouteHistoryDaySummaryRow = {
  date: string
  summary?: RouteHistorySummary
  quality?: RouteHistoryQuality
  visitsCompleted?: number | null
  distanceKm?: number | null
  coveragePercent?: number | null
}

export type RouteHistoryComparePayload = {
  dateA: string
  dateB: string
  a?: { summary?: RouteHistorySummary; quality?: RouteHistoryQuality } | null
  b?: { summary?: RouteHistorySummary; quality?: RouteHistoryQuality } | null
  delta?: Partial<Record<string, number | null>> | null
  deltas?: Partial<Record<string, number | null>> | null
}

function normalizeSummary(raw: RouteHistorySummary | null | undefined): RouteHistorySummary {
  if (!raw) return null
  const visitCount = raw.visitCount ?? raw.visitsCompleted ?? null
  const orderCount = raw.orderCount ?? raw.ordersBooked ?? null
  return {
    ...raw,
    visitCount,
    visitsCompleted: raw.visitsCompleted ?? visitCount,
    orderCount,
    ordersBooked: raw.ordersBooked ?? orderCount,
    distanceKm:
      raw.distanceKm ??
      (raw.distanceMeters != null ? Math.round((raw.distanceMeters / 1000) * 100) / 100 : null),
    workingHoursHours:
      raw.workingHoursHours ??
      (raw.workingHoursMs != null ? Math.round((raw.workingHoursMs / 3600000) * 100) / 100 : null)
  }
}

function normalizeQuality(raw: RouteHistoryQuality | null | undefined): RouteHistoryQuality {
  if (!raw) return null
  const band = raw.band || raw.label || null
  return {
    ...raw,
    band,
    label: raw.label || band
  }
}

function normalizePlannedRoute(
  raw: RouteHistoryPlannedRoute | (Record<string, unknown> & { items?: unknown[] }) | null | undefined
): RouteHistoryPlannedRoute {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as RouteHistoryPlannedRoute & {
    items?: Array<{
      doctor?: { id?: string; name?: string; lat?: number | null; lng?: number | null }
      status?: string
    }>
  }
  const path = Array.isArray(r.path)
    ? r.path.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
    : []
  let stops = Array.isArray(r.stops) ? r.stops : []
  if (!stops.length && Array.isArray(r.items)) {
    stops = r.items
      .map((item) => ({
        lat: item.doctor?.lat ?? null,
        lng: item.doctor?.lng ?? null,
        doctorId: item.doctor?.id,
        doctorName: item.doctor?.name,
        status: item.status
      }))
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
  }
  return { path, stops }
}

function normalizeGaps(gaps: RouteHistoryGap[] | undefined): RouteHistoryGap[] {
  if (!Array.isArray(gaps)) return []
  return gaps.map((g) => ({
    ...g,
    startLat: g.startLat ?? g.fromLat ?? null,
    startLng: g.startLng ?? g.fromLng ?? null,
    endLat: g.endLat ?? g.toLat ?? null,
    endLng: g.endLng ?? g.toLng ?? null,
    reason: g.reason || g.type
  }))
}

function normalizeRouteHistoryPayload(raw: unknown): RouteHistoryPayload {
  const d = (raw || {}) as Partial<RouteHistoryPayload> & {
    path?: RouteHistoryPathPoint[]
    plannedRoute?: RouteHistoryPlannedRoute
  }
  return {
    date: d.date || '',
    path: Array.isArray(d.path)
      ? d.path.filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number')
      : [],
    events: Array.isArray(d.events) ? d.events : [],
    stops: Array.isArray(d.stops)
      ? d.stops.filter((s) => typeof s?.lat === 'number' && typeof s?.lng === 'number')
      : [],
    gaps: normalizeGaps(d.gaps),
    visits: Array.isArray(d.visits) ? d.visits : [],
    plannedRoute: normalizePlannedRoute(d.plannedRoute),
    summary: normalizeSummary(d.summary ?? null),
    quality: normalizeQuality(d.quality ?? null),
    checkIn: d.checkIn ?? null,
    checkOut: d.checkOut ?? null,
    downsample: d.downsample ?? null
  }
}

export async function fetchGeoRouteHistory(params: {
  userId: string
  date?: string
  downsample?: boolean | number
  maxPoints?: number
}): Promise<RouteHistoryPayload> {
  try {
    const res = await api.get('/geo/route-history', { params })
    return normalizeRouteHistoryPayload(res.data?.data)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404 || status === 501) {
      const fallback = await fetchGeoReplay({ userId: params.userId, date: params.date })
      return normalizeRouteHistoryPayload(fallback)
    }
    throw err
  }
}

export async function fetchGeoRouteHistorySummary(params: { userId: string; date?: string }) {
  const res = await api.get('/geo/route-history/summary', { params })
  return res.data?.data as {
    date?: string
    summary?: RouteHistorySummary
    quality?: RouteHistoryQuality
  }
}

export async function fetchGeoRouteHistoryRange(params: {
  userId: string
  from: string
  to: string
}): Promise<RouteHistoryDaySummaryRow[]> {
  const res = await api.get('/geo/route-history/range', { params })
  const data = res.data?.data
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.days)
      ? data.days
      : []
  return (rows as RouteHistoryDaySummaryRow[]).map((row) => ({
    ...row,
    summary: normalizeSummary(row.summary),
    quality: normalizeQuality(row.quality),
    visitsCompleted: row.visitsCompleted ?? row.summary?.visitsCompleted ?? row.summary?.visitCount,
    distanceKm:
      row.distanceKm ??
      row.summary?.distanceKm ??
      (row.summary?.distanceMeters != null
        ? Math.round((row.summary.distanceMeters / 1000) * 100) / 100
        : null),
    coveragePercent: row.coveragePercent ?? row.summary?.coveragePercent
  }))
}

export async function fetchGeoRouteHistoryCompare(params: {
  userId: string
  dateA: string
  dateB: string
}): Promise<RouteHistoryComparePayload> {
  const res = await api.get('/geo/route-history/compare', { params })
  const raw = (res.data?.data || {}) as Record<string, unknown>
  const dayA = (raw.dayA || raw.a || null) as {
    summary?: RouteHistorySummary
    quality?: RouteHistoryQuality
  } | null
  const dayB = (raw.dayB || raw.b || null) as {
    summary?: RouteHistorySummary
    quality?: RouteHistoryQuality
  } | null
  return {
    dateA: String(raw.dateA || params.dateA),
    dateB: String(raw.dateB || params.dateB),
    a: dayA
      ? { summary: normalizeSummary(dayA.summary), quality: normalizeQuality(dayA.quality) }
      : null,
    b: dayB
      ? { summary: normalizeSummary(dayB.summary), quality: normalizeQuality(dayB.quality) }
      : null,
    delta: (raw.deltas || raw.delta || null) as RouteHistoryComparePayload['delta'],
    deltas: (raw.deltas || raw.delta || null) as RouteHistoryComparePayload['deltas']
  }
}

export async function fetchGeoRouteHistoryHeatmap(params: {
  userId: string
  from: string
  to: string
}): Promise<{ points: Array<{ lat: number; lng: number; weight?: number }> }> {
  const res = await api.get('/geo/route-history/heatmap', { params })
  return (res.data?.data || { points: [] }) as {
    points: Array<{ lat: number; lng: number; weight?: number }>
  }
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
