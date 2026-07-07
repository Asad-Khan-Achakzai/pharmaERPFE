export {
  MapMarker,
  MapClusterMarker,
  type MapMarkerProps,
  type MapClusterMarkerProps
} from '@/geo/components/markers/MapMarker'

export {
  getMarker,
  getClusterMarker,
  resolveRepMarker,
  resolveDoctorMarker,
  resolvePharmacyMarker,
  resolveCallPointMarker,
  repMarkerColor,
  doctorMarkerColor,
  pharmacyMarkerColor,
  callPointMarkerColor,
  type MarkerVisualState,
  type RepMarkerInput,
  type DoctorMarkerInput,
  type PharmacyMarkerInput,
  type CallPointMarkerInput,
  type ClusterMarkerInput
} from '@/geo/marker/MarkerStateResolver'

export { MAP_ENTITY_COLORS, MAP_MARKER_SIZES, type MapEntityType, type MapMarkerState } from '@/geo/marker/mapDesignTokens'
