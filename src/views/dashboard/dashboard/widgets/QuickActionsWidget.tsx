'use client'

import { useMemo } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import { useAuth } from '@/contexts/AuthContext'
import DashboardQuickActions, { type QuickAction } from '@/views/dashboard/DashboardQuickActions'
import { orderQuickActions } from '@/views/dashboard/dashboardLayout'
import { useDashboardV3Data } from '../core/dashboardDataOrchestrator'

export function QuickActionsWidget({ sx }: { sx?: SxProps<Theme> }) {
  const { hasPermission, user } = useAuth()
  const d = useDashboardV3Data()
  const preferExecution =
    !d.canSeeCompanyFinancials || (d.canSeeCompanyFinancials && hasPermission('weeklyPlans.view'))

  const actions = useMemo<QuickAction[]>(() => {
    if (!user) return []
    const has = (permission: string) => hasPermission(permission)
    const actionCatalog: QuickAction[] = [
      { key: 'orders', label: 'Orders', href: '/orders/list', icon: 'tabler-clipboard-list' },
      { key: 'visits', label: 'Visits', href: '/visits/today', icon: 'tabler-map-pin' },
      { key: 'attendance', label: 'Attendance', href: '/attendance/me', icon: 'tabler-calendar-check' },
      { key: 'targets', label: 'Targets', href: '/targets', icon: 'tabler-target' },
      { key: 'reports', label: 'Reports', href: '/reports', icon: 'tabler-chart-line' },
      { key: 'inventory', label: 'Inventory', href: '/inventory', icon: 'tabler-packages' },
      { key: 'suppliers', label: 'Suppliers', href: '/suppliers/list', icon: 'tabler-building-store' },
      { key: 'payments', label: 'Payments', href: '/payments/list', icon: 'tabler-cash' }
    ]
    const permissionMap: Record<string, string> = {
      orders: 'orders.view',
      visits: 'weeklyPlans.view',
      targets: 'targets.view',
      reports: 'reports.view',
      inventory: 'inventory.view',
      suppliers: 'suppliers.view',
      payments: 'payments.view'
    }
    const allowed = actionCatalog.filter(a => {
      if (a.key === 'attendance') return has('attendance.view') || has('attendance.mark')
      return has(permissionMap[a.key] || '')
    })
    return orderQuickActions(allowed, preferExecution)
  }, [user, hasPermission, preferExecution])

  return <DashboardQuickActions actions={actions} sx={sx} />
}
