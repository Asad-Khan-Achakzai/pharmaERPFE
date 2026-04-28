'use client'

import { memo, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Divider from '@mui/material/Divider'
import classnames from 'classnames'
import CustomAvatar from '@core/components/mui/Avatar'
import type { ThemeColor } from '@core/types'
import DashboardMiniLineKpi from './DashboardMiniLineKpi'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type StatItem = { title: string; stats: string; icon: string; color: ThemeColor }

/**
 * Ecommerce `StatisticsCard` (4 avatars) + 3× `LineChartProfit`-style minis, driven by the same `dashboard` payload.
 */
const DashboardSnapshotKpis = memo(function DashboardSnapshotKpis({
  dashboardDataLoading,
  loadError,
  data,
  /** Mobile: show at most 2 hero stat cards and fold mini line charts to save vertical space. */
  mobileCompact
}: {
  dashboardDataLoading: boolean
  loadError: boolean
  data: any
  mobileCompact?: boolean
}) {
  const statItems: StatItem[] = useMemo(() => {
    if (!data) return []
    return [
      { title: 'Total sales', stats: formatPKR(data.totalSales), icon: 'tabler-chart-line', color: 'primary' },
      { title: 'Net profit', stats: formatPKR(data.netProfit), icon: 'tabler-coin', color: (data.netProfit || 0) >= 0 ? 'success' : 'error' },
      { title: 'Collected', stats: formatPKR(data.totalPaid), icon: 'tabler-cash', color: 'info' },
      { title: 'Outstanding', stats: formatPKR(data.totalOutstanding), icon: 'tabler-alert-circle', color: 'warning' }
    ]
  }, [data])

  const marginHint = useMemo(() => {
    if (!data) return '—'
    const ts = Number(data.totalSales || 0)
    const net = Number(data.netProfit || 0)
    if (ts > 0) return `Net margin ${((net / ts) * 100).toFixed(1)}%`
    return 'Margin N/A'
  }, [data])

  const payablesHint = useMemo(() => {
    if (!data) return '—'
    const paid = Number(data.totalPaid || 0)
    const out = Number(data.totalOutstanding || 0)
    const t = paid + out
    if (t > 0) return `Payables ${((out / t) * 100).toFixed(0)}% of AR+OS`
    return 'Payables'
  }, [data])

  if (dashboardDataLoading) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardHeader title='Statistics' subheader='Loading…' />
        <CardContent sx={{ p: 3, pt: 0 }}>
          <Grid container spacing={3}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Grid key={i} size={{ xs: 6, sm: 3 }}>
                <Skeleton variant='rounded' width='100%' height={64} />
              </Grid>
            ))}
            {Array.from({ length: 3 }).map((_, i) => (
              <Grid key={`line-${i}`} size={{ xs: 12, sm: 4 }}>
                <Skeleton variant='rounded' width='100%' height={200} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    )
  }

  if (loadError || !data) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardContent>
          <Typography color='error' variant='body2'>
            Summary metrics could not be loaded.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const visibleStats = mobileCompact ? statItems.slice(0, 2) : statItems

  return (
    <Card sx={{ boxShadow: 'var(--shadow-xs)' }} className='h-full flex flex-col'>
      <CardHeader
        title='Statistics'
        subheader='Dashboard snapshot'
        action={
          <Typography variant='subtitle2' color='text.disabled'>
            Live data
          </Typography>
        }
        sx={{ px: { xs: 2.5, sm: 3.5 }, pt: { xs: 2.5, sm: 3 }, pb: 0.5 }}
      />
      <CardContent
        className='flex flex-1 min-is-0 flex-col'
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          pt: 1.5,
          gap: 3.5,
          '&:last-of-type': { pb: { xs: 3, sm: 3.5 } }
        }}
      >
        <div className='min-is-0 w-full'>
          <Grid container rowSpacing={3.5} columnSpacing={2.5} sx={{ width: '100%' }}>
            {visibleStats.map((item, index) => (
              <Grid key={index} size={{ xs: 6, sm: 3 }} className='flex items-center gap-3.5 sm:gap-4'>
                <CustomAvatar color={item.color} variant='rounded' size={44} skin='light'>
                  <i className={classnames(item.icon, 'text-[1.5rem]')} />
                </CustomAvatar>
                <div className='flex min-is-0 flex-col gap-1.5'>
                  <Typography
                    variant='h5'
                    className='text-base sm:text-xl leading-tight'
                    color='text.primary'
                    sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                  >
                    {item.stats}
                  </Typography>
                  <Typography variant='body2' color='text.secondary' className='text-xs sm:text-sm' sx={{ lineHeight: 1.4 }}>
                    {item.title}
                  </Typography>
                </div>
              </Grid>
            ))}
          </Grid>
        </div>

        {mobileCompact ? null : <Divider flexItem className='max-is-full' />}

        {mobileCompact ? null : (
          <Grid container spacing={3} sx={{ width: '100%' }} rowSpacing={2.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <DashboardMiniLineKpi
                title='Revenue'
                subheader='Snapshot'
                valueLabel={formatPKR(data.totalSales)}
                value={Number(data.totalSales) || 0}
                deltaLabel={data.totalExpenses != null ? `Expenses ${formatPKR(data.totalExpenses)}` : '—'}
                colorKey='primary'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <DashboardMiniLineKpi
                title='Net profit'
                subheader='Snapshot'
                valueLabel={formatPKR(data.netProfit)}
                value={Number(data.netProfit) || 0}
                deltaLabel={marginHint}
                colorKey={(data.netProfit || 0) >= 0 ? 'success' : 'error'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <DashboardMiniLineKpi
                title='Cash collected'
                subheader='Snapshot'
                valueLabel={formatPKR(data.totalPaid)}
                value={Number(data.totalPaid) || 0}
                deltaLabel={payablesHint}
                colorKey='info'
              />
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  )
})

export default DashboardSnapshotKpis
