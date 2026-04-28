'use client'

import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import DashboardWelcomeColumn from '@/views/dashboard/DashboardWelcomeColumn'
import { useDashboardV3Data } from '../core/dashboardDataOrchestrator'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Welcome copy + total sales highlight — data from orchestrator only.
 */
export function WelcomeHeroWidget() {
  const d = useDashboardV3Data()
  const { user } = useAuth()
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const summary = useMemo(() => {
    if (!d.canSeeCompanyFinancials) {
      return 'You’re on your execution dashboard: open visits, orders, and attendance from the shortcuts below.'
    }
    if (!d.kpi && (d.kpiLoading || d.bundleLoading)) return 'Loading current business health…'
    if (!d.kpi) return 'Loading current business health indicators.'
    const data = d.kpi
    const net = Number(data.netProfit || 0)
    const outstanding = Number(data.totalOutstanding || 0)
    if (net >= 0 && outstanding <= Number(data.totalSales || 0) * 0.3) {
      return 'Profit is positive and outstanding exposure is within a stable range.'
    }
    if (net < 0) return 'Revenue is active, but profitability is negative and needs attention.'
    return 'Revenue is steady while cashflow pressure remains on outstanding balances.'
  }, [d])

  const highlight = useMemo(() => {
    if (!d.canSeeCompanyFinancials || d.kpiError) return undefined
    if (d.kpi) return formatPKR(Number(d.kpi.totalSales) || 0)
    return undefined
  }, [d])

  const sub = useMemo(() => {
    if (d.canSeeCompanyFinancials && (d.kpiLoading || d.bundleLoading) && !d.kpi) return 'Loading current business health…'
    return summary
  }, [d, summary])

  return (
    <DashboardWelcomeColumn greeting={greeting} name={user?.name || 'Team'} summary={sub} highlight={highlight} />
  )
}
