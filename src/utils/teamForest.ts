/**
 * Reporting-tree helpers for Organization Intelligence (/team/tree).
 *
 * Permissions (backend assumptions — no FE widening):
 * - GET /users/team requires team.view; managers see own subtree, tenant-wide admins see company.
 * - team.viewAllReports does NOT widen /users/team to the whole company.
 * - Monthly overview KPIs need weeklyPlans.view | team.viewAllReports | admin.access.
 */

import type {
  BranchStats,
  OrgFilters,
  OrgInsights,
  OrgKpi,
  OrgSummary,
  TeamTreeNode,
  TeamUser,
  TerritoryRef
} from '@/types/team'
import { formatTerritoryCoverageLabel } from '@/utils/formatTerritoryCoverageLabel'

const MREP = 'DEFAULT_MEDICAL_REP'
const MANAGER_ROLES = new Set(['DEFAULT_ASM', 'DEFAULT_RM', 'DEFAULT_ADMIN'])

export function asTerritoryRef(v: TerritoryRef | string | null | undefined): TerritoryRef | null {
  if (!v || typeof v !== 'object' || !('_id' in v) || !('name' in v)) return null
  return v as TerritoryRef
}

export function managerIdOf(u: TeamUser): string | null {
  if (u.managerId && typeof u.managerId === 'object' && u.managerId._id) return String(u.managerId._id)
  if (typeof u.managerId === 'string' && u.managerId) return u.managerId
  return null
}

function computeBranchStats(node: TeamTreeNode): BranchStats {
  let subtreeSize = 0
  let mrepCount = 0
  for (const ch of node.children) {
    ch.branchStats = computeBranchStats(ch)
    subtreeSize += 1 + ch.branchStats.subtreeSize
    mrepCount += (ch.roleId?.code === MREP ? 1 : 0) + ch.branchStats.mrepCount
  }
  return {
    directReports: node.children.length,
    subtreeSize,
    mrepCount
  }
}

/** Build sorted forest with branchStats on every node. */
export function buildTeamForest(users: TeamUser[]): TeamTreeNode[] {
  const byId = new Map<string, TeamTreeNode>()
  for (const u of users) {
    byId.set(u._id, { ...u, children: [], branchStats: { directReports: 0, subtreeSize: 0, mrepCount: 0 } })
  }
  const roots: TeamTreeNode[] = []
  for (const u of users) {
    const node = byId.get(u._id)!
    const mid = managerIdOf(u)
    if (mid && byId.has(mid)) {
      byId.get(mid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortTree = (nodes: TeamTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of nodes) sortTree(n.children)
  }
  sortTree(roots)
  for (const r of roots) {
    r.branchStats = computeBranchStats(r)
  }
  return roots
}

export function collectExpandableIds(forest: TeamTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (n: TeamTreeNode) => {
    if (n.children.length) {
      ids.push(n._id)
      for (const c of n.children) walk(c)
    }
  }
  for (const r of forest) walk(r)
  return ids
}

/** IDs that should start collapsed when default open depth is `maxOpenDepth` (0 = only roots visible as rows with children collapsed). */
export function defaultCollapsedIds(forest: TeamTreeNode[], maxOpenDepth: number): Set<string> {
  const collapsed = new Set<string>()
  const walk = (n: TeamTreeNode, depth: number) => {
    if (n.children.length && depth >= maxOpenDepth) collapsed.add(n._id)
    for (const c of n.children) walk(c, depth + 1)
  }
  for (const r of forest) walk(r, 0)
  return collapsed
}

function territoryHaystack(u: TeamUser): string {
  const parts: string[] = []
  const primary = asTerritoryRef(u.territoryId)
  if (primary) {
    parts.push(primary.name, primary.code || '')
  }
  for (const c of u.coverageTerritoryIds || []) {
    const t = asTerritoryRef(c)
    if (t) parts.push(t.name, t.code || '')
  }
  return parts.join(' ').toLowerCase()
}

export function nodeMatchesSearch(u: TeamUser, term: string): boolean {
  if (!term) return true
  const t = term.toLowerCase()
  if (u.name?.toLowerCase().includes(t)) return true
  if (u.email?.toLowerCase().includes(t)) return true
  if (u.employeeCode?.toLowerCase().includes(t)) return true
  if (u.roleId?.name?.toLowerCase().includes(t)) return true
  if (u.roleId?.code?.toLowerCase().includes(t)) return true
  if (territoryHaystack(u).includes(t)) return true
  return false
}

function nodeMatchesFilters(u: TeamUser, filters: OrgFilters, kpi: OrgKpi | undefined): boolean {
  if (filters.roleCode && u.roleId?.code !== filters.roleCode) return false
  if (filters.territoryId) {
    const primary = asTerritoryRef(u.territoryId)
    const cov = (u.coverageTerritoryIds || []).map(asTerritoryRef).filter(Boolean) as TerritoryRef[]
    const ids = new Set<string>([...(primary ? [primary._id] : []), ...cov.map(c => c._id)])
    if (!ids.has(filters.territoryId)) return false
  }
  if (filters.coverageBand) {
    const cov = kpi?.coverage
    if (filters.coverageBand === 'healthy' && !(cov != null && cov >= 70)) return false
    if (filters.coverageBand === 'watch' && !(cov != null && cov < 70)) return false
    if (filters.coverageBand === 'unknown' && cov != null) return false
  }
  return true
}

/** Subtree rooted at managerId, or full forest if unset. */
function forestForManagerFilter(forest: TeamTreeNode[], managerId: string): TeamTreeNode[] {
  if (!managerId) return forest
  const find = (nodes: TeamTreeNode[]): TeamTreeNode | null => {
    for (const n of nodes) {
      if (n._id === managerId) return n
      const inChild = find(n.children)
      if (inChild) return inChild
    }
    return null
  }
  const root = find(forest)
  return root ? [root] : []
}

/**
 * Filter forest keeping ancestors of matches so hierarchy context remains.
 * A node is kept if it matches OR any descendant matches.
 */
export function filterForest(
  forest: TeamTreeNode[],
  search: string,
  filters: OrgFilters,
  kpiByRep: Map<string, OrgKpi>
): TeamTreeNode[] {
  const term = search.trim()
  const scoped = forestForManagerFilter(forest, filters.managerId)
  const hasFilters =
    Boolean(term) || Boolean(filters.roleCode) || Boolean(filters.coverageBand) || Boolean(filters.territoryId)

  if (!hasFilters) return scoped

  const walk = (node: TeamTreeNode): TeamTreeNode | null => {
    const keptChildren = node.children.map(walk).filter((c): c is TeamTreeNode => c != null)
    const selfMatch =
      nodeMatchesSearch(node, term) && nodeMatchesFilters(node, filters, kpiByRep.get(node._id))
    if (selfMatch || keptChildren.length) {
      return { ...node, children: keptChildren }
    }
    return null
  }

  return scoped.map(walk).filter((n): n is TeamTreeNode => n != null)
}

/** Ancestor ids that must be expanded to reveal search/filter hits. */
export function ancestorsToExpandForMatches(
  forest: TeamTreeNode[],
  search: string,
  filters: OrgFilters,
  kpiByRep: Map<string, OrgKpi>
): Set<string> {
  const expand = new Set<string>()
  const term = search.trim()
  const scoped = forestForManagerFilter(forest, filters.managerId)
  const hasFilters =
    Boolean(term) || Boolean(filters.roleCode) || Boolean(filters.coverageBand) || Boolean(filters.territoryId)
  if (!hasFilters) {
    if (filters.managerId) {
      const path = findNodePath(forest, filters.managerId)
      if (path) for (const id of path.slice(0, -1)) expand.add(id)
    }
    return expand
  }

  const walk = (node: TeamTreeNode, ancestors: string[]): boolean => {
    let childHit = false
    for (const c of node.children) {
      if (walk(c, [...ancestors, node._id])) childHit = true
    }
    const selfHit =
      nodeMatchesSearch(node, term) && nodeMatchesFilters(node, filters, kpiByRep.get(node._id))
    if (selfHit || childHit) {
      for (const a of ancestors) expand.add(a)
      if (childHit) expand.add(node._id)
      return true
    }
    return false
  }
  for (const r of scoped) walk(r, [])
  return expand
}

export function collectMatchIds(
  forest: TeamTreeNode[],
  search: string,
  filters: OrgFilters,
  kpiByRep: Map<string, OrgKpi>
): Set<string> {
  const ids = new Set<string>()
  const term = search.trim()
  const scoped = forestForManagerFilter(forest, filters.managerId)
  const walk = (n: TeamTreeNode) => {
    if (nodeMatchesSearch(n, term) && nodeMatchesFilters(n, filters, kpiByRep.get(n._id))) {
      ids.add(n._id)
    }
    for (const c of n.children) walk(c)
  }
  for (const r of scoped) walk(r)
  return ids
}

export function findNodePath(forest: TeamTreeNode[], userId: string): string[] | null {
  const walk = (n: TeamTreeNode, path: string[]): string[] | null => {
    const next = [...path, n._id]
    if (n._id === userId) return next
    for (const c of n.children) {
      const found = walk(c, next)
      if (found) return found
    }
    return null
  }
  for (const r of forest) {
    const found = walk(r, [])
    if (found) return found
  }
  return null
}

export function uniqueTerritories(users: TeamUser[]): TerritoryRef[] {
  const map = new Map<string, TerritoryRef>()
  for (const u of users) {
    const primary = asTerritoryRef(u.territoryId)
    if (primary) map.set(primary._id, primary)
    for (const c of u.coverageTerritoryIds || []) {
      const t = asTerritoryRef(c)
      if (t) map.set(t._id, t)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function managersWithReports(forest: TeamTreeNode[]): { _id: string; name: string }[] {
  const out: { _id: string; name: string }[] = []
  const walk = (n: TeamTreeNode) => {
    if (n.children.length) out.push({ _id: n._id, name: n.name })
    for (const c of n.children) walk(c)
  }
  for (const r of forest) walk(r)
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export function computeOrgSummary(users: TeamUser[], kpiByRep: Map<string, OrgKpi>, kpiAvailable: boolean): OrgSummary {
  let managers = 0
  let mreps = 0
  let active = 0
  let inactive = 0
  const territoryIds = new Set<string>()
  const coverages: number[] = []

  for (const u of users) {
    const code = u.roleId?.code || ''
    if (MANAGER_ROLES.has(code)) managers += 1
    if (code === MREP) mreps += 1
    if (u.isActive) active += 1
    else inactive += 1
    const primary = asTerritoryRef(u.territoryId)
    if (primary) territoryIds.add(primary._id)
    for (const c of u.coverageTerritoryIds || []) {
      const t = asTerritoryRef(c)
      if (t) territoryIds.add(t._id)
    }
    if (kpiAvailable) {
      const cov = kpiByRep.get(u._id)?.coverage
      if (cov != null) coverages.push(cov)
    }
  }

  return {
    total: users.length,
    managers,
    mreps,
    active,
    inactive,
    avgCoverage: coverages.length ? Math.round(coverages.reduce((a, b) => a + b, 0) / coverages.length) : null,
    territoryCount: territoryIds.size
  }
}

export function computeOrgInsights(forest: TeamTreeNode[]): OrgInsights {
  let largestTeamName: string | null = null
  let largestTeamSize = 0
  const spans: number[] = []
  let maxDepth = 0

  const walk = (n: TeamTreeNode, depth: number) => {
    maxDepth = Math.max(maxDepth, depth)
    if (n.children.length) {
      spans.push(n.children.length)
      if (n.branchStats.subtreeSize > largestTeamSize) {
        largestTeamSize = n.branchStats.subtreeSize
        largestTeamName = n.name
      }
    }
    for (const c of n.children) walk(c, depth + 1)
  }
  for (const r of forest) walk(r, 0)

  return {
    largestTeamName,
    largestTeamSize,
    avgSpanOfControl: spans.length
      ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10
      : null,
    maxDepth
  }
}

export function territoryLabelForUser(u: TeamUser): string {
  const roleCode = u.roleId?.code || ''
  const kindHint = roleCode === 'DEFAULT_ASM' ? 'AREA' : roleCode === 'DEFAULT_RM' ? 'ZONE' : undefined
  if (u.territoryId && typeof u.territoryId === 'object') {
    return formatTerritoryCoverageLabel(u.territoryId, u.coverageTerritoryIds, {
      kind: kindHint as 'AREA' | 'ZONE' | undefined
    })
  }
  return '—'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Flatten filtered forest for CSV (depth-first). */
export function flattenForest(forest: TeamTreeNode[]): TeamTreeNode[] {
  const out: TeamTreeNode[] = []
  const walk = (n: TeamTreeNode) => {
    out.push(n)
    for (const c of n.children) walk(c)
  }
  for (const r of forest) walk(r)
  return out
}

export function buildOrgCsv(
  forest: TeamTreeNode[],
  kpiByRep: Map<string, OrgKpi>,
  kpiAvailable: boolean
): string {
  const rows = flattenForest(forest)
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const header = ['Name', 'Employee Code', 'Email', 'Role', 'Manager', 'Territory', 'Active', 'Coverage %']
  const lines = [header.join(',')]
  for (const u of rows) {
    const mgr =
      u.managerId && typeof u.managerId === 'object' ? u.managerId.name : ''
    const cov = kpiAvailable ? kpiByRep.get(u._id)?.coverage : null
    lines.push(
      [
        escape(u.name),
        escape(u.employeeCode || ''),
        escape(u.email || ''),
        escape(u.roleId?.name || ''),
        escape(mgr),
        escape(territoryLabelForUser(u)),
        u.isActive ? 'Yes' : 'No',
        cov != null ? String(cov) : ''
      ].join(',')
    )
  }
  return lines.join('\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function highlightMatch(text: string, term: string): { parts: { text: string; hit: boolean }[] } {
  if (!term.trim() || !text) return { parts: [{ text, hit: false }] }
  const lower = text.toLowerCase()
  const t = term.trim().toLowerCase()
  const idx = lower.indexOf(t)
  if (idx < 0) return { parts: [{ text, hit: false }] }
  return {
    parts: [
      { text: text.slice(0, idx), hit: false },
      { text: text.slice(idx, idx + t.length), hit: true },
      { text: text.slice(idx + t.length), hit: false }
    ].filter(p => p.text)
  }
}
