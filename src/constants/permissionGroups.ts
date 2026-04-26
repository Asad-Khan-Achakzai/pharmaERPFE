/** Mirrors backend `constants/permissions` — for role & user UIs. */
export const PERMISSION_LABELS: Record<string, string> = {
  'products.viewCostPrice': 'View product cost price (products page only)',
  'admin.access': 'Full administrator access (all areas — see backend)',
  'roles.manage': 'Create and edit roles'
}

export const PERMISSION_GROUPS: Record<string, string[]> = {
  system: ['admin.access', 'roles.manage'],
  dashboard: ['dashboard.view'],
  products: ['products.view', 'products.create', 'products.edit', 'products.delete', 'products.viewCostPrice'],
  distributors: ['distributors.view', 'distributors.create', 'distributors.edit', 'distributors.delete'],
  inventory: ['inventory.view', 'inventory.transfer'],
  pharmacies: ['pharmacies.view', 'pharmacies.create', 'pharmacies.edit', 'pharmacies.delete'],
  doctors: ['doctors.view', 'doctors.create', 'doctors.edit', 'doctors.delete'],
  orders: ['orders.view', 'orders.create', 'orders.edit', 'orders.deliver', 'orders.return'],
  payments: ['payments.view', 'payments.create'],
  ledger: ['ledger.view'],
  targets: ['targets.view', 'targets.create', 'targets.edit'],
  weeklyPlans: ['weeklyPlans.view', 'weeklyPlans.create', 'weeklyPlans.edit', 'weeklyPlans.markVisit'],
  expenses: ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'],
  payroll: ['payroll.view', 'payroll.create', 'payroll.edit', 'payroll.pay'],
  attendance: ['attendance.view', 'attendance.mark'],
  reports: ['reports.view'],
  suppliers: ['suppliers.view', 'suppliers.manage'],
  users: ['users.view', 'users.create', 'users.edit', 'users.delete']
}

export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_GROUPS).flat()
export const DASHBOARD_VIEW = 'dashboard.view'

export const labelFor = (perm: string) => PERMISSION_LABELS[perm] ?? perm.split('.').slice(1).join(' · ')
