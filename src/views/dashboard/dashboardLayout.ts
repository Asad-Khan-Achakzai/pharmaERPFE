/**
 * Single source of truth for /home section visibility and mode.
 * Executive (company financials) tier uses system Administrator role — not permission strings.
 */

export type DashboardMode = 'execution' | 'monitoring' | 'hybrid'

export type DashboardLayoutSpec = {
  mode: DashboardMode
  /** Company-wide P&L snapshot (reports /dashboard) + KPI row — full dashboard tier only */
  canSeeCompanyFinancials: boolean
  /** Today’s plan items + rep targets block */
  showExecutionPanel: boolean
  /** Reorder quick actions: field work first */
  preferExecutionActionOrder: boolean
}

/**
 * Legacy /home layout helper. `isFullDashboardUser` = system DEFAULT_ADMIN or SUPER_ADMIN (see dashboardExperience).
 */
export function resolveDashboardLayout(
  has: (permission: string) => boolean,
  isFullDashboardUser: boolean
): DashboardLayoutSpec {
  const canSeeCompanyFinancials = isFullDashboardUser
  const showExecutionPanel = has('weeklyPlans.view')
  /** Visits-first quick actions for field + hybrid; default order for monitoring-only. */
  const preferExecutionActionOrder = !canSeeCompanyFinancials || (canSeeCompanyFinancials && showExecutionPanel)

  let mode: DashboardMode
  if (canSeeCompanyFinancials && showExecutionPanel) {
    mode = 'hybrid'
  } else if (canSeeCompanyFinancials) {
    mode = 'monitoring'
  } else {
    mode = 'execution'
  }

  return {
    mode,
    canSeeCompanyFinancials,
    showExecutionPanel,
    preferExecutionActionOrder
  }
}

const EXECUTION_QUICK_ACTION_ORDER: string[] = [
  'visits',
  'orders',
  'attendance',
  'targets',
  'reports',
  'inventory',
  'suppliers',
  'payments'
]

const DEFAULT_QUICK_ACTION_ORDER: string[] = [
  'orders',
  'visits',
  'attendance',
  'targets',
  'reports',
  'inventory',
  'suppliers',
  'payments'
]

/**
 * Stable sort: unknown keys keep their relative order after known keys.
 */
export function orderQuickActions<T extends { key: string }>(actions: T[], preferExecution: boolean): T[] {
  const order = preferExecution ? EXECUTION_QUICK_ACTION_ORDER : DEFAULT_QUICK_ACTION_ORDER
  const index = (k: string) => {
    const i = order.indexOf(k)
    return i === -1 ? 999 + k.charCodeAt(0) : i
  }
  return [...actions].sort((a, b) => index(a.key) - index(b.key))
}
