/** Mirrors backend `constants/permissions` — for role & user UIs. */
export const PERMISSION_LABELS: Record<string, string> = {
  'products.viewCostPrice': 'View product cost price (products page only)',
  'admin.access': 'Full administrator access (all areas — see backend)',
  'roles.manage': 'Create and edit roles',
  'doctors.assign': 'Reassign territory / rep / target / tier on a doctor',
  'doctorLocations.review': 'Approve or reject rep-submitted doctor GPS locations',
  'team.view': 'See "My Team" widget and direct reports',
  'team.manage': 'Set / change managerId, territoryId, employeeCode on users',
  'team.viewAllReports': 'See plans, visits, and sales for entire reporting subtree',
  'territories.view': 'View Zones / Areas / Bricks',
  'territories.manage': 'Create / edit / delete Zones / Areas / Bricks',
  'weeklyPlans.review': 'Open submitted weekly plans of direct reports',
  'weeklyPlans.approve': 'Approve or reject submitted weekly plans',
  'expenses.approve': 'Approve or reject field expenses submitted by the team',
  'procurement.return': 'Record purchase returns against posted receipts',
  'procurement.grnReverse': 'Reverse a posted goods receipt (emergency / admin)',
  'procurement.cancelPo': 'Cancel supplier orders that have no receipts',
  'attendance.viewTeam': 'View team attendance reports and today board (with attendance.view)',
  'attendance.approve': 'Approve attendance requests (covers direct and escalated inbox actions)',
  'attendance.viewEscalations': "View today's attendance exception summaries (late / open checkout)",
  'attendance.override': 'Mark absent or set today status without full administrator role',
  'reports.accounting': 'Advanced accounting reports (accountants only)',
  'accounts.view': 'View financial structure / chart of accounts',
  'accounts.manage': 'Manage accounts and opening balances',
  'vouchers.view': 'View financial transactions (vouchers)',
  'vouchers.create': 'Create manual transactions and transfers (advanced)',
  'vouchers.reverse': 'Reverse posted transactions'
}

export const PERMISSION_GROUPS: Record<string, string[]> = {
  system: ['admin.access', 'roles.manage'],
  dashboard: ['dashboard.view'],
  products: ['products.view', 'products.create', 'products.edit', 'products.delete', 'products.viewCostPrice'],
  distributors: ['distributors.view', 'distributors.create', 'distributors.edit', 'distributors.delete'],
  inventory: ['inventory.view', 'inventory.transfer'],
  pharmacies: ['pharmacies.view', 'pharmacies.create', 'pharmacies.edit', 'pharmacies.delete'],
  doctors: ['doctors.view', 'doctors.create', 'doctors.edit', 'doctors.delete', 'doctors.assign'],
  doctorLocations: ['doctorLocations.review'],
  orders: ['orders.view', 'orders.create', 'orders.edit', 'orders.deliver', 'orders.return'],
  payments: ['payments.view', 'payments.create'],
  ledger: ['ledger.view'],
  accounts: ['accounts.view', 'accounts.manage'],
  vouchers: ['vouchers.view', 'vouchers.create', 'vouchers.post', 'vouchers.reverse'],
  targets: ['targets.view', 'targets.create', 'targets.edit'],
  weeklyPlans: [
    'weeklyPlans.view',
    'weeklyPlans.create',
    'weeklyPlans.edit',
    'weeklyPlans.markVisit',
    'weeklyPlans.review',
    'weeklyPlans.approve'
  ],
  expenses: ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete', 'expenses.approve'],
  payroll: ['payroll.view', 'payroll.create', 'payroll.edit', 'payroll.pay'],
  attendance: [
    'attendance.view',
    'attendance.viewTeam',
    'attendance.mark',
    'attendance.request.create',
    'attendance.approve',
    'attendance.approve.direct',
    'attendance.approve.escalated',
    'attendance.viewEscalations',
    'attendance.override',
    'attendance.matrix.manage',
    'attendance.governance.view'
  ],
  reports: ['reports.view', 'reports.accounting'],
  suppliers: ['suppliers.view', 'suppliers.manage'],
  procurement: [
    'procurement.view',
    'procurement.create',
    'procurement.approve',
    'procurement.receive',
    'procurement.invoicePost',
    'procurement.return',
    'procurement.grnReverse',
    'procurement.cancelPo'
  ],
  users: ['users.view', 'users.create', 'users.edit', 'users.delete'],
  team: ['team.view', 'team.manage', 'team.viewAllReports'],
  territories: ['territories.view', 'territories.manage']
}

export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_GROUPS).flat()
export const DASHBOARD_VIEW = 'dashboard.view'

export const labelFor = (perm: string) => PERMISSION_LABELS[perm] ?? perm.split('.').slice(1).join(' · ')
