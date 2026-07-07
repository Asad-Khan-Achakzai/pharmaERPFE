'use client'

import { useEffect, useMemo, useState } from 'react'
import Typography from '@mui/material/Typography'
import { useAuth } from '@/contexts/AuthContext'
import DashboardWelcomeColumn from '@/views/dashboard/DashboardWelcomeColumn'
import { useDashboardV3Data } from '../core/dashboardDataOrchestrator'
import { reportsService } from '@/services/reports.service'
import { parseOverviewPayload } from '@/utils/mrepOverviewUtils'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type MrepSalesRow = {
  repId: string
  totalGrossSalesTp?: number | null
}

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Welcome + (for company admins only) financial month highlight from GET /dashboard/home.
 * Field reps see route-focused copy instead of net sales on the hero.
 */
export function WelcomeHeroWidget() {
  const d = useDashboardV3Data()
  const { user } = useAuth()
  const [mrepSalesRows, setMrepSalesRows] = useState<MrepSalesRow[]>([])
  const [mrepScopeTp, setMrepScopeTp] = useState<number | null>(null)
  const [mrepPersonalTp, setMrepPersonalTp] = useState<number | null>(null)
  const [mrepSalesLoading, setMrepSalesLoading] = useState(false)
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const summary = useMemo(() => {
    const ex = d.todayExecution
    if (!d.canSeeCompanyFinancials && ex?.summary && typeof ex.summary.total === 'number') {
      const { visited, total, pending } = ex.summary
      if (total <= 0) return 'No visits planned for today. Add stops in your weekly plan or log an unplanned visit.'
      return `Today’s route: ${visited}/${total} complete${pending ? ` · ${pending} remaining` : ''}.`
    }
    if (d.canSeeCompanyFinancials && d.canLoadDashboardKpis && !d.kpi && (d.kpiLoading || d.bundleLoading)) {
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

  const canLoadFieldSales =
    !d.canSeeCompanyFinancials &&
    (d.hasPermission('weeklyPlans.view') ||
      d.hasPermission('weeklyPlans.markVisit') ||
      d.hasPermission('team.viewAllReports'))

  useEffect(() => {
    if (!canLoadFieldSales) {
      setMrepSalesRows([])
      setMrepScopeTp(null)
      setMrepPersonalTp(null)
      setMrepSalesLoading(false)
      return
    }

    let cancel = false
    setMrepSalesLoading(true)
    void reportsService
      .mrepMonthlyOverview({ params: { month: ymNow() } })
      .then(res => {
        if (cancel) return
        const payload = parseOverviewPayload(res.data)
        setMrepSalesRows(payload.reps)
        setMrepScopeTp(payload.scopeSummary?.totalGrossSalesTp != null ? Number(payload.scopeSummary.totalGrossSalesTp) : null)
        const self = payload.reps.find(row => String(row.repId) === String(user?._id))
        setMrepPersonalTp(
          self?.personalMetrics?.totalGrossSalesTp != null
            ? Number(self.personalMetrics.totalGrossSalesTp)
            : self?.totalGrossSalesTp != null
              ? Number(self.totalGrossSalesTp)
              : null
        )
      })
      .catch(() => {
        if (!cancel) {
          setMrepSalesRows([])
          setMrepScopeTp(null)
          setMrepPersonalTp(null)
        }
      })
      .finally(() => {
        if (!cancel) setMrepSalesLoading(false)
      })

    return () => {
      cancel = true
    }
  }, [canLoadFieldSales, user?._id])

  const highlight = useMemo(() => {
    if (!d.canSeeCompanyFinancials || !d.canLoadDashboardKpis) return undefined
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

  const fieldSalesHighlight = useMemo(() => {
    if (!canLoadFieldSales) return undefined
    if (mrepSalesLoading && !mrepSalesRows.length) {
      return (
        <Typography variant='body2' color='text.secondary'>
          Loading this month’s sales…
        </Typography>
      )
    }

    const ownSales = mrepPersonalTp ?? Number(
      mrepSalesRows.find(row => String(row.repId) === String(user?._id))?.totalGrossSalesTp ?? 0
    )
    const hasTeamScope = d.hasPermission('team.viewAllReports')
    const teamSales =
      mrepScopeTp ??
      mrepSalesRows.reduce((sum, row) => sum + Number(row.totalGrossSalesTp ?? 0), 0)

    if (hasTeamScope) {
      return (
        <div className='flex flex-wrap gap-6'>
          <div>
            <Typography variant='caption' color='text.secondary' display='block'>
              My sale · this month
            </Typography>
            <Typography variant='h5' color='primary.main'>
              {formatPKR(ownSales)}
            </Typography>
          </div>
          <div>
            <Typography variant='caption' color='text.secondary' display='block'>
              Team sale · this month
            </Typography>
            <Typography variant='h5' color='primary.main'>
              {formatPKR(teamSales)}
            </Typography>
          </div>
        </div>
      )
    }

    return (
      <>
        <Typography variant='caption' color='text.secondary' display='block'>
          My sale · this month
        </Typography>
        <Typography variant='h4' color='primary.main' className='mbe-1'>
          {formatPKR(ownSales)}
        </Typography>
      </>
    )
  }, [canLoadFieldSales, d, mrepSalesLoading, mrepSalesRows, mrepScopeTp, mrepPersonalTp, user?._id])

  const sub = useMemo(() => {
    if (canLoadFieldSales && mrepSalesLoading && !mrepSalesRows.length) {
      return 'Loading this month’s field sales…'
    }
    if (d.canSeeCompanyFinancials && d.canLoadDashboardKpis && (d.kpiLoading || d.bundleLoading) && !d.kpi) {
      return 'Loading this month’s sales…'
    }
    return summary
  }, [canLoadFieldSales, d, mrepSalesLoading, mrepSalesRows.length, summary])

  return (
    <DashboardWelcomeColumn
      greeting={greeting}
      name={user?.name || 'Team'}
      summary={sub}
      highlight={fieldSalesHighlight ?? highlight}
    />
  )
}
