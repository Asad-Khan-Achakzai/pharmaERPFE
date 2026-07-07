/** Shared helpers for Field performance / MRep monthly overview (V2). */

export type MrepKpiSlice = {
  coverage?: { coveragePercent?: number | null; doctorsTracked?: number | null }
  planExecution?: {
    adherencePercent?: number | null
    visitCompletionPercent?: number | null
    missed?: number
    unplannedRatio?: number | null
    visited?: number
    planItemsTotal?: number
  }
  target?: {
    salesTarget?: number | null
    achievedSales?: number | null
    salesAchievementPercent?: number | null
  }
  attendanceScorePercent?: number | null
  ordersInPeriod?: { orderCount?: number; returnedOrderCount?: number; grossRevenue?: number }
  totalGrossSalesTp?: number | null
}

export type MrepOverviewRow = MrepKpiSlice & {
  repId: string
  name?: string | null
  email?: string | null
  employeeCode?: string | null
  roleCode?: string | null
  roleName?: string | null
  managerId?: string | null
  displayMode?: 'individual' | 'teamRollup'
  hasTeamRollup?: boolean
  teamSize?: number | null
  personalMetrics?: MrepKpiSlice | null
}

export type MrepScopeSummary = MrepKpiSlice & {
  teamSize?: number
  label?: string
}

export type MrepOverviewResponse = {
  month: string
  metricsVersion?: string
  scopeSummary?: MrepScopeSummary | null
  reps: MrepOverviewRow[]
}

export const MREP_ROLE_CODE = 'DEFAULT_MEDICAL_REP'

export const roleShortLabel = (code?: string | null, name?: string | null) => {
  if (code === 'DEFAULT_RM') return 'RM'
  if (code === 'DEFAULT_ASM') return 'ASM'
  if (code === 'DEFAULT_MEDICAL_REP') return 'MRep'
  if (code === 'DEFAULT_ADMIN') return 'Admin'
  return name || '—'
}

/** Primary KPI slice for display (respects team vs individual toggle for managers). */
export const displayKpis = (
  row: MrepOverviewRow,
  managerView: 'team' | 'individual'
): MrepKpiSlice => {
  if (row.hasTeamRollup && managerView === 'individual' && row.personalMetrics) {
    return row.personalMetrics
  }
  return row
}

/** Individual field metrics — for rankings, exceptions, and MRep-only views. */
export const individualKpis = (row: MrepOverviewRow): MrepKpiSlice =>
  row.personalMetrics ?? row

export const isMrepRow = (row: MrepOverviewRow) =>
  row.roleCode === MREP_ROLE_CODE || (!row.hasTeamRollup && row.roleCode !== 'DEFAULT_ASM' && row.roleCode !== 'DEFAULT_RM')

export const mrepOnlyRows = (reps: MrepOverviewRow[]) =>
  reps.filter(r => r.roleCode === MREP_ROLE_CODE)

export type HierarchicalRow = MrepOverviewRow & { depth: number; hasChildren: boolean }

type TreeNode = MrepOverviewRow & { children: TreeNode[] }

const buildForest = (rows: MrepOverviewRow[]): TreeNode[] => {
  const byId = new Map<string, TreeNode>()
  for (const r of rows) {
    byId.set(r.repId, { ...r, children: [] })
  }
  const roots: TreeNode[] = []
  const idSet = new Set(rows.map(r => r.repId))
  for (const r of rows) {
    const node = byId.get(r.repId)!
    const mid = r.managerId && idSet.has(r.managerId) ? r.managerId : null
    if (mid && byId.has(mid)) {
      byId.get(mid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    for (const n of nodes) sortTree(n.children)
  }
  sortTree(roots)
  return roots
}

/** Depth-first flat list for hierarchical table rendering. */
export const flattenHierarchy = (
  rows: MrepOverviewRow[],
  collapsedIds: Set<string>
): HierarchicalRow[] => {
  const forest = buildForest(rows)
  const out: HierarchicalRow[] = []

  const walk = (node: TreeNode, depth: number) => {
    const hasChildren = node.children.length > 0
    out.push({ ...node, depth, hasChildren })
    if (hasChildren && !collapsedIds.has(node.repId)) {
      for (const ch of node.children) walk(ch, depth + 1)
    }
  }

  for (const root of forest) walk(root, 0)
  return out
}

export const parseOverviewPayload = (raw: unknown): MrepOverviewResponse => {
  const data = (raw as { data?: MrepOverviewResponse })?.data ?? (raw as MrepOverviewResponse)
  return {
    month: data?.month ?? '',
    metricsVersion: data?.metricsVersion,
    scopeSummary: data?.scopeSummary ?? null,
    reps: Array.isArray(data?.reps) ? data.reps : []
  }
}
