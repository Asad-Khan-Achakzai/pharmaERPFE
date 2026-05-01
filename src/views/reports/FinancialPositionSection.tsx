'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import type { ApexOptions } from 'apexcharts'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import CardSkeleton from '@/components/skeletons/CardSkeleton'

let financialPositionCache: { summary: any; flow: any } | null = null

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Short labels + info icon; tooltip copy is plain language for all users. */
const MetricLabelWithHint = ({ label, hint }: { label: string; hint: ReactNode }) => (
  <Box className='flex items-center gap-0.5 flex-wrap' sx={{ minHeight: 24 }}>
    <Typography variant='body2' color='text.secondary' component='span'>
      {label}
    </Typography>
    <Tooltip
      title={hint}
      placement='top'
      arrow
      enterTouchDelay={0}
      slotProps={{ tooltip: { sx: { maxWidth: 320, typography: 'body2', lineHeight: 1.5 } } }}
    >
      <IconButton
        type='button'
        size='small'
        aria-label={`${label} — more detail`}
        sx={{ p: 0.25, color: 'text.secondary' }}
      >
        <i className='tabler-info-circle' style={{ fontSize: 18, lineHeight: 1, display: 'block' }} />
      </IconButton>
    </Tooltip>
  </Box>
)

const FP_TOOLTIPS = {
  companyCashFlow: (
    <>
      Company-only cash movements: includes distributor remittances received, minus settlements paid to
      distributors, supplier payments, and expenses, starting from opening balance.
    </>
  ),
  ecosystemCashFlow: (
    <>
      System-wide movement including pharmacy-to-distributor collections. This may double count flows and
      does not represent actual company cash in hand.
    </>
  ),
  openingLine: (
    <>
      <strong>Opening</strong> is the amount someone put in as your <strong>starting</strong> cash in this
      system. The big number above uses this as a starting line, then moves it up and down with later
      activity (collections, spending, and so on).
    </>
  ),
  pharmacyRec: (
    <>
      This is <strong>money that shops (pharmacies) still have to pay you</strong> for what they already
      took. They owe you; you are waiting to get this cash or bank transfer. It is not in your hand yet,
      but it is yours in principle.
    </>
  ),
  supplierPay: (
    <>
      This is <strong>money you still need to pay your suppliers</strong> (who send you products). The stock
      or bill may already be with you, but the payment is not finished yet. Think of it as a bill you still
      have to pay.
    </>
  ),
  distributorPay: (
    <>
      This is <strong>money you still owe to distributors</strong>—for example their part of the sale, work,
      or commission that this system has not marked as fully paid to them yet. It is a debt of the company
      to the distributor.
    </>
  ),
  netPosition: (
    <>
      This is <strong>one number that sums up the picture in simple terms</strong>. We add your implied cash
      and what pharmacies still owe you, then we take away what you still owe to suppliers and to
      distributors. If the result is <strong>high and positive</strong>, your side of the money looks
      strong; if it is <strong>low or negative</strong>, you owe more out than is clearly “with you” in this
      view.
    </>
  )
} as const

/** Stretch cards to match the tallest item in each Grid row */
const metricGridSx = { display: 'flex' } as const
const metricCardSx = {
  flex: 1,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0
} as const
const metricCardContentSx = { flex: 1 } as const

const FinancialPositionSection = () => {
  const { user } = useAuth()
  const canEditCashOpening = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const [loading, setLoading] = useState(!financialPositionCache)
  const [flowLoading, setFlowLoading] = useState(!financialPositionCache)
  const [summary, setSummary] = useState<any>(financialPositionCache?.summary ?? null)
  const [flow, setFlow] = useState<any>(financialPositionCache?.flow ?? null)
  const [cashInput, setCashInput] = useState('')
  const [savingCash, setSavingCash] = useState(false)

  const loadData = useCallback(async () => {
    const hasCache = Boolean(financialPositionCache)
    if (!hasCache) {
      setLoading(true)
      setFlowLoading(true)
    }
    try {
      const [summaryRes, flowRes] = await Promise.all([
        reportsService.financialSummary(),
        reportsService.financialFlowMonthly({ months: 12 })
      ])
      const next = { summary: summaryRes.data.data, flow: flowRes.data.data }
      financialPositionCache = next
      setSummary(next.summary)
      setFlow(next.flow)
      setCashInput(String(next.summary?.cashOpeningBalance ?? 0))
    } catch (e) {
      showApiError(e, 'Failed to load financial position')
    } finally {
      setLoading(false)
      setFlowLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveCashOpening = async () => {
    const n = parseFloat(cashInput)
    if (Number.isNaN(n)) {
      showApiError(null, 'Enter a valid number')
      return
    }
    setSavingCash(true)
    try {
      await reportsService.patchCompanyCashOpening({ cashOpeningBalance: n })
      showSuccess('Cash opening balance saved')
      await loadData()
    } catch (e) {
      showApiError(e, 'Failed to update')
    } finally {
      setSavingCash(false)
    }
  }

  const lineOptions: ApexOptions = useMemo(() => {
    const series = flow?.series || []
    const cats = series.map((x: any) => x.month)
    return {
      chart: { toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { width: 2, curve: 'smooth' },
      dataLabels: { enabled: false },
      xaxis: { categories: cats },
      yaxis: { labels: { formatter: (v: number) => formatPKR(v) } },
      tooltip: { y: { formatter: (v: number) => formatPKR(v) } },
      legend: { position: 'top' }
    }
  }, [flow])

  const lineSeries = useMemo(() => {
    const series = flow?.series || []
    const hasCompanyFlow = series.some((x: any) => x?.companyInflow != null || x?.companyOutflow != null)
    return [
      {
        name: hasCompanyFlow ? 'Company inflow' : 'Inflow',
        data: series.map((x: any) => (hasCompanyFlow ? (x.companyInflow ?? x.inflow ?? 0) : (x.inflow ?? 0)))
      },
      {
        name: hasCompanyFlow ? 'Company outflow' : 'Outflow',
        data: series.map((x: any) => (hasCompanyFlow ? (x.companyOutflow ?? x.outflow ?? 0) : (x.outflow ?? 0)))
      }
    ]
  }, [flow])

  const barOptions: ApexOptions = useMemo(() => {
    const s = summary
    if (!s) return { chart: { type: 'bar' } }
    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Pharmacy receivable', 'Supplier payable', 'Distributor payable']
      },
      yaxis: { labels: { formatter: (v: number) => formatPKR(v) } },
      tooltip: { y: { formatter: (v: number) => formatPKR(v) } },
      colors: ['#2e7d32', '#c62828', '#1565c0']
    }
  }, [summary])

  const barSeries = useMemo(() => {
    if (!summary) return [{ name: 'Amount', data: [0, 0, 0] }]
    return [
      {
        name: 'PKR',
        data: [
          summary.totalPharmacyReceivable ?? 0,
          Math.max(0, summary.totalSupplierPayable ?? 0),
          summary.totalDistributorPayable ?? 0
        ]
      }
    ]
  }, [summary])

  if (loading && !summary) {
    return (
      <Grid size={{ xs: 12 }}>
        <CardSkeleton rows={6} />
      </Grid>
    )
  }

  return (
    <Grid container spacing={4} sx={{ alignItems: 'stretch' }}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='body2' color='text.secondary' className='mbe-2'>
          Company cash flow is the primary KPI. Ecosystem cash flow keeps legacy system-wide movement
          logic for continuity. Supplier <strong>PURCHASE</strong> lines affect payables only, not PnL.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={{ ...metricCardSx, border: theme => `1px solid ${theme.palette.success.main}` }}>
          <CardContent sx={metricCardContentSx}>
            <MetricLabelWithHint label='Company Cash Flow (Derived)' hint={FP_TOOLTIPS.companyCashFlow} />
            <Typography variant='h5' color='success.main' sx={{ mt: 0.5 }}>
              {formatPKR(summary?.companyCashFlow ?? summary?.cashBalance ?? 0)}
            </Typography>
            <Box
              className='mts-2 flex items-center flex-wrap gap-0.5'
              sx={{ color: 'text.secondary', typography: 'caption' }}
            >
              <span>Opening</span>
              <Tooltip
                title={FP_TOOLTIPS.openingLine}
                placement='top'
                arrow
                enterTouchDelay={0}
                slotProps={{ tooltip: { sx: { maxWidth: 300, typography: 'body2', lineHeight: 1.5 } } }}
              >
                <IconButton
                  type='button'
                  size='small'
                  aria-label='Opening cash — more detail'
                  sx={{ p: 0, color: 'text.secondary' }}
                >
                  <i className='tabler-info-circle' style={{ fontSize: 15, lineHeight: 1, display: 'block' }} />
                </IconButton>
              </Tooltip>
              <span>: {formatPKR(summary?.cashOpeningBalance ?? 0)}</span>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {summary?.companyCashFlow != null ? (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
          <Card sx={{ ...metricCardSx, opacity: 0.92 }}>
            <CardContent sx={metricCardContentSx}>
              <MetricLabelWithHint label='Ecosystem Cash Flow (Derived)' hint={FP_TOOLTIPS.ecosystemCashFlow} />
              <Typography variant='h5' sx={{ mt: 0.5 }}>
                {formatPKR(summary?.ecosystemCashFlow ?? summary?.cashBalance ?? 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ) : null}
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <MetricLabelWithHint label='Pharmacy receivables' hint={FP_TOOLTIPS.pharmacyRec} />
            <Typography variant='h5' color='success.main' sx={{ mt: 0.5 }}>
              {formatPKR(summary?.totalPharmacyReceivable ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <MetricLabelWithHint label='Supplier payables' hint={FP_TOOLTIPS.supplierPay} />
            <Typography variant='h5' color='warning.main' sx={{ mt: 0.5 }}>
              {formatPKR(summary?.totalSupplierPayable ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <MetricLabelWithHint label='Distributor commission payable' hint={FP_TOOLTIPS.distributorPay} />
            <Typography variant='h5' color='info.main' sx={{ mt: 0.5 }}>
              {formatPKR(summary?.totalDistributorPayable ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <MetricLabelWithHint label='Net position' hint={FP_TOOLTIPS.netPosition} />
            <Typography variant='h5' color={summary?.netPosition >= 0 ? 'success.main' : 'error.main'} sx={{ mt: 0.5 }}>
              {formatPKR(summary?.netPosition ?? 0)}
            </Typography>
            <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
              Simplified total from the items above. It is a guide, not a full bank report.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {canEditCashOpening && (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant='outlined'>
            <CardHeader title='Cash opening balance' subheader='Set starting bank/cash before tracked movements' titleTypographyProps={{ variant: 'subtitle1' }} />
            <CardContent className='flex flex-wrap gap-2 items-end'>
              <TextField
                size='small'
                label='PKR'
                type='number'
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
              />
              <Button size='small' variant='contained' onClick={saveCashOpening} disabled={savingCash}>
                {savingCash ? 'Saving...' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Keep both charts on a dedicated next row, separate from KPI cards */}
      <Grid size={{ xs: 12 }} />

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Company Cash Flow (Derived) — inflow vs outflow (12 months)' />
          <CardContent>
            {flowLoading ? (
              <Skeleton variant='rounded' width='100%' height={320} animation='wave' />
            ) : (
              <AppReactApexCharts type='line' height={320} options={lineOptions} series={lineSeries} />
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Receivable vs payables (snapshot)' />
          <CardContent>
            <AppReactApexCharts type='bar' height={320} options={barOptions} series={barSeries} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default FinancialPositionSection
