/** Mirrors GET /api/v1/dashboard/home payload (shape may grow). */
export type DashboardHomeMode = 'execution' | 'monitoring' | 'hybrid'

export type DashboardHomePayload = {
  mode: DashboardHomeMode
  features: { canSeeCompanyFinancials: boolean; showExecutionPanel: boolean }
  kpis: Record<string, unknown> | null
  today: { visits: unknown[]; pendingPlanItems: unknown[] }
  targets: { currentMonth: Record<string, unknown> | null; allRows: unknown[] }
  attendance: { team: TodayBoardLike | null; me: unknown | null }
  suppliers: {
    recentPayments: { docs?: unknown[] }
    balances: { rows?: unknown[]; totals?: unknown }
  } | null
  charts: { deferred?: boolean }
  meta?: { source?: string; version?: number; warnings?: { section: string; message: string }[] }
}

export type TodayBoardLike = {
  employees?: unknown[]
  distribution?: Record<string, number>
}
