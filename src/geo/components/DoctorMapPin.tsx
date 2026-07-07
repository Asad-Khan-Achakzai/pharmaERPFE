'use client'

import { MapMarker } from '@/geo/components/markers/MapMarker'
import { resolveDoctorMarker, type DoctorMarkerInput } from '@/geo/marker/MarkerStateResolver'

/** @deprecated Use MapMarker entity="doctor" via resolveDoctorMarker. */
export function DoctorMapPin(props: DoctorMarkerInput) {
  return <MapMarker visual={resolveDoctorMarker(props)} title='Doctor' />
}
