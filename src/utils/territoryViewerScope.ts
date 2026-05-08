import type { TerritoryNode } from '@/services/territories.service'
import type { User } from '@/contexts/AuthContext'

export type TerritoryScopeMode = 'full' | 'subtree' | 'mrepBricks' | 'empty'

export type ScopedTerritoryContext = {
  scopedTree: TerritoryNode[]
  /** All territory ids the user may see (explorer, compare row filter). */
  allowedTerritoryIds: Set<string>
  mode: TerritoryScopeMode
  /** True when role/anchor cannot be trusted — UI must not show hierarchy data. */
  scopeUnsafe: boolean
}

function idKey(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'object' && x !== null && '_id' in x && (x as { _id?: unknown })._id != null) {
    return String((x as { _id: unknown })._id)
  }
  return String(x)
}

type TerritoryRef = { _id?: string; materializedPath?: string }

function normPath(p: string | null | undefined): string {
  if (p == null || p === '' || p === '/') return '/'
  const s = String(p).trim()
  if (!s || s === '/') return '/'
  return s.endsWith('/') ? s : `${s}/`
}

/** Node visible in RM/ASM-style subtree: descendant of a seed or ancestor of a seed node. */
function pathInSubtreeScope(nodePath: string, seedPaths: string[]): boolean {
  const p = normPath(nodePath)
  if (p === '/') return false
  return seedPaths.some(s => {
    const ns = normPath(s)
    return p === ns || p.startsWith(ns) || ns.startsWith(p)
  })
}

function flattenTerritoryPaths(nodes: TerritoryNode[], acc: Map<string, string> = new Map()): Map<string, string> {
  for (const n of nodes) {
    const id = String(n._id)
    if (n.materializedPath) acc.set(id, normPath(n.materializedPath))
    if (n.children?.length) flattenTerritoryPaths(n.children, acc)
  }
  return acc
}

function flattenTerritoryKinds(nodes: TerritoryNode[], acc: Map<string, TerritoryNode['kind']> = new Map()): Map<
  string,
  TerritoryNode['kind']
> {
  for (const n of nodes) {
    acc.set(String(n._id), n.kind)
    if (n.children?.length) flattenTerritoryKinds(n.children, acc)
  }
  return acc
}

function collectSeedIds(user: User): string[] {
  const ids: string[] = []
  const t = user.territoryId as string | TerritoryRef | null | undefined
  if (t) {
    const id = idKey(t)
    if (id) ids.push(id)
  }
  const cov = user.coverageTerritoryIds
  if (Array.isArray(cov)) {
    for (const c of cov) {
      const id = idKey(c)
      if (id) ids.push(id)
    }
  }
  return [...new Set(ids)]
}

function seedPathsFromIndex(seedIds: string[], pathById: Map<string, string>): string[] {
  const paths: string[] = []
  for (const id of seedIds) {
    const p = pathById.get(id)
    if (p && p !== '/') paths.push(p)
  }
  return paths
}

function resolveScopeMode(user: User | null): TerritoryScopeMode {
  if (!user) return 'empty'
  if (user.role === 'SUPER_ADMIN') return 'full'
  if (user.role === 'ADMIN') return 'full'
  if (user.permissions?.includes('admin.access')) return 'full'
  const code = user.resolvedRole?.code || ''
  if (code === 'DEFAULT_ADMIN') return 'full'
  if (code === 'DEFAULT_MEDICAL_REP') return 'mrepBricks'
  if (code === 'DEFAULT_RM' || code === 'DEFAULT_ASM') return 'subtree'
  return 'subtree'
}

function filterSubtree(nodes: TerritoryNode[], seedPaths: string[]): TerritoryNode[] {
  const seeds = seedPaths.map(normPath)
  const walk = (n: TerritoryNode): TerritoryNode | null => {
    const p = normPath(n.materializedPath || '')
    const visible = pathInSubtreeScope(p, seeds)
    if (!visible) return null
    const children = (n.children || []).map(walk).filter(Boolean) as TerritoryNode[]
    return { ...n, children }
  }
  return nodes.map(walk).filter(Boolean) as TerritoryNode[]
}

function filterMrepBricks(nodes: TerritoryNode[], seedIds: Set<string>): TerritoryNode[] {
  const walk = (n: TerritoryNode): TerritoryNode | null => {
    const id = String(n._id)
    if (n.kind === 'BRICK') {
      return seedIds.has(id) ? { ...n, children: [] } : null
    }
    const children = (n.children || []).map(walk).filter(Boolean) as TerritoryNode[]
    if (!children.length) return null
    return { ...n, children }
  }
  return nodes.map(walk).filter(Boolean) as TerritoryNode[]
}

function collectIdsFromTree(nodes: TerritoryNode[], acc: Set<string> = new Set()): Set<string> {
  for (const n of nodes) {
    acc.add(String(n._id))
    if (n.children?.length) collectIdsFromTree(n.children, acc)
  }
  return acc
}

/**
 * Filters the territory tree and derives allowed ids for KPIs, explorer, compare, charts, and insights.
 * Never returns the full tree for non-admin users without valid territory anchors.
 */
export function applyTerritoryScope(tree: TerritoryNode[], user: User | null): ScopedTerritoryContext {
  const mode = resolveScopeMode(user)
  if (mode === 'empty' || !user) {
    return { scopedTree: [], allowedTerritoryIds: new Set(), mode: 'empty', scopeUnsafe: true }
  }
  if (mode === 'full') {
    const allowedTerritoryIds = collectIdsFromTree(tree)
    return { scopedTree: tree, allowedTerritoryIds, mode: 'full', scopeUnsafe: false }
  }

  const seedIds = collectSeedIds(user)
  const pathById = flattenTerritoryPaths(tree)
  const paths = seedPathsFromIndex(seedIds, pathById)

  if (!seedIds.length) {
    return { scopedTree: [], allowedTerritoryIds: new Set(), mode: 'empty', scopeUnsafe: true }
  }

  if (mode === 'mrepBricks') {
    const kindById = flattenTerritoryKinds(tree)
    /** Medical reps may anchor on AREA or BRICK; only brick-only anchors use strict brick pruning. */
    const onlyBrickSeeds = seedIds.every(id => {
      const k = kindById.get(id)
      return k === 'BRICK' || k === undefined
    })
    let scopedTree: TerritoryNode[]
    if (onlyBrickSeeds) {
      scopedTree = filterMrepBricks(tree, new Set(seedIds))
    } else {
      if (!paths.length) {
        return { scopedTree: [], allowedTerritoryIds: new Set(), mode: 'empty', scopeUnsafe: true }
      }
      scopedTree = filterSubtree(tree, paths)
    }
    const allowedTerritoryIds = collectIdsFromTree(scopedTree)
    if (!allowedTerritoryIds.size) {
      return { scopedTree: [], allowedTerritoryIds: new Set(), mode: 'empty', scopeUnsafe: true }
    }
    return { scopedTree, allowedTerritoryIds, mode: 'mrepBricks', scopeUnsafe: false }
  }

  if (!paths.length) {
    return { scopedTree: [], allowedTerritoryIds: new Set(), mode: 'empty', scopeUnsafe: true }
  }

  const scopedTree = filterSubtree(tree, paths)
  const allowedTerritoryIds = collectIdsFromTree(scopedTree)
  if (!allowedTerritoryIds.size) {
    return { scopedTree: [], allowedTerritoryIds: new Set(), mode: 'empty', scopeUnsafe: true }
  }
  return { scopedTree, allowedTerritoryIds, mode: 'subtree', scopeUnsafe: false }
}
