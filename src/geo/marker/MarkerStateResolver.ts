import type { LiveAttendanceStatus } from '@/types/liveTracking'
import { resolveVisitStopContext } from '@/geo/context/ContextEngine'
import {
  MAP_ENTITY_COLORS,
  MAP_MARKER_EFFECTS,
  MAP_MARKER_SIZES,
  type MapEntityType,
  type MapMarkerState
} from '@/geo/marker/mapDesignTokens'

export type MarkerVisualState = {
  entity: MapEntityType
  state: MapMarkerState
  color: string
  opacity: number
  pulse: boolean
  selected: boolean
  hovered: boolean
  active: boolean
  glow: boolean
  scale: number
  priority: number
  label?: string
}

export type MarkerStateResolver<TInput> = (input: TInput) => MarkerVisualState

export type RepMarkerInput = {
  attendanceStatus?: LiveAttendanceStatus
  ageSeconds?: number | null
  confidence?: number | null
  selected?: boolean
  hovered?: boolean
  disabled?: boolean
}

export type DoctorMarkerInput = {
  selected?: boolean
  hovered?: boolean
  visitStatus?: string
  locationStatus?: string
  variant?: 'default' | 'suggested' | 'verified'
  disabled?: boolean
}

export type PharmacyMarkerInput = {
  selected?: boolean
  hovered?: boolean
  disabled?: boolean
}

export type CallPointMarkerInput = {
  selected?: boolean
  hovered?: boolean
  disabled?: boolean
}

export type ClusterMarkerInput = {
  entity: 'rep' | 'doctor' | 'pharmacy' | 'callPoint'
  count: number
}

type MarkerEntity = 'rep' | 'doctor' | 'pharmacy' | 'callPoint'

function baseVisual(entity: MapEntityType, state: MapMarkerState, color: string): MarkerVisualState {
  const selected = state === 'selected'
  const hovered = state === 'hovered'
  const active = state === 'active' || state === 'live'
  const pulse = state === 'live'
  const scale =
    selected ? MAP_MARKER_EFFECTS.selectedScale : hovered ? MAP_MARKER_EFFECTS.hoverScale : 1

  return {
    entity,
    state,
    color,
    opacity: state === 'disabled' ? 0.55 : state === 'offline' ? 0.85 : 1,
    pulse,
    selected,
    hovered,
    active,
    glow: selected || active,
    scale,
    priority: selected ? 20 : active ? 12 : hovered ? 8 : 1
  }
}

/** Direct lookup — the only supported way to request static marker specs. */
export function getMarker(entity: MarkerEntity, state: MapMarkerState = 'default'): MarkerVisualState {
  const colorMap: Record<MarkerEntity, string> = {
    rep:
      state === 'offline'
        ? MAP_ENTITY_COLORS.rep.offline
        : state === 'live' || state === 'active'
          ? MAP_ENTITY_COLORS.rep.live
          : MAP_ENTITY_COLORS.rep.primary,
    doctor: state === 'active' ? MAP_ENTITY_COLORS.doctor.active : MAP_ENTITY_COLORS.doctor.primary,
    pharmacy: MAP_ENTITY_COLORS.pharmacy.primary,
    callPoint: MAP_ENTITY_COLORS.callPoint.primary
  }

  return baseVisual(entity, state, colorMap[entity])
}

export function getClusterMarker(
  entity: ClusterMarkerInput['entity'],
  _count: number
): MarkerVisualState {
  const entityType: MapEntityType =
    entity === 'rep'
      ? 'clusterRep'
      : entity === 'doctor'
        ? 'clusterDoctor'
        : entity === 'pharmacy'
          ? 'clusterPharmacy'
          : 'clusterCallPoint'

  const color = MAP_ENTITY_COLORS.cluster[entity]
  return baseVisual(entityType, 'default', color)
}

export function resolveRepMarker(input: RepMarkerInput): MarkerVisualState {
  if (input.disabled) return getMarker('rep', 'disabled')
  if (input.selected) return getMarker('rep', 'selected')
  if (input.hovered) return getMarker('rep', 'hovered')
  if (input.attendanceStatus !== 'CHECKED_IN') return getMarker('rep', 'offline')
  if ((input.confidence ?? 100) < 20) {
    return {
      ...getMarker('rep', 'offline'),
      color: MAP_ENTITY_COLORS.rep.lowConfidence,
      state: 'offline'
    }
  }
  if ((input.ageSeconds ?? 0) >= 600) {
    return { ...getMarker('rep', 'live'), pulse: true, state: 'live' }
  }
  return getMarker('rep', 'live')
}

export function resolveDoctorMarker(input: DoctorMarkerInput): MarkerVisualState {
  if (input.disabled) return getMarker('doctor', 'disabled')
  if (input.selected) return getMarker('doctor', 'selected')
  if (input.hovered) return getMarker('doctor', 'hovered')

  const visitCtx = input.visitStatus ? resolveVisitStopContext(input.visitStatus) : null
  if (visitCtx === 'in_progress') return getMarker('doctor', 'active')
  if (visitCtx === 'missed') {
    return { ...getMarker('doctor', 'default'), color: MAP_ENTITY_COLORS.doctor.missed }
  }
  if (visitCtx === 'completed') {
    return { ...getMarker('doctor', 'default'), color: MAP_ENTITY_COLORS.doctor.completed }
  }
  if (input.variant === 'suggested' || input.locationStatus === 'SUGGESTED') {
    return { ...getMarker('doctor', 'default'), color: MAP_ENTITY_COLORS.doctor.suggested }
  }

  return getMarker('doctor', 'default')
}

export function resolvePharmacyMarker(input: PharmacyMarkerInput): MarkerVisualState {
  if (input.disabled) return getMarker('pharmacy', 'disabled')
  if (input.selected) return getMarker('pharmacy', 'selected')
  if (input.hovered) return getMarker('pharmacy', 'hovered')
  return getMarker('pharmacy', 'default')
}

export function resolveCallPointMarker(input: CallPointMarkerInput): MarkerVisualState {
  if (input.disabled) return getMarker('callPoint', 'disabled')
  if (input.selected) return getMarker('callPoint', 'selected')
  if (input.hovered) return getMarker('callPoint', 'hovered')
  return getMarker('callPoint', 'default')
}

export function mergeMarkerState(
  base: MarkerVisualState,
  overrides: Partial<MarkerVisualState>
): MarkerVisualState {
  return { ...base, ...overrides }
}

/** Backward-compatible color helpers */
export function repMarkerColor(input: RepMarkerInput): string {
  return resolveRepMarker(input).color
}

export function doctorMarkerColor(input: DoctorMarkerInput): string {
  return resolveDoctorMarker(input).color
}

export function pharmacyMarkerColor(input: PharmacyMarkerInput): string {
  return resolvePharmacyMarker(input).color
}

export function callPointMarkerColor(input: CallPointMarkerInput): string {
  return resolveCallPointMarker(input).color
}

export { MAP_MARKER_SIZES, MAP_MARKER_EFFECTS, MAP_ENTITY_COLORS }
