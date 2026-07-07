'use client'

import type { LiveAttendanceStatus } from '@/types/liveTracking'
import { MapMarker } from '@/geo/components/markers/MapMarker'
import { resolveRepMarker, type RepMarkerInput } from '@/geo/marker/MarkerStateResolver'

type Props = RepMarkerInput & {
  name: string
  avatarUrl?: string | null
}

export function liveRepMarkerColor(
  attendanceStatus: LiveAttendanceStatus | undefined,
  ageSeconds: number | null | undefined,
  confidence?: number | null
): string {
  return resolveRepMarker({ attendanceStatus, ageSeconds, confidence }).color
}

/** @deprecated Use MapMarker with resolveRepMarker directly. */
export function LiveRepMapMarker({ name, avatarUrl, ...input }: Props) {
  const visual = resolveRepMarker(input)
  return <MapMarker visual={visual} title={name} initials={name} avatarUrl={avatarUrl} />
}
