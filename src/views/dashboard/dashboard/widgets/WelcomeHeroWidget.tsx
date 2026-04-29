'use client'

import { useMemo } from 'react'
import Typography from '@mui/material/Typography'
import { useAuth } from '@/contexts/AuthContext'
import DashboardWelcomeColumn from '@/views/dashboard/DashboardWelcomeColumn'
import { useDashboardV3Data } from '../core/dashboardDataOrchestrator'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Welcome copy + **Net sales (TP) · this month** (from GET /reports/dashboard, calendar month).
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
    if (d.canLoadDashboardKpis && !d.kpi && (d.kpiLoading || d.bundleLoading)) {
      return 'Loading this month’s sales…'
    }
    if (!d.canSeeCompanyFinancials) {
      return 'Open visits, orders, and attendance from the shortcuts below.'
    }
    if (!d.kpi && (d.kpiLoading || d.bundleLoading)) return 'Loading this month’s summary…'
    if (!d.kpi) return 'Loading…'
    const data = d.kpi
    const net = Number(data.netProfit || 0)
    const outstanding = Number(data.totalOutstanding || 0)
    if (net >= 0 && outstanding <= Number(data.totalSales || 0) * 0.3) {
      return 'Profit is positive and outstanding exposure is within a stable range.'
    }
    if (net < 0)
      return 'Net sales are active, but net profit is negative and needs attention.'
    return 'Net sales are steady while cashflow pressure remains on outstanding balances.'
  }, [d])

  const highlight = useMemo(() => {
    if (!d.canLoadDashboardKpis) return undefined
    if (d.kpiError || !d.kpi) return undefined
    const tp = Number(d.kpi.totalGrossSalesTp ?? 0)
    const fmt = formatPKR
    return (
      <>
        <Typography variant='caption' color='text.secondary' display='block'>
          Net sales (TP) · this month
        </Typography>
        <Typography variant='h4' color='primary.main' className='mbe-1'>
          {fmt(tp)}
        </Typography>
      </>
    )
  }, [d])

  const sub = useMemo(() => {
    if (d.canLoadDashboardKpis && (d.kpiLoading || d.bundleLoading) && !d.kpi) {
      return 'Loading this month’s sales…'
    }
    return summary
  }, [d, summary])

  return (
    <DashboardWelcomeColumn greeting={greeting} name={user?.name || 'Team'} summary={sub} highlight={highlight} />
  )
}
