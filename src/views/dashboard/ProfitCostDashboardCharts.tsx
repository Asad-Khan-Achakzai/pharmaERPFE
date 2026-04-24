'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'
import { showApiError } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import { productsService } from '@/services/products.service'
import { distributorsService } from '@/services/distributors.service'
import { usersService } from '@/services/users.service'
import { mapSummaryFinancial, mapTrendsFinancial } from '@/utils/financialMapper'
import Link from 'next/link'
import ResponsiveChartWrapper from './ResponsiveChartWrapper'
import { useExpandedOnDesktop } from '@/hooks/useExpandedOnDesktop'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const defaultRange = () => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: formatYyyyMmDd(start), endDate: formatYyyyMmDd(end) }
}

const truncName = (s: string, max: number) => {
  const t = (s || '—').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

type ProfitCostDashboardChartsProps = {
  deferFetch?: boolean
}

const ProfitCostDashboardCharts = ({ deferFetch = false }: ProfitCostDashboardChartsProps) => {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const { expanded: analyticsAccordionExpanded, onChange: onAnalyticsAccordionChange } = useExpandedOnDesktop()
  const [startDate, setStartDate] = useState(() => defaultRange().startDate)
  const [endDate, setEndDate] = useState(() => defaultRange().endDate)
  const [productId, setProductId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [revBreakdown, setRevBreakdown] = useState<any>(null)
  const [productOptions, setProductOptions] = useState<any[]>([])
  const [distributorOptions, setDistributorOptions] = useState<any[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<any[]>([])
  const [lookupsLoading, setLookupsLoading] = useState(true)

  const params = useMemo(() => {
    const p: Record<string, string> = { startDate, endDate }
    if (productId.trim()) p.productId = productId.trim()
    if (distributorId.trim()) p.distributorId = distributorId.trim()
    if (employeeId.trim()) p.employeeId = employeeId.trim()
    return p
  }, [startDate, endDate, productId, distributorId, employeeId])

  /** Three parallel requests, separate loading — a slow trends query does not block summary KPIs or the donut. */
  const load = useCallback(() => {
    void (async () => {
      setSummaryLoading(true)
      try {
        const sumRes = await reportsService.profitSummary(params)
        setSummary(mapSummaryFinancial(sumRes.data.data))
      } catch (e) {
        showApiError(e, 'Failed to load profit summary')
      } finally {
        setSummaryLoading(false)
      }
    })()
    void (async () => {
      setTrendsLoading(true)
      try {
        const trRes = await reportsService.profitTrends({ ...params, granularity: 'month' })
        setTrends(mapTrendsFinancial(trRes.data.data))
      } catch (e) {
        showApiError(e, 'Failed to load profit trends')
      } finally {
        setTrendsLoading(false)
      }
    })()
    void (async () => {
      setRevenueLoading(true)
      try {
        const revRes = await reportsService.profitRevenue(params)
        setRevBreakdown(revRes.data.data)
      } catch (e) {
        showApiError(e, 'Failed to load product revenue')
      } finally {
        setRevenueLoading(false)
      }
    })()
  }, [params])

  useEffect(() => {
    if (!deferFetch) return
    load()
  }, [deferFetch, load])

  useEffect(() => {
    if (!deferFetch) return
    const fetchLookups = async () => {
      setLookupsLoading(true)
      try {
        const [pr, di, us] = await Promise.all([
          productsService.lookup({ limit: 200 }),
          distributorsService.lookup({ limit: 200 }),
          usersService.assignable()
        ])
        setProductOptions(pr.data.data || [])
        setDistributorOptions(di.data.data || [])
        setEmployeeOptions(us.data.data || [])
      } catch (e) {
        showApiError(e, 'Failed to load filter options')
      } finally {
        setLookupsLoading(false)
      }
    }
    fetchLookups()
  }, [deferFetch])

  const lineOptions: ApexOptions = useMemo(() => {
    const s = trends?.series || []
    const cats = s.map((x: any) => x.period)
    return {
      chart: { toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: { categories: cats, labels: { style: { fontSize: isCompact ? '11px' : '12px' } } },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      legend: {
        position: isCompact ? 'bottom' : 'top',
        fontSize: isCompact ? '12px' : '14px',
        itemMargin: { horizontal: 8, vertical: isCompact ? 4 : 0 }
      },
      colors: ['var(--mui-palette-primary-main)', 'var(--mui-palette-warning-main)', 'var(--mui-palette-success-main)'],
      grid: {
        strokeDashArray: 4,
        borderColor: 'var(--mui-palette-divider)',
        padding: isCompact ? { top: 4, right: 4, bottom: 0, left: 4 } : { top: 8, right: 8, bottom: 0, left: 8 }
      }
    }
  }, [trends, isCompact])

  const lineSeries = useMemo(() => {
    const s = trends?.series || []
    return [
      { name: 'Revenue', data: s.map((x: any) => x.revenue) },
      { name: 'Total cost', data: s.map((x: any) => x.totalCost) },
      { name: 'Net profit', data: s.map((x: any) => x.netProfit) }
    ]
  }, [trends])

  const donutOptions: ApexOptions = useMemo(() => {
    const b = summary?.breakdown
    if (!b) return { labels: [] }
    return {
      labels: ['Product COGS', 'Shipping', 'Payroll', 'Doctor activities', 'Other expenses'],
      chart: { sparkline: { enabled: false } },
      plotOptions: { pie: { donut: { size: isCompact ? '58%' : '65%' } } },
      legend: { position: 'bottom', fontSize: isCompact ? '11px' : '12px' },
      dataLabels: { enabled: !isCompact, style: { fontSize: isCompact ? '10px' : '11px' } },
      colors: [
        'var(--mui-palette-primary-main)',
        'var(--mui-palette-info-main)',
        'var(--mui-palette-secondary-main)',
        'var(--mui-palette-warning-main)',
        'var(--mui-palette-error-main)'
      ]
    }
  }, [summary, isCompact])

  const donutSeries = useMemo(() => {
    const b = summary?.breakdown
    if (!b) return []
    return [b.productCost, b.shippingCost, b.payrollCost, b.doctorActivityCost, b.otherExpenses]
  }, [summary])

  const productRevenueRows = useMemo(() => {
    const n = isCompact ? 6 : 12
    return (revBreakdown?.byProduct || []).slice(0, n)
  }, [revBreakdown, isCompact])

  const topProductsBarHeight = useMemo(() => {
    const c = productRevenueRows.length || 1
    if (isCompact) {
      return Math.max(320, Math.min(560, 56 + c * 54))
    }
    return 380
  }, [productRevenueRows.length, isCompact])

  const barOptions: ApexOptions = useMemo(() => {
    const rows = productRevenueRows
    const nameMax = isCompact ? 16 : 40
    const cats = rows.map((r: any) => truncName(r.productName || '—', nameMax))
    const grid = {
      strokeDashArray: 4,
      borderColor: 'var(--mui-palette-divider)',
      padding: isCompact
        ? { top: 4, right: 4, bottom: 0, left: 2 }
        : { top: 8, right: 12, bottom: 8, left: 12 }
    } as const

    if (isCompact) {
      return {
        chart: { parentHeightOffset: 0, toolbar: { show: false } },
        colors: ['var(--mui-palette-primary-main)'],
        grid,
        dataLabels: { enabled: false },
        plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '78%' } },
        xaxis: {
          categories: cats,
          labels: {
            style: { fontSize: '10px' },
            maxWidth: 100,
            trim: true,
            hideOverlappingLabels: true
          }
        },
        yaxis: {
          labels: {
            maxWidth: 70,
            style: { fontSize: '9px' },
            formatter: (val: number) =>
              `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
          }
        }
      } as ApexOptions
    }

    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: { rotate: -30, style: { fontSize: '11px' } }
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      colors: ['var(--mui-palette-primary-main)'],
      grid
    } as ApexOptions
  }, [productRevenueRows, isCompact])

  const barSeries = useMemo(() => {
    const rows = productRevenueRows
    return [{ name: 'Revenue', data: rows.map((r: any) => r.revenue) }]
  }, [productRevenueRows])

  const formatPKR = (v: number) =>
    `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const lineChartHeight = isCompact ? 300 : 360
  const donutChartHeight = isCompact ? 300 : 360
  /** Slightly shorter in the aside column so the row fits typical viewports. */
  const donutAsideHeight = isCompact ? donutChartHeight : 340

  const marginPct = summary?.profitMarginPercent

  return (
    <Grid size={{ xs: 12 }}>
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardHeader
          title='Revenue vs cost vs profit'
          subheader='Primary executive trend view. Filters apply across analytics.'
          action={
            <Button component={Link} href='/reports' size='small' variant='tonal'>
              Full reports
            </Button>
          }
        />
        <CardContent className='flex flex-col gap-5'>
          <div>
            <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
              Filters
            </Typography>
            {lookupsLoading ? (
              <div className='flex flex-wrap gap-4 items-end'>
                <Skeleton variant='rounded' width={200} height={56} animation='wave' />
                <Skeleton variant='rounded' width={200} height={56} animation='wave' />
                <Skeleton variant='rounded' width={220} height={56} animation='wave' />
                <Skeleton variant='rounded' width={220} height={56} animation='wave' />
                <Skeleton variant='rounded' width={220} height={56} animation='wave' />
                <Skeleton variant='rounded' width={88} height={36} animation='wave' />
              </div>
            ) : (
              <div className='flex flex-wrap gap-4 items-end'>
                <AppReactDatepicker
                  selected={parseYyyyMmDd(startDate) ?? null}
                  id='dash-pl-start'
                  dateFormat='yyyy-MM-dd'
                  onChange={(d: Date | null) => setStartDate(d ? formatYyyyMmDd(d) : '')}
                  placeholderText='Start'
                  customInput={<CustomTextField label='Start' sx={{ minWidth: 200 }} />}
                />
                <AppReactDatepicker
                  selected={parseYyyyMmDd(endDate) ?? null}
                  id='dash-pl-end'
                  dateFormat='yyyy-MM-dd'
                  onChange={(d: Date | null) => setEndDate(d ? formatYyyyMmDd(d) : '')}
                  placeholderText='End'
                  customInput={<CustomTextField label='End' sx={{ minWidth: 200 }} />}
                />
                <CustomTextField
                  select
                  label='Product'
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=''>All products</MenuItem>
                  {productOptions.map((p: any) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  label='Distributor'
                  value={distributorId}
                  onChange={e => setDistributorId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=''>All distributors</MenuItem>
                  {distributorOptions.map((d: any) => (
                    <MenuItem key={d._id} value={d._id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  label='Employee (payroll filter)'
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=''>All employees</MenuItem>
                  {employeeOptions.map((u: any) => (
                    <MenuItem key={u._id} value={u._id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <Button
                  variant='contained'
                  onClick={load}
                  disabled={summaryLoading || trendsLoading || revenueLoading}
                >
                  Apply
                </Button>
              </div>
            )}
            <Typography variant='caption' color='text.secondary' display='block' className='mt-2'>
              Revenue uses delivery/return transactions; payroll uses paid-on date.
            </Typography>
          </div>

          <Grid container spacing={3}>
            {summaryLoading
              ? (['Revenue', 'Total cost', 'Net profit', 'Margin'] as const).map(label => (
                  <Grid key={label} size={{ xs: 6, sm: 3 }}>
                    <Typography variant='caption' color='text.secondary'>
                      {label}
                    </Typography>
                    <Skeleton variant='text' width='88%' height={28} animation='wave' sx={{ mt: 0.5 }} />
                  </Grid>
                ))
              : [
                  { label: 'Revenue' as const, children: <Typography fontWeight={600}>{formatPKR(summary?.totalRevenue ?? 0)}</Typography> },
                  { label: 'Total cost' as const, children: <Typography fontWeight={600}>{formatPKR(summary?.totalCost ?? 0)}</Typography> },
                  {
                    label: 'Net profit' as const,
                    children: (
                      <Typography
                        fontWeight={600}
                        color={summary?.netProfit >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatPKR(summary?.netProfit ?? 0)}
                      </Typography>
                    )
                  },
                  {
                    label: 'Margin' as const,
                    children: (
                      <Typography fontWeight={600}>
                        {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
                      </Typography>
                    )
                  }
                ].map(row => (
                  <Grid key={row.label} size={{ xs: 6, sm: 3 }}>
                    <Typography variant='caption' color='text.secondary'>
                      {row.label}
                    </Typography>
                    {row.children}
                  </Grid>
                ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card variant='outlined' className='h-full'>
                <CardHeader title='Revenue vs cost vs profit' subheader='By month (trends)' />
                <CardContent>
                  {trendsLoading ? (
                    <Skeleton variant='rounded' width='100%' height={lineChartHeight} animation='wave' />
                  ) : trends?.series?.length ? (
                    <ResponsiveChartWrapper minHeight={lineChartHeight}>
                      <AppReactApexCharts
                        type='line'
                        height={lineChartHeight}
                        options={lineOptions}
                        series={lineSeries}
                      />
                    </ResponsiveChartWrapper>
                  ) : (
                    <Typography color='text.secondary'>No trend data for this range.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant='outlined' className='h-full'>
                <CardHeader title='Cost breakdown' subheader='Expenses in range' />
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: { md: lineChartHeight }
                  }}
                >
                  {summaryLoading ? (
                    <Skeleton variant='rounded' width='100%' height={donutAsideHeight} animation='wave' />
                  ) : donutSeries.some((x: number) => x > 0) ? (
                    <ResponsiveChartWrapper minHeight={donutAsideHeight}>
                      <AppReactApexCharts
                        type='donut'
                        height={donutAsideHeight}
                        options={donutOptions}
                        series={donutSeries}
                      />
                    </ResponsiveChartWrapper>
                  ) : (
                    <Typography color='text.secondary'>No costs in range.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Accordion
            disableGutters
            expanded={analyticsAccordionExpanded}
            onChange={onAnalyticsAccordionChange}
            sx={{ mt: 2, boxShadow: 'none', border: '1px solid var(--mui-palette-divider)', borderRadius: 3 }}
          >
            <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                Trends &amp; analytics
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 0, sm: 0.5 }, py: 1.5, pt: 0 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <Card variant='outlined'>
                    <CardHeader title='Top products by revenue (delivery lines)' />
                    <CardContent>
                      {revenueLoading ? (
                        <Skeleton variant='rounded' width='100%' height={topProductsBarHeight} animation='wave' />
                      ) : barSeries[0]?.data?.length ? (
                        <ResponsiveChartWrapper minHeight={topProductsBarHeight}>
                          <AppReactApexCharts
                            type='bar'
                            height={topProductsBarHeight}
                            options={barOptions}
                            series={barSeries}
                          />
                        </ResponsiveChartWrapper>
                      ) : (
                        <Typography color='text.secondary'>No product revenue rows.</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Grid>
  )
}

export default ProfitCostDashboardCharts
