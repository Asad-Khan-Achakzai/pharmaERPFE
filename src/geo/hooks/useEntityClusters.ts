'use client'

import { useMemo } from 'react'

export type ClusterableEntity = {
  id: string
  lat: number
  lng: number
}

export type EntityCluster<T extends ClusterableEntity> = {
  id: string
  lat: number
  lng: number
  count: number
  items: T[]
}

/** Per-entity-type grid clustering — same algorithm as live rep clusters. */
export function clusterEntities<T extends ClusterableEntity>(
  rows: T[],
  zoom = 10,
  threshold = 20
): EntityCluster<T>[] | null {
  if (rows.length <= threshold) return null

  const cell = zoom >= 12 ? 0.01 : zoom >= 10 ? 0.025 : 0.05
  const buckets = new Map<string, T[]>()

  for (const row of rows) {
    const key = `${Math.floor(row.lat / cell)}:${Math.floor(row.lng / cell)}`
    const list = buckets.get(key) || []
    list.push(row)
    buckets.set(key, list)
  }

  const clusters: EntityCluster<T>[] = []
  buckets.forEach((items, key) => {
    const lat = items.reduce((s, r) => s + r.lat, 0) / items.length
    const lng = items.reduce((s, r) => s + r.lng, 0) / items.length
    clusters.push({ id: key, lat, lng, count: items.length, items })
  })

  return clusters
}

export function useEntityClusters<T extends ClusterableEntity>(rows: T[], zoom = 10, threshold = 20) {
  return useMemo(() => clusterEntities(rows, zoom, threshold), [rows, zoom, threshold])
}
