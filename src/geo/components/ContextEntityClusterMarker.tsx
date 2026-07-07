'use client'

import { MapClusterMarker } from '@/geo/components/markers/MapMarker'
import { getClusterMarker, type ClusterMarkerInput } from '@/geo/marker/MarkerStateResolver'

type Props = {
  count: number
  entity: ClusterMarkerInput['entity']
  onClick?: () => void
}

/** @deprecated Use MapClusterMarker via getClusterMarker. */
export function ContextEntityClusterMarker({ count, entity, onClick }: Props) {
  return (
    <div role={onClick ? 'button' : undefined} onClick={onClick}>
      <MapClusterMarker visual={getClusterMarker(entity, count)} count={count} />
    </div>
  )
}
