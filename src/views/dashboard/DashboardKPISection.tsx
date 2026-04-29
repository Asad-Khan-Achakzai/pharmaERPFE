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
import { FIN_LABELS, FIN_TOOLTIPS } from '@/constants/financialLabels'

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
          title: FIN_LABELS.grossSalesTpCumulative,
          value: formatPKR(data.totalGrossSalesTp ?? 0),
          helper: 'Sum of delivery TP subtotals (see Statistics tooltip).',
          icon: 'tabler-currency-dollar',
          tone: 'primary' as const
        },
        {
          title: FIN_LABELS.netSalesCompanyCumulative,
          value: formatPKR(data.totalNetSalesCompany ?? 0),
          helper: FIN_TOOLTIPS.customerVsCompany,
          icon: 'tabler-building-store',
          tone: 'primary' as const
        },
        {
          title: FIN_LABELS.netSalesCustomerCumulative,
          value: formatPKR(data.totalSales),
          helper: 'Posted sale/return transactions (pharmacy net).',
          icon: 'tabler-receipt',
          tone: 'info' as const
        },
        {
          title: FIN_LABELS.netProfitLifetime,
          value: formatPKR(data.netProfit),
          helper: `${FIN_LABELS.salesMarginCustomerBasis} (cumulative): ${formatPKR(data.grossProfit)}; ${FIN_TOOLTIPS.netProfitLifetime}`,
          icon: 'tabler-trending-up',
          tone: (data.netProfit || 0) >= 0 ? ('success' as const) : ('error' as const)
        },
        {
          title: FIN_LABELS.collectedLifetime,
          value: formatPKR(data.totalPaid),
          helper: 'Sum of recorded collection amounts',
          icon: 'tabler-cash',
          tone: 'info' as const
        },
        {
          title: FIN_LABELS.outstandingPharmacies,
          value: formatPKR(data.totalOutstanding),
          helper: `Net pharmacy ledger balance. Operating expenses (non-salary) total ${formatPKR(data.totalExpenses)}.`,
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
              subtitle='All-time KPIs from /reports/dashboard (not month-scoped). Aligns with Statistics when the same bundle loads.'
            />
            {dashboardDataLoading ? (
              <Grid container spacing={3}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Grid key={`kpi-skel-${i}`} size={{ xs: 12, sm: 6, lg: 4 }}>
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
                      <Grid key={group.title} size={{ xs: 12, sm: 6, lg: 4 }}>
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
