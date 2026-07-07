'use client'

import { MapMarker } from '@/geo/components/markers/MapMarker'
import { resolvePharmacyMarker, type PharmacyMarkerInput } from '@/geo/marker/MarkerStateResolver'

/** @deprecated Use MapMarker entity="pharmacy" via resolvePharmacyMarker. */
export function PharmacyMapPin(props: PharmacyMarkerInput) {
  return <MapMarker visual={resolvePharmacyMarker(props)} title='Pharmacy' />
}
