'use client'

import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import {
  TerritoryPolygonOverlays,
  type TerritoryBoundaryShape
} from '@/geo/components/TerritoryPolygonOverlays'
import { fetchGeoTerritoryBoundaries } from '@/geo/services/geo.service'
import { exteriorPointsFromGeometries } from '@/geo/utils/geoJsonPaths'
import type { LatLng } from '@/geo/utils/mapBounds'

export function TerritoryBoundariesScene({
  height = 380,
  territoryId
}: {
  height?: number | string
  territoryId?: string
}) {
  const [boundaries, setBoundaries] = useState<TerritoryBoundaryShape[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchGeoTerritoryBoundaries(territoryId ? { territoryId } : undefined)
      .then(rows => {
        if (cancelled) return
        setBoundaries(
          (rows || []).map(row => ({
            id: String(row._id),
            geometry: row.geometry,
            label: row.label
          }))
        )
      })
      .catch(() => {
        if (!cancelled) {
          setBoundaries([])
          setError('Could not load territory boundaries.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [territoryId])

  const points: LatLng[] = useMemo(
    () => exteriorPointsFromGeometries(boundaries.map(b => b.geometry)),
    [boundaries]
  )

  if (loading) {
    return (
      <Box className='flex items-center justify-center' sx={{ height }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box className='flex items-center justify-center p-6 text-center' sx={{ height }}>
        <Typography color='text.secondary'>{error}</Typography>
      </Box>
    )
  }

  if (!boundaries.length) {
    return (
      <Box
        className='flex flex-col items-center justify-center p-6 text-center'
        sx={{ height, borderRadius: 1, border: 1, borderColor: 'divider' }}
      >
        <Typography variant='body2' color='text.secondary'>
          No territory boundary polygons saved yet. An admin can define boundaries via the geo API or your implementation
          team can seed them for this company.
        </Typography>
      </Box>
    )
  }

  return (
    <GeoMapShell height={height} points={points}>
      <TerritoryPolygonOverlays boundaries={boundaries} />
    </GeoMapShell>
  )
}
