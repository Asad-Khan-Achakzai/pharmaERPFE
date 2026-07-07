'use client'

import { useEffect, useState } from 'react'
import { fetchGeoDayRoute } from '@/geo/services/geo.service'
import { RouteMapScene, type RouteMapPayload } from '@/geo/scenes/RouteMapScene'

export function DailyRouteScene({
  height = 360,
  employeeId,
  date
}: {
  height?: number | string
  employeeId?: string
  date?: string
}) {
  const [data, setData] = useState<RouteMapPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchGeoDayRoute({ employeeId, date })
      .then((res) => {
        if (!cancelled) setData(res as RouteMapPayload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId, date])

  return <RouteMapScene height={height} data={data} />
}
