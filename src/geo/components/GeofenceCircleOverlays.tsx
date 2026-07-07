'use client'

import { Polyline } from '@vis.gl/react-google-maps'
import type { MapContextGeofence } from '@/geo/types/mapContext'
import { MAP_ENTITY_COLORS } from '@/geo/marker/mapDesignTokens'
import { circlePolylinePath } from '@/geo/utils/circlePath'

export function GeofenceCircleOverlays({ geofences }: { geofences: MapContextGeofence[] }) {
  if (!geofences.length) return null

  return (
    <>
      {geofences.map((fence, index) => {
        const inside = fence.status === 'INSIDE_RADIUS'
        const stroke = inside ? MAP_ENTITY_COLORS.geofence.inside : MAP_ENTITY_COLORS.geofence.outside
        const path = circlePolylinePath(fence.lat, fence.lng, fence.radiusMeters)
        return (
          <Polyline
            key={`${fence.doctorId || index}-${fence.lat}-${fence.lng}`}
            path={path}
            strokeColor={stroke}
            strokeOpacity={0.9}
            strokeWeight={2}
            icons={[
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                offset: '0',
                repeat: '10px'
              }
            ]}
          />
        )
      })}
    </>
  )
}
