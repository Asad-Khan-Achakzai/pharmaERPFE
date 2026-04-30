'use client'

import { memo, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import classnames from 'classnames'
import CustomAvatar from '@core/components/mui/Avatar'
import type { ThemeColor } from '@core/types'
import { alpha, useTheme } from '@mui/material/styles'
import { FIN_TOOLTIPS } from '@/constants/financialLabels'
import { FinInfoTip } from '@/components/financial/FinInfoTip'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type StatItem = {
  label: string
  stats: string
  icon: string
  color: ThemeColor
  tooltip?: string
}

function StatRow({ item }: { item: StatItem }) {
  return (
    <Stack direction='row' alignItems='center' spacing={1.75} sx={{ py: 1.25 }}>
      <CustomAvatar color={item.color} variant='rounded' size={40} skin='light'>
        <i className={classnames(item.icon, 'text-xl')} />
      </CustomAvatar>
      <div className='min-is-0 flex-1'>
        <Typography
          variant='h6'
          sx={{
            fontWeight: 700,
            fontSize: { xs: '0.95rem', sm: '1.02rem' },
            lineHeight: 1.25,
            letterSpacing: '-0.02em'
          }}
          color='text.primary'
        >
          {item.stats}
        </Typography>
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ fontSize: '0.78rem', lineHeight: 1.35, mt: 0.2 }}
          className='inline-flex items-center gap-1 flex-wrap'
        >
          {item.label}
          {item.tooltip ? <FinInfoTip title={item.tooltip} /> : null}
        </Typography>
      </div>
    </Stack>
  )
}

type PanelProps = {
  title: string
  titleColor: 'primary' | 'success' | 'text.secondary'
  items: StatItem[]
}

function MetricPanel({ title, titleColor, items }: PanelProps) {
  const theme = useTheme()
  const accent =
    titleColor === 'primary'
      ? theme.palette.primary.main
      : titleColor === 'success'
        ? theme.palette.success.main
        : theme.palette.text.secondary

  return (
    <Paper
      variant='outlined'
      sx={{
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 'none',
        borderLeft: 3,
        borderLeftColor: 'divider'
      }}
    >
      <Box sx={{ px: 2, pt: 1.75, pb: 0.5 }}>
        <Typography
          variant='overline'
          sx={{ color: accent, letterSpacing: 0.55, display: 'block', mb: 1, fontSize: '0.68rem' }}
        >
          {title}
        </Typography>
      </Box>
      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider', mx: 2 }} />} sx={{ px: 2, pb: 1.5 }}>
        {items.map((item, index) => (
          <StatRow key={index} item={item} />
        ))}
      </Stack>
    </Paper>
  )
}

/**
 * Company-wide dashboard KPIs (`admin.access` only). Data from GET /reports/dashboard (same month as greeting when range is passed).
 */
const DashboardSnapshotKpis = memo(function DashboardSnapshotKpis({
  dashboardDataLoading,
  loadError,
  data,
  mobileCompact: _mobileCompact
}: {
  dashboardDataLoading: boolean
  loadError: boolean
  data: any
  mobileCompact?: boolean
}) {
  const period = data?.period as { from: string; to: string } | undefined
  const hasPeriod = Boolean(period?.from && period?.to)

  const salesStats: StatItem[] = useMemo(() => {
    if (!data) return []
    return [
      {
        label: 'Gross sales (TP)',
        stats: formatPKR(data.totalGrossSalesTp ?? 0),
        icon: 'tabler-currency-dollar',
        color: 'primary',
        tooltip: FIN_TOOLTIPS.dashboardTotals
      },
      {
        label: 'Net sales · Company',
        stats: formatPKR(data.totalNetSalesCompany ?? 0),
        icon: 'tabler-building-store',
        color: 'primary',
        tooltip: FIN_TOOLTIPS.customerVsCompany
      },
      {
        label: 'Net sales · Customer',
        stats: formatPKR(data.totalSales ?? 0),
        icon: 'tabler-receipt',
        color: 'info',
        tooltip: FIN_TOOLTIPS.customerVsCompany
      }
    ]
  }, [data])

  const profitStats: StatItem[] = useMemo(() => {
    if (!data) return []
    const sm = Number(data.grossProfit ?? 0)
    const np = Number(data.netProfit ?? 0)
    return [
      {
        label: hasPeriod ? 'Sales margin (period)' : 'Sales margin (customer basis)',
        stats: formatPKR(sm),
        icon: 'tabler-chart-arcs',
        color: sm >= 0 ? 'success' : 'error',
        tooltip: FIN_TOOLTIPS.salesMarginCustomerBasis
      },
      {
        label: hasPeriod ? 'Net profit (period)' : 'Net profit (lifetime)',
        stats: formatPKR(np),
        icon: 'tabler-coin',
        color: np >= 0 ? 'success' : 'error',
        tooltip: FIN_TOOLTIPS.netProfitLifetime
      }
    ]
  }, [data, hasPeriod])

  const cashStats: StatItem[] = useMemo(() => {
    if (!data) return []
    return [
      {
        label: 'Collected',
        stats: formatPKR(data.totalPaid ?? 0),
        icon: 'tabler-cash',
        color: 'info'
      },
      {
        label: 'Outstanding (pharmacies)',
        stats: formatPKR(data.totalOutstanding ?? 0),
        icon: 'tabler-alert-circle',
        color: 'warning'
      }
    ]
  }, [data])

  const subheader = useMemo(() => {
    if (hasPeriod) return `Company · ${period!.from} → ${period!.to}`
    return 'Company-wide lifetime totals'
  }, [hasPeriod, period])

  if (dashboardDataLoading) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardHeader title='Statistics' subheader='Loading…' />
        <CardContent sx={{ p: 2.5, pt: 0 }}>
          <Grid container spacing={2}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, md: 4 }}>
                <Skeleton variant='rounded' width='100%' height={180} />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    )
  }

  if (loadError || !data || data.dashboardScope === 'self') {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardContent>
          <Typography color='error' variant='body2'>
            {data?.dashboardScope === 'self'
              ? 'Company statistics are not available in this view.'
              : 'Summary metrics could not be loaded.'}
          </Typography>
        </CardContent>
    </Card>
    )
  }

  return (
    <Card sx={{ boxShadow: 'var(--shadow-xs)' }} className='h-full flex flex-col'>
      <CardHeader
        title={
          <Box className='flex items-center gap-1'>
            <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
              Statistics
            </Typography>
            <FinInfoTip title={FIN_TOOLTIPS.dashboardTotals} />
          </Box>
        }
        subheader={
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
            {subheader}
          </Typography>
        }
        action={
          <Typography variant='caption' color='text.disabled' sx={{ whiteSpace: 'nowrap' }}>
            Live
          </Typography>
        }
        sx={{ px: { xs: 2, sm: 2.5 }, pt: { xs: 2, sm: 2.25 }, pb: 0, '& .MuiCardHeader-subheader': { mt: 0 } }}
      />
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          pt: 1,
          '&:last-of-type': { pb: { xs: 2, sm: 2.5 } }
        }}
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricPanel title='Sales' titleColor='primary' items={salesStats} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricPanel title='Profit' titleColor='success' items={profitStats} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <MetricPanel title='Receivables' titleColor='text.secondary' items={cashStats} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
})

export default DashboardSnapshotKpis
