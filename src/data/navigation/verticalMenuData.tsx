// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

export type MenuItemWithPermission = VerticalMenuDataType & {
  permission?: string
  /** Show when the user has any one of these permissions (legacy aliases supported). */
  permissionAny?: string[]
  /** If true, require that exact key in user.permissions (not admin.access / SUPER_ADMIN bypass in menu filter). */
  explicitPermission?: boolean
  /** If set, menu item is only shown for these roles (e.g. SUPER_ADMIN). */
  roles?: string[]
  children?: MenuItemWithPermission[]
}

const verticalMenuData = (): MenuItemWithPermission[] => [
  {
    label: 'Super Admin',
    icon: 'tabler-shield-lock',
    children: [
      { label: 'Companies', href: '/super-admin', roles: ['SUPER_ADMIN'] },
      {
        label: 'Platform users',
        href: '/super-admin/platform-users',
        permission: 'platform.companies.manage',
        explicitPermission: true
      }
    ]
  },
  {
    label: 'Platform',
    href: '/platform',
    icon: 'tabler-building-community',
    /** Do not use `admin.access` bypass — company tenant admins would otherwise see this link while APIs stay 403. */
    permission: 'platform.dashboard.view',
    explicitPermission: true
  },
  {
    label: 'Overview',
    icon: 'tabler-layout-dashboard',
    children: [
      { label: 'Dashboard', href: '/home', permission: 'dashboard.view' },
      { label: 'MRep command center', href: '/dashboard/mrep', permission: 'weeklyPlans.view' },
      { label: 'Field performance', href: '/dashboard/manager', permission: 'weeklyPlans.view' },
      { label: 'Team (cards)', href: '/dashboard/manager/team', permission: 'team.view' },
      { label: 'Org chart', href: '/team/tree', permission: 'team.view' },
      { label: 'Territory analytics', href: '/territories/analytics', permission: 'territories.view' },
      { label: 'Reports & Insights', href: '/reports', permission: 'reports.view' }
    ]
  },
  {
    label: 'Sales & Distribution',
    icon: 'tabler-shopping-cart',
    children: [
      {
        label: 'Orders',
        icon: 'tabler-clipboard-list',
        children: [
          { label: 'All Orders', href: '/orders/list', permission: 'orders.view' },
          { label: 'Create Order', href: '/orders/add', permission: 'orders.create' }
        ]
      },
      { label: 'Pharmacies', href: '/pharmacies/list', icon: 'tabler-building-store', permission: 'pharmacies.view' },
      {
        label: 'Doctors & Visits',
        icon: 'tabler-stethoscope',
        children: [
          { label: 'Doctors', href: '/doctors/list', permission: 'doctors.view' },
          { label: 'Location review', href: '/doctors/location-review', permission: 'doctorLocations.review' },
          { label: 'Activities', href: '/doctor-activities/list', permission: 'doctors.view' }
        ]
      },
      { label: 'Distributors', href: '/distributors/list', icon: 'tabler-truck', permission: 'distributors.view' },
      { label: 'Targets', href: '/targets', icon: 'tabler-target-arrow', permission: 'targets.view' }
    ]
  },
  {
    label: 'Supply Chain',
    icon: 'tabler-package',
    children: [
      { label: 'Products', href: '/products/list', icon: 'tabler-pill', permission: 'products.view' },
      {
        label: 'Inventory',
        icon: 'tabler-packages',
        children: [
          { label: 'Stock Overview', href: '/inventory', permission: 'inventory.view' },
          { label: 'Stock Transfers', href: '/inventory/transfer', permission: 'inventory.view' }
        ]
      },
      { label: 'Procurement', href: '/procurement', icon: 'tabler-clipboard-check', permission: 'procurement.view' },
      { label: 'Suppliers', href: '/suppliers/list', icon: 'tabler-building-factory', permission: 'suppliers.view' }
    ]
  },
  {
    label: 'Finance',
    icon: 'tabler-currency-dollar',
    children: [
      { label: 'Money Accounts', href: '/finance/money-accounts', icon: 'tabler-wallet', permission: 'payments.view' },
      {
        label: 'Receive Payment',
        icon: 'tabler-cash',
        children: [
          { label: 'All Payments Received', href: '/payments/list', permission: 'payments.view' },
          { label: 'Record Payment', href: '/payments/add', permission: 'payments.create' }
        ]
      },
      {
        label: 'Settlements',
        icon: 'tabler-arrows-transfer-down',
        children: [
          { label: 'All Settlements', href: '/settlements/list', permission: 'payments.view' },
          { label: 'Record Settlement', href: '/settlements/add', permission: 'payments.create' }
        ]
      },
      { label: 'Expenses', href: '/expenses/list', icon: 'tabler-receipt', permission: 'expenses.view' },
      { label: 'Voucher Entry', href: '/finance/transfers', icon: 'tabler-arrows-exchange', permission: 'vouchers.transfer' },
      { label: 'General Ledger', href: '/finance/reports/general-ledger', icon: 'tabler-book', permission: 'reports.accounting' },
      { label: 'Client Ledger', href: '/finance/client-ledger', icon: 'tabler-users-group', permission: 'ledger.view' },
      { label: 'Supplier Ledger', href: '/finance/supplier-ledger', icon: 'tabler-truck', permission: 'ledger.view' },
      { label: 'Expense Ledger', href: '/finance/expense-ledger', icon: 'tabler-receipt-2', permission: 'expenses.view' },
      { label: 'Activity Ledger', href: '/finance/activity-ledger', icon: 'tabler-stethoscope', permission: 'doctors.view' },
      { label: 'Employee Ledger', href: '/finance/employee-ledger', icon: 'tabler-id', permission: 'ledger.view' },
      {
        label: 'Advanced Accounting',
        icon: 'tabler-calculator',
        children: [
          { label: 'Financial Structure', href: '/finance/accounts', icon: 'tabler-list-tree', permission: 'accounts.view' },
          { label: 'Customer Balances', href: '/ledger', icon: 'tabler-report-money', permission: 'ledger.view' },
          { label: 'Advanced Financial Structure', href: '/finance/accounts/advanced', permission: 'accounts.view' },
          { label: 'Financial Activity', href: '/finance/vouchers', permission: 'vouchers.view' },
          { label: 'Manual Entry', href: '/finance/vouchers/new', permission: 'vouchers.create' },
          {
            label: 'Reports',
            children: [
              { label: 'Financial Summary Check', href: '/finance/reports/trial-balance', permission: 'reports.accounting' },
              { label: 'Profit Report', href: '/finance/reports/profit-loss', permission: 'reports.accounting' },
              { label: 'Business Position', href: '/finance/reports/balance-sheet', permission: 'reports.accounting' },
              { label: 'Daily Activity', href: '/finance/reports/day-book', permission: 'reports.accounting' },
              { label: 'Cash Activity', href: '/finance/reports/cash-book', permission: 'reports.accounting' },
              { label: 'Bank Activity', href: '/finance/reports/bank-book', permission: 'reports.accounting' }
            ]
          }
        ]
      }
    ]
  },
  {
    label: 'People & Operations',
    icon: 'tabler-users-group',
    children: [
      {
        label: 'Team',
        icon: 'tabler-users',
        children: [
          { label: 'User List', href: '/users/list', permission: 'users.view' },
          { label: 'My Team', href: '/team', permission: 'team.view' },
          { label: 'Live tracking', href: '/team/live', permission: 'team.view' },
          { label: 'Territories', href: '/territories', permission: 'territories.view' },
          { label: 'Roles & Permissions', href: '/users/roles', permission: 'users.view' }
        ]
      },
      {
        label: 'Payroll',
        icon: 'tabler-wallet',
        children: [
          { label: 'Payroll Overview', href: '/payroll', permission: 'payroll.view' },
          { label: 'Salary Structure', href: '/salary-structure', permission: 'payroll.view' },
          { label: 'Attendance', href: '/attendance/me', permission: 'attendance.view' }
        ]
      },
      {
        label: 'Weekly Plans',
        icon: 'tabler-calendar-week',
        children: [
          { label: 'Calendar', href: '/calendar', permission: 'weeklyPlans.view' },
          { label: 'All Plans', href: '/weekly-plans', permission: 'weeklyPlans.view' },
          { label: "Today's Visits", href: '/visits/today', permission: 'weeklyPlans.markVisit' }
        ]
      }
    ]
  },
  {
    label: 'System',
    icon: 'tabler-settings',
    children: [
      { label: 'Onboarding', href: '/onboarding', icon: 'tabler-rocket', permission: 'onboarding.view' },
      { label: 'Device Control', href: '/device-control', icon: 'tabler-devices', permission: 'deviceControl.manage' },
      { label: 'Audit Log', href: '/audit-log', icon: 'tabler-history', permission: 'users.view' }
    ]
  }
]

export default verticalMenuData
