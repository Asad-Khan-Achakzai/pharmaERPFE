// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'

export type HorizontalMenuItemWithPermission = HorizontalMenuDataType & {
  permission?: string
  explicitPermission?: boolean
  roles?: string[]
  children?: HorizontalMenuItemWithPermission[]
}

const horizontalMenuData = (): HorizontalMenuItemWithPermission[] => [
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
    permission: 'platform.dashboard.view',
    explicitPermission: true
  },
  { label: 'Dashboard', href: '/home', icon: 'tabler-smart-home', permission: 'dashboard.view' },
  { label: 'Products', href: '/products/list', icon: 'tabler-pill', permission: 'products.view' },
  { label: 'Distributors', href: '/distributors/list', icon: 'tabler-truck', permission: 'distributors.view' },
  { label: 'Orders', href: '/orders/list', icon: 'tabler-clipboard-list', permission: 'orders.view' },
  { label: 'Pharmacies', href: '/pharmacies/list', icon: 'tabler-building-store', permission: 'pharmacies.view' },
  { label: 'Payments', href: '/payments/list', icon: 'tabler-cash', permission: 'payments.view' },
  { label: 'Reports', href: '/reports', icon: 'tabler-chart-bar', permission: 'reports.view' }
]

export default horizontalMenuData
