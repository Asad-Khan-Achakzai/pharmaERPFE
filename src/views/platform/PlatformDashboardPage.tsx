'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'

import { platformService } from '@/services/platform.service'
import { showApiError } from '@/utils/apiErrors'
import type { PlatformCompanyRow, PlatformDashboardPayload, PlatformTotals } from '@/types/platformDashboard'
import PlatformKpiRow from './PlatformKpiRow'
import PlatformFilterToolbar, { type RevenueViewMode } from './PlatformFilterToolbar'
import PlatformCompareTable from './PlatformCompareTable'
import PlatformDrilldownCards from './PlatformDrilldownCards'
import PlatformChartsBlock from './PlatformChartsBlock'

const rangeText = (d: 7 | 30 | 90) => `Last ${d} days`

const zTotals = (): PlatformTotals => ({
  revenue: 0,
  orders: 0,
  receivablesFromPharmacy: 0,
  distributorOwedToCompany: 0,
  companiesCount: 0
})

const PlatformDashboardPage = () => {
  const [data, setData] = useState<PlatformDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [revenueViewMode, setRevenueViewMode] = useState<RevenueViewMode>('total')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const { data: body } = await platformService.dashboard({ days })
      const p = (body as { data: PlatformDashboardPayload }).data
      setData(p)
      setSelectedIds(cur => {
        if (!p.companies.length) return []
        const valid = new Set(p.companies.map(c => c.companyId))
        if (!cur.length) return p.companies.map(c => c.companyId)
        const next = cur.filter(id => valid.has(id))
        return next.length ? next : p.companies.map(c => c.companyId)
      })
    } catch (e) {
      setErr('Could not load platform dashboard.')
      showApiError(e, 'Failed to load platform dashboard')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [days, load])

  const filtered: PlatformCompanyRow[] = useMemo(() => {
    if (!data?.companies) return []
    const set = new Set(selectedIds)
    return data.companies.filter(c => set.has(c.companyId))
  }, [data, selectedIds])

  const { totalsKpi, previousKpi } = useMemo(() => {
    if (!filtered.length) {
      return { totalsKpi: null as null | PlatformTotals, previousKpi: { revenue: 0, orders: 0 } }
    }
    const t: PlatformTotals = {
      revenue: 0,
      orders: 0,
      receivablesFromPharmacy: 0,
      distributorOwedToCompany: 0,
      companiesCount: filtered.length
    }
    const p = { revenue: 0, orders: 0 }
    for (const c of filtered) {
      t.revenue += c.period.revenue
      t.orders += c.period.orders
      t.receivablesFromPharmacy += c.period.receivablesFromPharmacy
      t.distributorOwedToCompany += c.period.distributorOwedToCompany
      p.revenue += c.previous.revenue
      p.orders += c.previous.orders
    }
    return { totalsKpi: t, previousKpi: p }
  }, [filtered])

  const dayTotals = useMemo(() => {
    if (!data?.revenueByDay?.dates) return []
    return data.revenueByDay.dates.map((_, i) =>
      selectedIds.reduce((s, id) => s + (data.revenueByDay.byCompany[id]?.[i] || 0), 0)
    )
  }, [data, selectedIds])

  const top5ByRevenue = useMemo(
    () => [...filtered].sort((a, b) => b.period.revenue - a.period.revenue).slice(0, 5),
    [filtered]
  )

  const companyOptions = useMemo(
    () => (data?.companies || []).map(c => ({ id: c.companyId, label: c.city ? `${c.name} — ${c.city}` : c.name })),
    [data]
  )

  const ordersBar = useMemo(
    () => filtered.map(c => ({ name: c.name, orders: c.period.orders })).sort((a, b) => b.orders - a.orders),
    [filtered]
  )

  const mixLabels = useMemo(() => filtered.map(c => c.name), [filtered])
  const mixValues = useMemo(() => filtered.map(c => c.period.revenue), [filtered])

  const exposure = useMemo(() => {
    if (!totalsKpi) return { labels: [] as string[], values: [] as number[] }
    return {
      labels: ['Pharmacy receivables', 'Distributor owed to you'],
      values: [totalsKpi.receivablesFromPharmacy, totalsKpi.distributorOwedToCompany]
    }
  }, [totalsKpi])

  if (loading && !data) {
    return (
      <Grid container spacing={6} component='div' className='p-1'>
        <Grid size={{ xs: 12 }}>
          <Typography variant='h4' className='mbe-2'>
            Platform command center
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }} className='flex flex-wrap gap-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={100} className='flex-1 min-is-[200px] rounded' animation='wave' />
          ))}
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Skeleton variant='rounded' height={360} className='w-full' />
        </Grid>
      </Grid>
    )
  }

  if (err) {
    return (
      <Card>
        <CardContent className='flex flex-col gap-2'>
          <Typography color='error'>{err}</Typography>
          <Button variant='contained' onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data?.companies.length) {
    return (
      <Card variant='outlined' role='status'>
        <CardContent>
          <Typography variant='h5' className='mbe-2'>
            No companies available
          </Typography>
          <Typography color='text.secondary'>
            You do not have access to any company yet, or assignments were revoked. Ask a super admin to grant company
            access in Platform user management.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const t = totalsKpi || zTotals()
  const prev = totalsKpi ? previousKpi : { revenue: 0, orders: 0 }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' className='mbe-1'>
          Platform command center
        </Typography>
        <Typography color='text.secondary' className='mbe-4' component='p'>
          Cross-company performance for the companies you are allowed to see. Data uses platform scope (not your current
          working company context for tenant APIs). Revenue and orders respect the range below; receivables are a live
          snapshot.
        </Typography>
        {data.range && (
          <Alert severity='info' className='mbe-2' role='status'>
            Period: {new Date(data.range.from).toLocaleDateString('en-PK')} — {new Date(data.range.to).toLocaleDateString('en-PK')}{' '}
            (previous window for trend: {new Date(data.range.previousFrom).toLocaleDateString('en-PK')} —{' '}
            {new Date(data.range.previousTo).toLocaleDateString('en-PK')})
          </Alert>
        )}
      </Grid>

      <Grid size={{ xs: 12 }}>
        <PlatformFilterToolbar
          days={days}
          onDaysChange={d => {
            setDays(d)
          }}
          companyOptions={companyOptions}
          selectedIds={selectedIds}
          onSelectedIds={setSelectedIds}
          viewMode={revenueViewMode}
          onViewModeChange={setRevenueViewMode}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <PlatformKpiRow
          totals={t}
          previous={prev}
          loading={loading}
          rangeLabel={rangeText(days)}
        />
      </Grid>

      <Grid size={{ xs: 12 }} component='section' aria-label='Company comparison table'>
        <Typography variant='h5' className='mbe-2'>
          Company comparison
        </Typography>
        <Typography color='text.secondary' variant='body2' className='mbe-3' component='p'>
          See who drives revenue, order volume, and where receivables may need follow-up. “Review” flags period-over-period
          drops or high receivables vs sales.
        </Typography>
        {filtered.length ? (
          <PlatformCompareTable rows={filtered} rangeLabel={rangeText(days)} />
        ) : (
          <Typography color='text.secondary'>Select at least one company in the filter.</Typography>
        )}
      </Grid>

      {selectedIds.length > 0 && data.revenueByDay.dates.length > 0 ? (
        <Grid size={{ xs: 12 }}>
          <PlatformChartsBlock
            dates={data.revenueByDay.dates}
            dayTotals={dayTotals}
            byCompany={data.revenueByDay.byCompany}
            viewMode={revenueViewMode}
            topCompanies={top5ByRevenue}
            ordersBar={ordersBar}
            mixLabels={mixLabels}
            mixValues={mixValues}
            exposureLabels={exposure.labels}
            exposureValues={exposure.values}
          />
        </Grid>
      ) : null}

      <Grid size={{ xs: 12 }} component='section' aria-label='Company drilldown'>
        <Typography variant='h5' className='mbe-2'>
          Company focus
        </Typography>
        {filtered.length ? <PlatformDrilldownCards rows={filtered} rangeLabel={rangeText(days)} /> : null}
      </Grid>
    </Grid>
  )
}

export default PlatformDashboardPage
