'use client'

import { useMemo } from 'react'
import { Circle } from '@vis.gl/react-google-maps'
import type { GeoHeatMapPoint } from '@/geo/services/geo.service'

/** ~450 m grid — buckets nearby visits for a heat-map style density view. */
const GRID_PRECISION = 0.004

type DensityCell = {
  lat: number
  lng: number
  weight: number
}

function bucketPoints(points: GeoHeatMapPoint[]): DensityCell[] {
  const buckets = new Map<string, DensityCell>()

  for (const point of points) {
    const lat = Math.round(point.lat / GRID_PRECISION) * GRID_PRECISION
    const lng = Math.round(point.lng / GRID_PRECISION) * GRID_PRECISION
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    const w = point.weight ?? 1
    const existing = buckets.get(key)
    if (existing) {
      existing.weight += w
    } else {
      buckets.set(key, { lat, lng, weight: w })
    }
  }

  return Array.from(buckets.values())
}

function heatStyle(weight: number, maxWeight: number) {
  const t = maxWeight > 0 ? Math.min(1, weight / maxWeight) : 0
  const radius = 320 + t * 680
  if (t < 0.2) return { radius, fillColor: '#1565c044', strokeColor: '#1565c0aa' }
  if (t < 0.4) return { radius, fillColor: '#00838f55', strokeColor: '#00838faa' }
  if (t < 0.6) return { radius, fillColor: '#f9a82566', strokeColor: '#f9a825cc' }
  if (t < 0.8) return { radius, fillColor: '#ef6c0077', strokeColor: '#ef6c00dd' }
  return { radius, fillColor: '#d32f2f88', strokeColor: '#d32f2fff' }
}

/**
 * Visit-density overlay using standard map circles (Google removed HeatmapLayer in Maps JS v3.65).
 */
export function GeoHeatmapLayer({ points }: { points: GeoHeatMapPoint[] }) {
  const cells = useMemo(() => bucketPoints(points), [points])
  const maxWeight = useMemo(() => Math.max(1, ...cells.map(c => c.weight)), [cells])

  if (!cells.length) return null

  return (
    <>
      {cells.map(cell => {
        const style = heatStyle(cell.weight, maxWeight)
        return (
          <Circle
            key={`${cell.lat}-${cell.lng}-${cell.weight}`}
            center={{ lat: cell.lat, lng: cell.lng }}
            radius={style.radius}
            strokeColor={style.strokeColor}
            strokeWeight={1}
            fillColor={style.fillColor}
            clickable={false}
          />
        )
      })}
    </>
  )
}
