'use client'

import { useMemo } from 'react'
import type { LiveRepLocation } from '@/types/liveTracking'

export interface LiveMapCluster {
  id: string
  lat: number
  lng: number
  count: number
  rows: LiveRepLocation[]
}

/** Lightweight grid clustering for large teams — defers @googlemaps/markerclusterer bundle. */
export function clusterLiveRows(rows: LiveRepLocation[], zoom = 10): LiveMapCluster[] | null {
  const located = rows.filter((r) => r.lat != null && r.lng != null)
  if (located.length <= 20) return null

  const cell = zoom >= 12 ? 0.01 : zoom >= 10 ? 0.025 : 0.05
  const buckets = new Map<string, LiveRepLocation[]>()

  for (const row of located) {
    const lat = row.lat!
    const lng = row.lng!
    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`
    const list = buckets.get(key) || []
    list.push(row)
    buckets.set(key, list)
  }

  const clusters: LiveMapCluster[] = []
  buckets.forEach((items, key) => {
    const lat = items.reduce((s, r) => s + r.lat!, 0) / items.length
    const lng = items.reduce((s, r) => s + r.lng!, 0) / items.length
    clusters.push({ id: key, lat, lng, count: items.length, rows: items })
  })

  return clusters
}

export function useLiveMapClusters(rows: LiveRepLocation[], zoom = 10) {
  return useMemo(() => clusterLiveRows(rows, zoom), [rows, zoom])
}
