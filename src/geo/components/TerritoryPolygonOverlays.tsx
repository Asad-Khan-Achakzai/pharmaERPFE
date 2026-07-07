'use client'

import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { pathsFromGeoJson, type GeoJsonGeometry } from '@/geo/utils/geoJsonPaths'
import { MAP_ENTITY_COLORS } from '@/geo/marker/mapDesignTokens'

export type TerritoryBoundaryShape = {
  id: string
  geometry: GeoJsonGeometry
  label?: string
}

export function TerritoryPolygonOverlays({ boundaries }: { boundaries: TerritoryBoundaryShape[] }) {
  const map = useMap()
  const stroke = MAP_ENTITY_COLORS.territory.stroke
  const fill = MAP_ENTITY_COLORS.territory.fill

  useEffect(() => {
    if (!map || !boundaries.length) return

    const polygons = boundaries.flatMap((boundary) => {
      const paths = pathsFromGeoJson(boundary.geometry)
      return paths.map(
        (path) =>
          new google.maps.Polygon({
            paths: path,
            strokeColor: stroke,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: fill,
            fillOpacity: 0.15,
            map
          })
      )
    })

    return () => {
      polygons.forEach((polygon) => polygon.setMap(null))
    }
  }, [map, boundaries, stroke, fill])

  return null
}
