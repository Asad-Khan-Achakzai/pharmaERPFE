'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { LiveRepLocation } from '@/types/liveTracking'

const MAX_ANIMATION_MS = 90_000

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export function useAnimatedLiveMarkers(rows: LiveRepLocation[]) {
  const prevRef = useRef<Map<string, { lat: number; lng: number; capturedAt: number }>>(new Map())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  return useMemo(() => {
    const now = Date.now()
    const animated = new Map<string, { lat: number; lng: number; rotation: number }>()

    for (const row of rows) {
      if (row.lat == null || row.lng == null || !row.capturedAt) continue

      const userId = row.userId
      const current = { lat: row.lat, lng: row.lng }
      const capturedAt = new Date(row.capturedAt).getTime()
      const prev = prevRef.current.get(userId)

      if (!prev || distanceM(prev, current) > 200) {
        prevRef.current.set(userId, { ...current, capturedAt })
        animated.set(userId, {
          lat: current.lat,
          lng: current.lng,
          rotation: row.heading ?? 0
        })
        continue
      }

      const expectedMs = row.expectedNextPingMs ?? 180_000
      const animWindow = Math.min(expectedMs, MAX_ANIMATION_MS)
      const elapsed = now - capturedAt
      const progress = ease(Math.min(1, Math.max(0, elapsed / animWindow)))

      animated.set(userId, {
        lat: lerp(prev.lat, current.lat, progress),
        lng: lerp(prev.lng, current.lng, progress),
        rotation: row.heading ?? 0
      })

      if (progress >= 1) {
        prevRef.current.set(userId, { ...current, capturedAt })
      }
    }

    void tick
    return animated
  }, [rows, tick])
}
