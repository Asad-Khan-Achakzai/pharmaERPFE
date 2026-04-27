'use client'

import type { ReactNode } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { PlatformTotals } from '@/types/platformDashboard'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const Trend = ({ current, previous }: { current: number; previous: number }) => {
  const theme = useTheme()
  if (previous === 0 && current === 0) {
    return (
      <Typography component='span' variant='caption' color='text.secondary' aria-label='No prior period to compare'>
        vs prior: —
      </Typography>
    )
  }
  const delta = previous === 0 ? 100 : ((current - previous) / previous) * 100
  const up = delta >= 0
  return (
    <Typography
      component='span'
      variant='caption'
      sx={{ color: up ? theme.palette.success.main : theme.palette.error.main }}
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(delta).toFixed(0)} percent versus previous period`}
    >
      {up ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% vs prior
    </Typography>
  )
}

type KpiCardProps = {
  label: string
  value: ReactNode
  sub?: ReactNode
  hint?: string
  loading?: boolean
  /** Region label for a11y */
  region: string
}

const KpiCard = ({ label, value, sub, hint, loading, region }: KpiCardProps) => (
  <Card
    variant='outlined'
    className='overflow-hidden h-full'
    elevation={0}
    sx={th => ({
      borderColor: 'var(--mui-palette-divider)',
      boxShadow: th.shadows[0],
      transition: th.transitions.create(['box-shadow', 'transform'], { duration: th.transitions.duration.shorter }),
      '&:hover': { boxShadow: th.shadows[2], transform: 'translateY(-1px)' }
    })}
  >
    <CardContent>
      {loading ? (
        <Skeleton width='60%' height={32} className='mbe-2' />
      ) : (
        <Tooltip title={hint || ''} enterDelay={400} disableHoverListener={!hint}>
          <Typography
            role='status'
            variant='h5'
            className='font-semibold mbe-1'
            aria-label={region}
            sx={th => ({ color: th.palette.text.primary })}
          >
            {value}
          </Typography>
        </Tooltip>
      )}
      {loading ? (
        <Skeleton width='40%' height={20} />
      ) : (
        <Typography variant='body2' color='text.secondary' component='p'>
          {label}
        </Typography>
      )}
      {sub && !loading ? (
        <Typography variant='caption' color='text.secondary' display='block' className='mbs-2'>
          {sub}
        </Typography>
      ) : null}
    </CardContent>
  </Card>
)

type PlatformKpiRowProps = {
  totals: PlatformTotals
  previous: { revenue: number; orders: number }
  loading?: boolean
  rangeLabel: string
}

const PlatformKpiRow = ({ totals, previous, loading, rangeLabel }: PlatformKpiRowProps) => {
  return (
    <Grid
      container
      spacing={3}
      component='section'
      role='region'
      aria-label='Platform key performance indicators'
    >
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard
          region={`Total revenue ${formatPKR(totals.revenue)} in ${rangeLabel}`}
          label={`Revenue — ${rangeLabel}`}
          value={formatPKR(totals.revenue)}
          sub={<Trend current={totals.revenue} previous={previous.revenue} />}
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard
          region={`Total orders ${totals.orders} in ${rangeLabel}`}
          label={`Orders — ${rangeLabel}`}
          value={totals.orders.toLocaleString('en-PK')}
          sub={<Trend current={totals.orders} previous={previous.orders} />}
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard
          region='Pharmacy receivables and distributor clearing snapshot'
          label='Outstanding (snapshot)'
          value={
            <span>
              {formatPKR(totals.receivablesFromPharmacy + totals.distributorOwedToCompany)}
            </span>
          }
          hint='Sum of pharmacy receivables and positive distributor clearing (owed to you). Point-in-time, not in the date range.'
          sub={
            <span>
              <Typography component='span' variant='caption' display='block' color='text.secondary'>
                Receivables: {formatPKR(totals.receivablesFromPharmacy)}
              </Typography>
              <Typography component='span' variant='caption' display='block' color='text.secondary'>
                Distr. due (owes you): {formatPKR(totals.distributorOwedToCompany)}
              </Typography>
            </span>
          }
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <KpiCard
          region={`${totals.companiesCount} companies in view`}
          label='Companies in view'
          value={String(totals.companiesCount)}
          sub={
            <Typography variant='caption' color='text.secondary'>
              Filter companies below to focus comparisons
            </Typography>
          }
          loading={loading}
        />
      </Grid>
    </Grid>
  )
}

export default PlatformKpiRow
export { formatPKR }
