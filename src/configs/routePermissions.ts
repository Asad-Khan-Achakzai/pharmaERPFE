/**
 * Maps route prefixes to the permission required to access them.
 * Order matters: more specific routes must come before their parent prefixes.
 * `platform.*` permissions are enforced in AuthGuard: SUPER_ADMIN, `userType === 'PLATFORM'`, or a literal key on `user.permissions` — not `admin.access`.
 *
 * `finance.access` is a synthetic key (not on the JWT) — AuthGuard resolves it to any finance-area permission.
 */
export const FINANCE_AREA_PERMISSIONS = [
  'payments.view',
  'payments.create',
  'ledger.view',
  'accounts.view',
  'accounts.manage',
  'vouchers.view',
  'vouchers.transfer',
  'vouchers.create',
  'reports.accounting',
  'expenses.view'
] as const

export const FINANCE_HUB_PERMISSION = 'finance.access'

export const routePermissions: Array<{ path: string; permission: string }> = [
  { path: '/platform', permission: 'platform.dashboard.view' },
  { path: '/orders/add', permission: 'orders.create' },
  { path: '/orders', permission: 'orders.view' },
  { path: '/payments/add', permission: 'payments.create' },
  { path: '/payments', permission: 'payments.view' },
  { path: '/settlements/add', permission: 'payments.create' },
  { path: '/settlements', permission: 'payments.view' },
  { path: '/inventory', permission: 'inventory.view' },
  { path: '/brands', permission: 'brands.view' },
  { path: '/product-taxonomy', permission: 'productTaxonomy.view' },
  { path: '/catalog-campaigns', permission: 'campaigns.view' },
  { path: '/product-kits', permission: 'kits.view' },
  { path: '/products', permission: 'products.view' },
  { path: '/distributors', permission: 'distributors.view' },
  { path: '/pharmacies', permission: 'pharmacies.view' },
  { path: '/doctors/location-review', permission: 'doctorLocations.review' },
  { path: '/doctors', permission: 'doctors.view' },
  { path: '/finance/vouchers/new', permission: 'vouchers.create' },
  { path: '/finance/vouchers', permission: 'vouchers.view' },
  { path: '/finance/transfers', permission: 'vouchers.transfer' },
  { path: '/finance/accounts/advanced', permission: 'accounts.view' },
  { path: '/finance/accounts', permission: 'accounts.view' },
  { path: '/finance/reports', permission: 'reports.accounting' },
  { path: '/finance/client-ledger', permission: 'ledger.view' },
  { path: '/finance/supplier-ledger', permission: 'ledger.view' },
  { path: '/finance/employee-ledger', permission: 'ledger.view' },
  { path: '/finance/expense-ledger', permission: 'expenses.view' },
  { path: '/finance/money-accounts', permission: 'payments.view' },
  { path: '/finance', permission: FINANCE_HUB_PERMISSION },
  { path: '/ledger', permission: 'ledger.view' },
  { path: '/targets', permission: 'targets.view' },
  { path: '/calendar', permission: 'weeklyPlans.view' },
  { path: '/call-points', permission: 'callPoints.view' },
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
  { path: '/device-control', permission: 'deviceControl.manage' },
  { path: '/onboarding', permission: 'onboarding.view' },
  { path: '/audit-log', permission: 'users.view' },
  { path: '/dashboard/mrep/exceptions', permission: 'weeklyPlans.view' },
  { path: '/dashboard/mrep/trends', permission: 'weeklyPlans.view' },
  { path: '/dashboard/mrep', permission: 'weeklyPlans.view' },
  { path: '/dashboard/manager/team', permission: 'team.view' },
  { path: '/dashboard/manager', permission: 'weeklyPlans.view' },
  { path: '/team/live', permission: 'team.sub.live' },
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
