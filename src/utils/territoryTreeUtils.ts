import type { TerritoryNode } from '@/services/territories.service'

export function countBricksInSubtree(node: TerritoryNode): number {
  if (node.kind === 'BRICK') return 1
  if (!node.children?.length) return 0
  return node.children.reduce((sum, ch) => sum + countBricksInSubtree(ch), 0)
}

export function collectBrickNameSamples(node: TerritoryNode, limit: number): string[] {
  const acc: string[] = []
  const walk = (n: TerritoryNode) => {
    if (acc.length >= limit) return
    if (n.kind === 'BRICK') {
      acc.push(n.name)
      return
    }
    for (const ch of n.children || []) {
      walk(ch)
      if (acc.length >= limit) return
    }
  }
  walk(node)
  return acc
}

/** Count AREA nodes anywhere under `node` (for zone summaries). */
export function countAreasInSubtree(node: TerritoryNode): number {
  let n = 0
  if (node.kind === 'AREA') n += 1
  for (const ch of node.children || []) {
    n += countAreasInSubtree(ch)
  }
  return n
}

export function findNodeById(roots: TerritoryNode[], id: string): TerritoryNode | null {
  for (const node of roots) {
    if (String(node._id) === id) return node
    if (node.children?.length) {
      const inner = findNodeById(node.children, id)
      if (inner) return inner
    }
  }
  return null
}

/** Path from matching root down to target (inclusive). */
export function pathFromRootToNode(roots: TerritoryNode[], targetId: string): TerritoryNode[] | null {
  for (const node of roots) {
    if (String(node._id) === targetId) return [node]
    if (node.children?.length) {
      const sub = pathFromRootToNode(node.children, targetId)
      if (sub) return [node, ...sub]
    }
  }
  return null
}

export function collectZonesSorted(roots: TerritoryNode[]): TerritoryNode[] {
  const acc: TerritoryNode[] = []
  const walk = (n: TerritoryNode) => {
    if (n.kind === 'ZONE') acc.push(n)
    for (const ch of n.children || []) walk(ch)
  }
  roots.forEach(walk)
  return acc.sort((a, b) => a.name.localeCompare(b.name))
}

export function listAreasUnderZone(roots: TerritoryNode[], zoneId: string): TerritoryNode[] {
  const z = findNodeById(roots, zoneId)
  if (!z || !z.children?.length) return []
  return z.children.filter(c => c.kind === 'AREA').sort((a, b) => a.name.localeCompare(b.name))
}

/** All AREA nodes in the tree (cross-zone), sorted by name. */
export function listAllAreas(roots: TerritoryNode[]): TerritoryNode[] {
  const acc: TerritoryNode[] = []
  const walk = (n: TerritoryNode) => {
    if (n.kind === 'AREA') acc.push(n)
    for (const ch of n.children || []) walk(ch)
  }
  roots.forEach(walk)
  return acc.sort((a, b) => a.name.localeCompare(b.name))
}

/** Union brick count and sample names across multiple territory node ids. */
export function unionSubtreePreview(
  roots: TerritoryNode[],
  nodeIds: string[],
  sampleLimit = 8
): { brickCount: number; sampleBrickNames: string[] } {
  const brickIds = new Set<string>()
  const samples: string[] = []
  for (const id of nodeIds) {
    const n = findNodeById(roots, id)
    if (!n) continue
    for (const bid of brickIdsInSubtree(n)) brickIds.add(bid)
    for (const name of collectBrickNameSamples(n, sampleLimit)) {
      if (samples.length < sampleLimit && !samples.includes(name)) samples.push(name)
    }
  }
  return { brickCount: brickIds.size, sampleBrickNames: samples.slice(0, sampleLimit) }
}

/** Combined zone stats for multiple zone node ids. */
export function unionZonePreview(
  roots: TerritoryNode[],
  zoneIds: string[],
  sampleLimit = 8
): { areaCount: number; brickCount: number; sampleBrickNames: string[] } {
  let areaCount = 0
  const brickPreview = unionSubtreePreview(roots, zoneIds, sampleLimit)
  const seenAreas = new Set<string>()
  for (const id of zoneIds) {
    const n = findNodeById(roots, id)
    if (!n) continue
    const walk = (node: TerritoryNode) => {
      if (node.kind === 'AREA') seenAreas.add(String(node._id))
      for (const ch of node.children || []) walk(ch)
    }
    walk(n)
  }
  areaCount = seenAreas.size
  return { areaCount, brickCount: brickPreview.brickCount, sampleBrickNames: brickPreview.sampleBrickNames }
}

export function brickIdsInSubtree(node: TerritoryNode): Set<string> {
  const ids = new Set<string>()
  const walk = (n: TerritoryNode) => {
    if (n.kind === 'BRICK') ids.add(String(n._id))
    for (const ch of n.children || []) walk(ch)
  }
  walk(node)
  return ids
}
