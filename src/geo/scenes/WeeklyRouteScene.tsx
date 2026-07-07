'use client'

import { useEffect, useState } from 'react'
import { fetchGeoWeeklyRoute } from '@/geo/services/geo.service'
import { RouteMapScene, type RouteMapPayload } from '@/geo/scenes/RouteMapScene'

export function WeeklyRouteScene({
  height = 360,
  weeklyPlanId,
  date
}: {
  height?: number | string
  weeklyPlanId: string
  date?: string
}) {
  const [data, setData] = useState<RouteMapPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchGeoWeeklyRoute({ weeklyPlanId, date })
      .then((res) => {
        if (!cancelled) setData(res as RouteMapPayload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [weeklyPlanId, date])

  return <RouteMapScene height={height} data={data} />
}
