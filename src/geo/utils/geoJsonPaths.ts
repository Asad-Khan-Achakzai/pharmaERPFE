import type { LatLng } from '@/geo/utils/mapBounds'

export type GeoJsonGeometry = {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

/** Convert GeoJSON geometry to map paths (exterior + holes per polygon). */
export function pathsFromGeoJson(geometry: GeoJsonGeometry): LatLng[][] {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][]
    return rings.map(ring => ring.map(([lng, lat]) => ({ lat, lng })))
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][]
    return polys.flatMap(poly => poly.map(ring => ring.map(([lng, lat]) => ({ lat, lng }))))
  }
  return []
}

/** First exterior ring per polygon — used for map bounds. */
export function exteriorPointsFromGeometries(geometries: GeoJsonGeometry[]): LatLng[] {
  const pts: LatLng[] = []
  for (const geometry of geometries) {
    const paths = pathsFromGeoJson(geometry)
    if (paths[0]?.length) pts.push(...paths[0])
  }
  return pts
}
