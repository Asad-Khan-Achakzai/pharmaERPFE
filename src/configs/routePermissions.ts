/**
 * Maps route prefixes to the permission required to access them.
 * Order matters: more specific routes must come before their parent prefixes.
 * `platform.*` permissions are enforced in AuthGuard: SUPER_ADMIN, `userType === 'PLATFORM'`, or a literal key on `user.permissions` — not `admin.access`.
 */
export const routePermissions: Array<{ path: string; permission: string }> = [
  { path: '/platform', permission: 'platform.dashboard.view' },
  { path: '/orders/add', permission: 'orders.create' },
  { path: '/orders', permission: 'orders.view' },
  { path: '/payments/add', permission: 'payments.create' },
  { path: '/payments', permission: 'payments.view' },
  { path: '/settlements/add', permission: 'payments.create' },
  { path: '/settlements', permission: 'payments.view' },
  { path: '/inventory', permission: 'inventory.view' },
  { path: '/products', permission: 'products.view' },
  { path: '/distributors', permission: 'distributors.view' },
  { path: '/pharmacies', permission: 'pharmacies.view' },
  { path: '/doctors', permission: 'doctors.view' },
  { path: '/ledger', permission: 'ledger.view' },
  { path: '/targets', permission: 'targets.view' },
  { path: '/weekly-plans', permission: 'weeklyPlans.view' },
  { path: '/expenses', permission: 'expenses.view' },
  { path: '/salary-structure', permission: 'payroll.view' },
  /** Attendance sub-routes: see AuthGuard for `attendance.sub.*` resolution (must stay before `/attendance`). */
  { path: '/attendance/admin', permission: 'attendance.sub.admin' },
  { path: '/attendance/team', permission: 'attendance.sub.team' },
  { path: '/attendance/me', permission: 'attendance.view' },
  { path: '/attendance', permission: 'attendance.view' },
  { path: '/payroll', permission: 'payroll.view' },
  { path: '/reports', permission: 'reports.view' },
  { path: '/procurement', permission: 'procurement.view' },
  { path: '/suppliers', permission: 'suppliers.view' },
  { path: '/users/roles', permission: 'users.view' },
  { path: '/users', permission: 'users.view' },
  { path: '/audit-log', permission: 'users.view' },
  { path: '/dashboard/mrep/exceptions', permission: 'weeklyPlans.view' },
  { path: '/dashboard/mrep/trends', permission: 'weeklyPlans.view' },
  { path: '/dashboard/mrep', permission: 'weeklyPlans.view' },
  { path: '/dashboard/manager/team', permission: 'team.view' },
  { path: '/dashboard/manager', permission: 'weeklyPlans.view' },
  { path: '/team/tree', permission: 'team.view' },
  { path: '/territories/analytics', permission: 'territories.view' },
  { path: '/territories', permission: 'territories.view' },
  { path: '/home', permission: 'dashboard.view' }
]

export function getRequiredPermission(pathname: string): string | null {
  for (const { path, permission } of routePermissions) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return permission
    }
  }
  return null
}
