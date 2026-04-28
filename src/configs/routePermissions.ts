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
  { path: '/attendance', permission: 'attendance.view' },
  { path: '/payroll', permission: 'payroll.view' },
  { path: '/reports', permission: 'reports.view' },
  { path: '/suppliers', permission: 'suppliers.view' },
  { path: '/users/roles', permission: 'users.view' },
  { path: '/users', permission: 'users.view' },
  { path: '/audit-log', permission: 'users.view' },
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
