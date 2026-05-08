'use client'

import { useCallback, useEffect, useState } from 'react'
import { territoriesService, type TerritoryNode } from '@/services/territories.service'
import type { TerritoryCoveragePreview } from '@/components/territories/TerritoryTreePicker'
import { showApiError } from '@/utils/apiErrors'
import {
  brickIdsInSubtree,
  collectBrickNameSamples,
  collectZonesSorted,
  countAreasInSubtree,
  countBricksInSubtree,
  findNodeById,
  listAreasUnderZone,
  pathFromRootToNode
} from '@/utils/territoryTreeUtils'

export function useTerritoryTreeIndex(enabled: boolean) {
  const [roots, setRoots] = useState<TerritoryNode[]>([])
  const [loading, setLoading] = useState(!!enabled)

  useEffect(() => {
    if (!enabled) {
      setRoots([])
      setLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await territoriesService.tree()
        const body = res.data?.data ?? res.data
        const r = (body as { roots?: TerritoryNode[] })?.roots ?? []
        if (!cancel) setRoots(Array.isArray(r) ? r : [])
      } catch (e) {
        if (!cancel) {
          showApiError(e, 'Failed to load territory hierarchy')
          setRoots([])
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [enabled])

  const findNode = useCallback((id: string) => findNodeById(roots, id), [roots])

  const subtreePreview = useCallback(
    (nodeId: string | null): TerritoryCoveragePreview | null => {
      if (!nodeId) return null
      const n = findNodeById(roots, nodeId)
      if (!n) return null
      return {
        brickCount: countBricksInSubtree(n),
        sampleBrickNames: collectBrickNameSamples(n, 8)
      }
    },
    [roots]
  )

  const zonePreview = useCallback(
    (zoneId: string | null) => {
      if (!zoneId) return null
      const n = findNodeById(roots, zoneId)
      if (!n) return null
      return {
        areaCount: countAreasInSubtree(n),
        brickCount: countBricksInSubtree(n),
        sampleBrickNames: collectBrickNameSamples(n, 8)
      }
    },
    [roots]
  )

  const breadcrumbLabel = useCallback(
    (nodeId: string | null): string | null => {
      if (!nodeId) return null
      const path = pathFromRootToNode(roots, nodeId)
      if (!path?.length) return null
      return path.map(p => p.name).join(' › ')
    },
    [roots]
  )

  const zones = useCallback(() => collectZonesSorted(roots), [roots])

  const areasForZone = useCallback((zoneId: string) => listAreasUnderZone(roots, zoneId), [roots])

  const brickSetUnder = useCallback(
    (ancestorId: string | null): Set<string> | null => {
      if (!ancestorId) return null
      const n = findNodeById(roots, ancestorId)
      if (!n) return new Set()
      return brickIdsInSubtree(n)
    },
    [roots]
  )

  return {
    roots,
    loading,
    findNode,
    subtreePreview,
    zonePreview,
    breadcrumbLabel,
    zones,
    areasForZone,
    brickSetUnder,
    pathToNode: (id: string) => pathFromRootToNode(roots, id)
  }
}
