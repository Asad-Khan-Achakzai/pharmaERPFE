import { distanceMeters } from '@/geo/utils/distance'

export type VisitStopContext = 'pending' | 'completed' | 'missed' | 'in_progress'

export type ProximityContext = 'at_location' | 'approaching' | 'far'

export type RepProximityInput = {
  repLat: number
  repLng: number
  targetLat: number | null | undefined
  targetLng: number | null | undefined
  radiusMeters?: number
  approachMultiplier?: number
}

export function resolveVisitStopContext(status: string): VisitStopContext {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'VISITED' || normalized === 'COMPLETED') return 'completed'
  if (normalized === 'MISSED') return 'missed'
  if (normalized === 'IN_PROGRESS' || normalized === 'ACTIVE') return 'in_progress'
  return 'pending'
}

export function resolveProximityContext(input: RepProximityInput): ProximityContext | null {
  const { repLat, repLng, targetLat, targetLng } = input
  if (typeof targetLat !== 'number' || typeof targetLng !== 'number') return null

  const dist = distanceMeters(repLat, repLng, targetLat, targetLng)
  if (dist == null) return null

  const radius = input.radiusMeters ?? 150
  const approach = radius * (input.approachMultiplier ?? 3)

  if (dist <= radius) return 'at_location'
  if (dist <= approach) return 'approaching'
  return 'far'
}

export function isInsideBoundingBox(
  lat: number,
  lng: number,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return lat <= bounds.north && lat >= bounds.south && lng <= bounds.east && lng >= bounds.west
}
