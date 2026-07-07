'use client'

import { MapMarker } from '@/geo/components/markers/MapMarker'
import { resolveCallPointMarker, type CallPointMarkerInput } from '@/geo/marker/MarkerStateResolver'

/** @deprecated Use MapMarker entity="callPoint" via resolveCallPointMarker. */
export function CallPointMapPin(props: CallPointMarkerInput) {
  return <MapMarker visual={resolveCallPointMarker(props)} title='Call point' />
}
