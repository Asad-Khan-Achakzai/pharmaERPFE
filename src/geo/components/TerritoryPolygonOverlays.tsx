'use client'

import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { pathsFromGeoJson, type GeoJsonGeometry } from '@/geo/utils/geoJsonPaths'

const POLYGON_COLORS = ['#1565c0', '#2e7d32', '#6a1b9a', '#ef6c00', '#00838f', '#c62828']

export type TerritoryBoundaryShape = {
  id: string
  geometry: GeoJsonGeometry
  label?: string
}

export function TerritoryPolygonOverlays({ boundaries }: { boundaries: TerritoryBoundaryShape[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !boundaries.length) return

    const polygons = boundaries.flatMap((boundary, index) => {
      const paths = pathsFromGeoJson(boundary.geometry)
      const color = POLYGON_COLORS[index % POLYGON_COLORS.length]
      return paths.map(
        path =>
          new google.maps.Polygon({
            paths: path,
            strokeColor: color,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.18,
            map
          })
      )
    })

    return () => {
      polygons.forEach(polygon => polygon.setMap(null))
    }
  }, [map, boundaries])

  return null
}
