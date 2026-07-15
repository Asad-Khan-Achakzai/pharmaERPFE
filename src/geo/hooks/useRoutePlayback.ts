'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type RoutePlaybackPoint = {
  lat: number
  lng: number
  capturedAt?: string
}

export type RoutePlaybackSpeed = 1 | 2 | 4 | 8

function parseTime(iso?: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateAt(
  points: Array<{ lat: number; lng: number; t: number }>,
  timeMs: number
): { lat: number; lng: number } | null {
  if (!points.length) return null
  if (timeMs <= points[0].t) return { lat: points[0].lat, lng: points[0].lng }
  const last = points[points.length - 1]
  if (timeMs >= last.t) return { lat: last.lat, lng: last.lng }

  let lo = 0
  let hi = points.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].t <= timeMs) lo = mid
    else hi = mid
  }
  const a = points[lo]
  const b = points[hi]
  const span = b.t - a.t
  const ratio = span > 0 ? (timeMs - a.t) / span : 0
  return {
    lat: lerp(a.lat, b.lat, ratio),
    lng: lerp(a.lng, b.lng, ratio)
  }
}

export function useRoutePlayback(path: RoutePlaybackPoint[]) {
  const timedPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number; t: number }> = []
    for (const p of path) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
      const t = parseTime(p.capturedAt)
      if (t == null) continue
      pts.push({ lat: p.lat, lng: p.lng, t })
    }
    pts.sort((a, b) => a.t - b.t)
    return pts
  }, [path])

  const startMs = timedPoints[0]?.t ?? null
  const endMs = timedPoints[timedPoints.length - 1]?.t ?? null
  const durationMs = startMs != null && endMs != null ? Math.max(0, endMs - startMs) : 0

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<RoutePlaybackSpeed>(1)
  const [currentTime, setCurrentTime] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number | null>(null)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(startMs)
    lastTickRef.current = null
  }, [startMs, endMs])

  useEffect(() => {
    if (!playing || startMs == null || endMs == null || durationMs <= 0) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTickRef.current = null
      return
    }

    const tick = (now: number) => {
      if (lastTickRef.current == null) lastTickRef.current = now
      const delta = (now - lastTickRef.current) * speed
      lastTickRef.current = now
      setCurrentTime((prev) => {
        const base = prev ?? startMs
        const next = base + delta
        if (next >= endMs) {
          setPlaying(false)
          return endMs
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTickRef.current = null
    }
  }, [playing, speed, startMs, endMs, durationMs])

  const currentPosition = useMemo(() => {
    if (currentTime == null) return null
    return interpolateAt(timedPoints, currentTime)
  }, [timedPoints, currentTime])

  const progress = useMemo(() => {
    if (startMs == null || durationMs <= 0 || currentTime == null) return 0
    return Math.min(1, Math.max(0, (currentTime - startMs) / durationMs))
  }, [startMs, durationMs, currentTime])

  const play = useCallback(() => {
    if (startMs == null || endMs == null) return
    setCurrentTime((prev) => {
      if (prev == null || prev >= endMs) return startMs
      return prev
    })
    setPlaying(true)
  }, [startMs, endMs])

  const pause = useCallback(() => setPlaying(false), [])

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (p) return false
      if (startMs == null || endMs == null) return false
      setCurrentTime((prev) => {
        if (prev == null || prev >= endMs) return startMs
        return prev
      })
      return true
    })
  }, [startMs, endMs])

  const seek = useCallback(
    (timeMs: number) => {
      if (startMs == null || endMs == null) return
      const clamped = Math.min(endMs, Math.max(startMs, timeMs))
      setCurrentTime(clamped)
      lastTickRef.current = null
    },
    [startMs, endMs]
  )

  const seekProgress = useCallback(
    (ratio: number) => {
      if (startMs == null || durationMs <= 0) return
      seek(startMs + Math.min(1, Math.max(0, ratio)) * durationMs)
    },
    [startMs, durationMs, seek]
  )

  return {
    playing,
    speed,
    setSpeed,
    currentTime,
    currentPosition,
    progress,
    startMs,
    endMs,
    durationMs,
    play,
    pause,
    toggle,
    seek,
    seekProgress,
    hasPath: timedPoints.length >= 2
  }
}
