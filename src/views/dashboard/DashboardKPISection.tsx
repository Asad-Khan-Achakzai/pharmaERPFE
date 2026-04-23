'use client'

import { memo } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import KPIGroup from './KPIGroup'
import SectionHeader from './SectionHeader'

const DashboardKPISection = memo(function DashboardKPISection({
  dashboardDataLoading,
  loadError,
  data
}: {
  dashboardDataLoading: boolean
  loadError: boolean
  data: any
}) {
  const formatPKR = (v: number) =>
    `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const groups = data
    ? [
        {
          title: 'Revenue',
          value: formatPKR(data.totalSales),
          helper: 'Total sales recorded for current snapshot',
          icon: 'tabler-chart-line',
          tone: 'primary' as const
        },
        {
          title: 'Profit',
          value: formatPKR(data.netProfit),
          helper: `Gross ${formatPKR(data.grossProfit)} after costs`,
          icon: 'tabler-trending-up',
          tone: (data.netProfit || 0) >= 0 ? ('success' as const) : ('error' as const)
        },
        {
          title: 'Cashflow',
          value: formatPKR(data.totalPaid),
          helper: 'Collections already received',
          icon: 'tabler-cash',
          tone: 'info' as const
        },
        {
          title: 'Payables',
          value: formatPKR(data.totalOutstanding),
          helper: `Expenses ${formatPKR(data.totalExpenses)}`,
          icon: 'tabler-alert-circle',
          tone: 'warning' as const
        }
      ]
    : []

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <SectionHeader
              title='Executive summary'
              subtitle='Key financial snapshot. Values come from the same dashboard data as the rest of the app.'
            />
            {dashboardDataLoading ? (
              <Grid container spacing={3}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Grid key={`kpi-skel-${i}`} size={{ xs: 12, sm: 6, lg: 3 }}>
                    <Card variant='outlined' sx={{ borderRadius: 3 }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Skeleton variant='rounded' width={90} height={24} animation='wave' />
                        <Skeleton variant='text' width='70%' height={44} animation='wave' />
                        <Skeleton variant='text' width='100%' height={22} animation='wave' />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : loadError || !data ? (
              <Typography color='error'>Summary metrics could not be loaded.</Typography>
            ) : (
              <>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <Grid container spacing={3}>
                    {groups.map(group => (
                      <Grid key={group.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <KPIGroup {...group} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
                <Box
                  className='-mx-1'
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    gap: 2,
                    overflowX: 'auto',
                    py: 0.5,
                    px: 0.5,
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarGutter: 'stable',
                    '& > *': {
                      scrollSnapAlign: 'start',
                      flex: '0 0 auto',
                      width: { xs: 'min(100%, 300px)', sm: 280 }
                    }
                  }}
                >
                  {groups.map(group => (
                    <Box key={group.title}>
                      <KPIGroup {...group} />
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>
    </>
  )
})

export default DashboardKPISection
