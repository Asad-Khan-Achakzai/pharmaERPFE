/**
 * Dashboard experience tier — NOT authorization.
 * Uses tenant-aligned resolvedRole from auth payload + SUPER_ADMIN; never user.permissions.
 */

import type { User } from '@/contexts/AuthContext'

/** Must stay aligned with pharmaERPBackend `constants/rbac` DEFAULT_ADMIN_CODE */
export const DASHBOARD_FULL_ROLE_CODE = 'DEFAULT_ADMIN'

export type DashboardExperience = 'full' | 'limited'

/**
 * Full dashboard (KPI / monitoring / executive widgets): system Administrator in active tenant, or SUPER_ADMIN.
 */
export function isFullDashboardUser(user: User | null): boolean {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  const r = user.resolvedRole
  if (!r?.code || r.isSystem !== true) return false
  return r.code === DASHBOARD_FULL_ROLE_CODE
}

export function getDashboardExperience(user: User | null): DashboardExperience {
  return isFullDashboardUser(user) ? 'full' : 'limited'
}
