/** Shared team roster types for My Team / Org chart (GET /users/team). */

export type TerritoryRef = {
  _id: string
  name: string
  code?: string | null
  kind: string
}

export type TeamUser = {
  _id: string
  name: string
  email: string
  isActive: boolean
  employeeCode?: string | null
  roleId?: { _id?: string; name?: string; code?: string } | null
  managerId?: { _id: string; name: string; email?: string } | string | null
  territoryId?: TerritoryRef | string | null
  coverageTerritoryIds?: Array<TerritoryRef | string> | null
}

export type BranchStats = {
  directReports: number
  /** Descendants only (excludes self). */
  subtreeSize: number
  mrepCount: number
}

export type TeamTreeNode = TeamUser & {
  children: TeamTreeNode[]
  branchStats: BranchStats
}

export type OrgKpi = {
  coverage: number | null
  teamSize: number | null
  isManager: boolean
  adherence: number | null
  salesAchievement: number | null
}

export type OrgSummary = {
  total: number
  managers: number
  mreps: number
  active: number
  inactive: number
  avgCoverage: number | null
  territoryCount: number
}

export type CoverageBand = '' | 'healthy' | 'watch' | 'unknown'

export type OrgRoleFilter = '' | 'DEFAULT_RM' | 'DEFAULT_ASM' | 'DEFAULT_MEDICAL_REP' | 'DEFAULT_ADMIN'

export type OrgFilters = {
  roleCode: OrgRoleFilter
  coverageBand: CoverageBand
  territoryId: string
  managerId: string
}

export type OrgInsights = {
  largestTeamName: string | null
  largestTeamSize: number
  avgSpanOfControl: number | null
  maxDepth: number
}
