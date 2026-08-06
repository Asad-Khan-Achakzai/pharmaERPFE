'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import PageSkeleton from '@/components/skeletons/PageSkeleton'
import { currentFiscalYearStart, fiscalYearOptions } from '@/utils/fiscalYear'
import type {
  MonthlySummaryResponse,
  MonthlySummaryRow,
  MonthlySummaryProductPacksResponse,
  TpEventsBucket,
  SalesMovementTp
} from '@/types/monthlySummary'
import ResponsiveChartWrapper from '@/views/dashboard/ResponsiveChartWrapper'
import SalesMovementTpDrawer from '@/views/reports/SalesMovementTpDrawer'
import Link from '@mui/material/Link'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

let monthlySummaryCache: { key: string; data: MonthlySummaryResponse } | null = null

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatPKRPlain = (v: number) =>
  (v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const plColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.primary')

/** Compact x-axis label from YYYY-MM (e.g. Aug '25) — avoids full names overlapping on 12-month fiscal charts. */
const chartMonthShortLabel = (ym: string) => {
  const parts = ym.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  if (!y || !m) return ym
  const d = new Date(y, m - 1, 1)
  const short = d.toLocaleString('en-US', { month: 'short' })
  return `${short} '${String(y).slice(-2)}`
}

const chartMonthFullLabel = (ym: string) => {
  const parts = ym.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

const NUM_COLS: { key: keyof MonthlySummaryRow; label: string; short?: string }[] = [
  { key: 'netSales', label: 'Net Sales', short: 'Pharmacy payable — not Trade Price' },
  { key: 'distribution', label: 'Distribution' },
  { key: 'discount', label: 'Discount' },
  { key: 'castingCost', label: 'Casting', short: 'Products sold (casting price)' },
  { key: 'expenses', label: 'Expenses', short: 'Payroll + operating' },
  { key: 'pl', label: 'P/L' },
  { key: 'marketing', label: 'Marketing', short: 'Doctor investment' }
]

const MOVEMENT_COLS: { key: keyof SalesMovementTp; label: string; bucket: TpEventsBucket }[] = [
  { key: 'grossDeliveriesTp', label: 'Gross Deliveries (TP)', bucket: 'grossDeliveries' },
  {
    key: 'returnsCurrentPeriodTp',
    label: 'Returns – Current-Period Deliveries',
    bucket: 'returnsCurrentPeriod'
  },
  {
    key: 'returnsPriorPeriodTp',
    label: 'Returns – Prior-Period Deliveries',
    bucket: 'returnsPriorPeriod'
  },
  {
    key: 'amendmentsCurrentPeriodTp',
    label: 'Amendments – Current-Period Deliveries',
    bucket: 'amendmentsCurrentPeriod'
  },
  {
    key: 'amendmentsPriorPeriodTp',
    label: 'Amendments – Prior-Period Deliveries',
    bucket: 'amendmentsPriorPeriod'
  },
  { key: 'netTpSales', label: 'Net TP Sales', bucket: 'netTpSales' }
]

const emptyMovement = (): SalesMovementTp => ({
  grossDeliveriesTp: 0,
  returnsCurrentPeriodTp: 0,
  returnsPriorPeriodTp: 0,
  amendmentsCurrentPeriodTp: 0,
  amendmentsPriorPeriodTp: 0,
  returnsUnclassifiedTp: 0,
  amendmentsUnclassifiedTp: 0,
  netTpSales: 0
})

const exportCsv = (data: MonthlySummaryResponse) => {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const row = (cells: (string | number)[]) => cells.map(c => esc(String(c))).join(',')
  const lines = [
    row(['Monthly Summary', data.fiscalYearLabel]),
    row(['Period', `${data.period.from} → ${data.period.to}`]),
    ''
  ]
  lines.push(row(['Sales Movement (TP)']))
  lines.push(row(['Month', ...MOVEMENT_COLS.map(c => c.label)]))
  for (const r of data.rows) {
    const m = r.salesMovement || emptyMovement()
    lines.push(row([r.monthLabel, ...MOVEMENT_COLS.map(c => m[c.key])]))
  }
  const tm = data.totals.salesMovement || emptyMovement()
  lines.push(row(['Total', ...MOVEMENT_COLS.map(c => tm[c.key])]))
  lines.push('')
  lines.push(row(['Financial Summary']))
  lines.push(row(['Month', ...NUM_COLS.map(c => c.label)]))
  for (const r of data.rows) {
    lines.push(
      row([
        r.monthLabel,
        r.netSales,
        r.distribution,
        r.discount,
        r.castingCost,
        r.expenses,
        r.pl,
        r.marketing
      ])
    )
  }
  const t = data.totals
  lines.push(
    row([
      'Total',
      t.netSales,
      t.distribution,
      t.discount,
      t.castingCost,
      t.expenses,
      t.pl,
      t.marketing
    ])
  )
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `monthly-summary-${data.fiscalYearLabel}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const formatPacks = (v: number) => (v || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

const expandedMonthRowSx = (isExpanded: boolean) =>
  isExpanded
    ? {
        bgcolor: 'action.selected',
        borderLeft: '3px solid',
        borderLeftColor: 'primary.main',
        '& > .MuiTableCell-root': { fontWeight: 700 }
      }
    : {}

const DETAIL_MOVEMENT_ROWS: {
  key: keyof SalesMovementTp
  label: string
  bucket: TpEventsBucket
  emphasize?: boolean
}[] = [
  { key: 'grossDeliveriesTp', label: 'Gross Deliveries (TP)', bucket: 'grossDeliveries' },
  { key: 'returnsCurrentPeriodTp', label: 'Returns – Current Period', bucket: 'returnsCurrentPeriod' },
  { key: 'returnsPriorPeriodTp', label: 'Returns – Prior Period', bucket: 'returnsPriorPeriod' },
  {
    key: 'amendmentsCurrentPeriodTp',
    label: 'Amendments – Current Period',
    bucket: 'amendmentsCurrentPeriod'
  },
  {
    key: 'amendmentsPriorPeriodTp',
    label: 'Amendments – Prior Period',
    bucket: 'amendmentsPriorPeriod'
  },
  { key: 'netTpSales', label: 'Net TP Sales', bucket: 'netTpSales', emphasize: true }
]

/** Prefer current month, then last month with activity, else last month in fiscal year. */
const pickDefaultMonth = (payload: MonthlySummaryResponse): string => {
  if (!payload.monthKeys?.length) return ''
  const now = new Date()
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (payload.monthKeys.includes(currentYm)) return currentYm
  const lastWithData = [...payload.rows]
    .reverse()
    .find(r => r.netSales !== 0 || r.discount !== 0 || r.castingCost !== 0)
  if (lastWithData) return lastWithData.month
  return payload.monthKeys[payload.monthKeys.length - 1]
}

const MonthlySummarySection = () => {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const fyOptions = useMemo(() => fiscalYearOptions(8), [])
  const [fiscalYearStart, setFiscalYearStart] = useState(() => currentFiscalYearStart())
  const cacheKey = String(fiscalYearStart)
  const [loading, setLoading] = useState(!monthlySummaryCache || monthlySummaryCache.key !== cacheKey)
  const [data, setData] = useState<MonthlySummaryResponse | null>(
    monthlySummaryCache?.key === cacheKey ? monthlySummaryCache.data : null
  )
  const [selectedMonth, setSelectedMonth] = useState('')
  const [productPacks, setProductPacks] = useState<MonthlySummaryProductPacksResponse | null>(null)
  const [productPacksLoading, setProductPacksLoading] = useState(false)
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null)
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillMonth, setDrillMonth] = useState('')
  const [drillMonthLabel, setDrillMonthLabel] = useState('')
  const [drillBucket, setDrillBucket] = useState<TpEventsBucket>('netTpSales')
  /** Exactly one expanded month at a time (master-detail). */
  const [expandedMonth, setExpandedMonth] = useState('')

  const openDrill = (month: string, monthLabel: string, bucket: TpEventsBucket) => {
    setDrillMonth(month)
    setDrillMonthLabel(monthLabel)
    setDrillBucket(bucket)
    setDrillOpen(true)
  }

  const toggleExpandMonth = useCallback((month: string) => {
    setExpandedMonth(prev => (prev === month ? '' : month))
    setSelectedMonth(month)
  }, [])

  const load = useCallback(async () => {
    const hasCache = monthlySummaryCache?.key === cacheKey
    if (!hasCache) setLoading(true)
    try {
      const res = await reportsService.monthlySummary({ fiscalYearStart: String(fiscalYearStart) })
      const payload = res.data.data as MonthlySummaryResponse
      monthlySummaryCache = { key: cacheKey, data: payload }
      setData(payload)
      if (payload.monthKeys?.length) {
        setSelectedMonth(prev => {
          const next = prev && payload.monthKeys.includes(prev) ? prev : pickDefaultMonth(payload)
          setExpandedMonth(exp => (exp && payload.monthKeys.includes(exp) ? exp : next))
          return next
        })
      } else {
        setSelectedMonth('')
        setExpandedMonth('')
      }
    } catch (e) {
      showApiError(e, 'Failed to load monthly summary')
    } finally {
      setLoading(false)
    }
  }, [cacheKey, fiscalYearStart])

  useEffect(() => {
    load()
  }, [load])

  const loadProductPacks = useCallback(async () => {
    // Wait until summary data matches the selected FY — avoids calling product-packs
    // with a month from the previous year while the new summary is still loading.
    if (
      !selectedMonth ||
      !data?.monthKeys?.includes(selectedMonth) ||
      data.fiscalYearStart !== fiscalYearStart
    ) {
      setProductPacks(null)
      return
    }
    setProductPacksLoading(true)
    try {
      const res = await reportsService.monthlySummaryProductPacks({
        month: selectedMonth,
        fiscalYearStart: String(fiscalYearStart)
      })
      setProductPacks(res.data.data as MonthlySummaryProductPacksResponse)
    } catch (e) {
      showApiError(e, 'Failed to load product pack sales')
      setProductPacks(null)
    } finally {
      setProductPacksLoading(false)
    }
  }, [data, fiscalYearStart, selectedMonth])

  useEffect(() => {
    void loadProductPacks()
  }, [loadProductPacks])

  const downloadDeliveryDetailsForMonth = useCallback(
    async (monthYm: string) => {
      setDownloadingMonth(monthYm)
      try {
        const res = await reportsService.monthlySummaryDeliveryDetailsExcel({
          month: monthYm,
          fiscalYearStart: String(fiscalYearStart)
        })
        const blob = res.data as Blob
        const cd = res.headers['content-disposition'] as string | undefined
        let filename = `delivery-details-${monthYm}.xlsx`
        if (cd) {
          const match = /filename="?([^";\n]+)"?/.exec(cd)
          if (match?.[1]) filename = match[1]
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } catch (e) {
        showApiError(e, 'Failed to download delivery details')
      } finally {
        setDownloadingMonth(null)
      }
    },
    [fiscalYearStart]
  )

  const chartMeta = useMemo(() => {
    if (!data?.rows?.length) return { categories: [] as string[], fullByYm: new Map<string, string>() }
    const fullByYm = new Map<string, string>()
    const categories = data.rows.map(r => {
      fullByYm.set(r.month, chartMonthFullLabel(r.month))
      return chartMonthShortLabel(r.month)
    })
    return { categories, fullByYm }
  }, [data])

  const chartBase: ApexOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: {
        categories: chartMeta.categories,
        tickAmount: chartMeta.categories.length,
        tickPlacement: 'between',
        labels: {
          rotate: isCompact ? -65 : -40,
          rotateAlways: true,
          hideOverlappingLabels: false,
          trim: false,
          minHeight: isCompact ? 72 : 56,
          style: {
            fontSize: isCompact ? '10px' : '11px',
            fontFamily: theme.typography.fontFamily
          }
        },
        axisBorder: { show: true },
        axisTicks: { show: true }
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`,
          style: { fontSize: isCompact ? '10px' : '11px' }
        }
      },
      tooltip: {
        x: {
          formatter: (_val, opts) => {
            const ym = data?.rows[opts?.dataPointIndex ?? 0]?.month
            return ym ? chartMeta.fullByYm.get(ym) ?? ym : String(_val)
          }
        },
        y: {
          formatter: (val: number) => formatPKR(val)
        }
      },
      grid: {
        strokeDashArray: 4,
        borderColor: 'var(--mui-palette-divider)',
        padding: { left: 8, right: 16, bottom: isCompact ? 8 : 4 }
      }
    }),
    [chartMeta, data?.rows, isCompact, theme.typography.fontFamily]
  )

  const plSeries = useMemo(
    () => [{ name: 'P/L', data: data?.rows.map(r => r.pl) ?? [] }],
    [data]
  )

  const netSalesSeries = useMemo(
    () => [{ name: 'Net Sales', data: data?.rows.map(r => r.netSales) ?? [] }],
    [data]
  )

  const kpiItems = useMemo(() => {
    if (!data?.totals) return []
    const t = data.totals
    return NUM_COLS.map(col => ({
      label: col.label,
      hint: col.short,
      value: col.key === 'pl' ? t.pl : (t[col.key] as number),
      isPl: col.key === 'pl'
    }))
  }, [data])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card variant='outlined'>
          <CardContent className='flex flex-wrap gap-4 items-end justify-between'>
            <div className='flex flex-wrap gap-4 items-end'>
              <CustomTextField
                select
                label='Fiscal year'
                value={fiscalYearStart}
                onChange={e => setFiscalYearStart(Number(e.target.value))}
                sx={{ minWidth: 200 }}
                size='small'
              >
                {fyOptions.map(o => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </CustomTextField>
              {data?.period ? (
                <Typography variant='body2' color='text.secondary'>
                  Period: <strong>{data.period.from}</strong> → <strong>{data.period.to}</strong>
                </Typography>
              ) : null}
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button variant='outlined' size='small' onClick={load} disabled={loading}>
                Refresh
              </Button>
              <Button
                variant='contained'
                size='small'
                disabled={!data || loading}
                onClick={() => data && exportCsv(data)}
              >
                Export to Excel (CSV)
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {loading ? (
        <Grid size={{ xs: 12 }}>
          <PageSkeleton cardCount={2} showTable />
        </Grid>
      ) : data ? (
        <>
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={3}>
              {kpiItems.map(item => (
                <Grid key={item.label} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card variant='outlined' sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant='body2' color='text.secondary'>
                        Total {item.label}
                        {item.hint ? (
                          <Typography component='span' variant='caption' display='block' color='text.disabled'>
                            {item.hint}
                          </Typography>
                        ) : null}
                      </Typography>
                      <Typography
                        variant='h6'
                        fontWeight={700}
                        sx={{ mt: 1 }}
                        color={item.isPl ? plColor(item.value) : 'text.primary'}
                      >
                        {formatPKR(item.value)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title='Monthly P/L trend' />
              <CardContent>
                <ResponsiveChartWrapper minHeight={isCompact ? 320 : 300}>
                  <AppReactApexCharts
                    type='line'
                    height={isCompact ? 320 : 300}
                    width='100%'
                    options={{
                      ...chartBase,
                      colors: ['var(--mui-palette-success-main)'],
                      markers: {
                        size: 4,
                        colors: data.rows.map(r =>
                          r.pl >= 0 ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-error-main)'
                        )
                      }
                    }}
                    series={plSeries}
                  />
                </ResponsiveChartWrapper>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title='Monthly Net Sales trend' />
              <CardContent>
                <ResponsiveChartWrapper minHeight={isCompact ? 320 : 300}>
                  <AppReactApexCharts
                    type='line'
                    height={isCompact ? 320 : 300}
                    width='100%'
                    options={{
                      ...chartBase,
                      colors: ['var(--mui-palette-primary-main)']
                    }}
                    series={netSalesSeries}
                  />
                </ResponsiveChartWrapper>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title={`Monthly Summary — ${data.fiscalYearLabel}`}
                subheader='Click a month to expand Sales Movement (TP) details. Click TP amounts in the expanded section to see the orders behind them.'
              />
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <TableContainer
                  component={Paper}
                  variant='outlined'
                  sx={{ maxHeight: 720, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}
                >
                  <Table stickyHeader size='small' sx={{ minWidth: 960 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper', width: 160 }}>
                          Month
                        </TableCell>
                        {NUM_COLS.map(col => (
                          <TableCell
                            key={col.key}
                            align='right'
                            sx={{ fontWeight: 700, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}
                          >
                            <Tooltip title={col.short || col.label}>
                              <span>{col.label}</span>
                            </Tooltip>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.rows.map(row => {
                        const m = row.salesMovement || emptyMovement()
                        const isExpanded = expandedMonth === row.month
                        const colSpan = NUM_COLS.length + 1
                        return (
                          <Fragment key={row.month}>
                            <TableRow
                              hover
                              selected={isExpanded}
                              sx={expandedMonthRowSx(isExpanded)}
                            >
                              <TableCell
                                onClick={() => toggleExpandMonth(row.month)}
                                sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              >
                                <Box className='inline-flex items-center gap-1'>
                                  <i
                                    className={
                                      isExpanded ? 'tabler-chevron-down text-base' : 'tabler-chevron-right text-base'
                                    }
                                  />
                                  {row.monthLabel}
                                </Box>
                              </TableCell>
                              {NUM_COLS.map(col => {
                                const val = row[col.key] as number
                                return (
                                  <TableCell
                                    key={col.key}
                                    align='right'
                                    sx={{
                                      fontVariantNumeric: 'tabular-nums',
                                      ...(col.key === 'pl' ? { color: plColor(val) } : {})
                                    }}
                                  >
                                    {formatPKRPlain(val)}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                            <TableRow>
                              <TableCell
                                colSpan={colSpan}
                                sx={{
                                  py: 0,
                                  borderBottom: isExpanded ? undefined : 'none',
                                  bgcolor: isExpanded ? 'action.hover' : undefined
                                }}
                              >
                                <Collapse in={isExpanded} timeout='auto' unmountOnExit>
                                  <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
                                    <Box className='flex flex-wrap items-center justify-between gap-2 mb-2'>
                                      <Typography variant='subtitle2' fontWeight={700}>
                                        {chartMonthFullLabel(row.month)}
                                      </Typography>
                                      <Tooltip title='Download delivery details (Excel)'>
                                        <span>
                                          <Button
                                            size='small'
                                            variant='outlined'
                                            startIcon={
                                              downloadingMonth === row.month ? (
                                                <CircularProgress size={14} />
                                              ) : (
                                                <i className='tabler-download' />
                                              )
                                            }
                                            disabled={downloadingMonth === row.month}
                                            onClick={() => void downloadDeliveryDetailsForMonth(row.month)}
                                          >
                                            Delivery Excel
                                          </Button>
                                        </span>
                                      </Tooltip>
                                    </Box>
                                    <Grid container spacing={3}>
                                      <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography
                                          variant='caption'
                                          color='text.secondary'
                                          fontWeight={700}
                                          display='block'
                                          sx={{ mb: 1, letterSpacing: 0.4, textTransform: 'uppercase' }}
                                        >
                                          Sales Movement Details
                                        </Typography>
                                        {DETAIL_MOVEMENT_ROWS.map(item => (
                                          <Box
                                            key={item.key}
                                            className='flex items-center justify-between gap-3'
                                            sx={{
                                              py: 0.5,
                                              borderBottom: '1px solid',
                                              borderColor: 'divider'
                                            }}
                                          >
                                            <Typography
                                              variant='body2'
                                              color={item.emphasize ? 'text.primary' : 'text.secondary'}
                                              fontWeight={item.emphasize ? 700 : 400}
                                            >
                                              {item.label}
                                            </Typography>
                                            <Link
                                              component='button'
                                              type='button'
                                              underline='hover'
                                              onClick={() => openDrill(row.month, row.monthLabel, item.bucket)}
                                              sx={{
                                                fontWeight: item.emphasize ? 700 : 600,
                                                color: 'inherit',
                                                fontVariantNumeric: 'tabular-nums',
                                                fontSize: '0.875rem'
                                              }}
                                            >
                                              {formatPKR(m[item.key])}
                                            </Link>
                                          </Box>
                                        ))}
                                      </Grid>
                                      <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography
                                          variant='caption'
                                          color='text.secondary'
                                          fontWeight={700}
                                          display='block'
                                          sx={{ mb: 1, letterSpacing: 0.4, textTransform: 'uppercase' }}
                                        >
                                          Financial Summary
                                        </Typography>
                                        {NUM_COLS.map(col => {
                                          const val = row[col.key] as number
                                          return (
                                            <Box
                                              key={col.key}
                                              className='flex items-center justify-between gap-3'
                                              sx={{
                                                py: 0.5,
                                                borderBottom: '1px solid',
                                                borderColor: 'divider'
                                              }}
                                            >
                                              <Typography
                                                variant='body2'
                                                color={col.key === 'pl' ? 'text.primary' : 'text.secondary'}
                                                fontWeight={col.key === 'pl' ? 700 : 400}
                                              >
                                                {col.label}
                                              </Typography>
                                              <Typography
                                                variant='body2'
                                                fontWeight={col.key === 'pl' ? 700 : 600}
                                                color={col.key === 'pl' ? plColor(val) : 'text.primary'}
                                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                                              >
                                                {formatPKR(val)}
                                              </Typography>
                                            </Box>
                                          )
                                        })}
                                      </Grid>
                                    </Grid>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        )
                      })}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                        {NUM_COLS.map(col => {
                          const val = data.totals[col.key] as number
                          return (
                            <TableCell
                              key={col.key}
                              align='right'
                              sx={{
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                ...(col.key === 'pl' ? { color: plColor(val) } : {})
                              }}
                            >
                              {formatPKRPlain(val)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Net TP Sales is Trade Price. Net Sales is pharmacy payable — a different figure.
                  </Typography>
                  {data.meta?.plFormula ? (
                    <Typography variant='caption' color='text.secondary' display='block'>
                      {data.meta.plFormula}
                    </Typography>
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title='Product pack sales'
                subheader={
                  selectedMonth
                    ? `Physical packs delivered minus returns, by product — ${chartMonthFullLabel(selectedMonth)} (expand a month above to change)`
                    : 'Physical packs delivered minus returns, by product — expand a month above'
                }
              />
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <TableContainer component={Paper} variant='outlined' sx={{ maxHeight: 480, overflow: 'auto' }}>
                  <Table stickyHeader size='small' sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Product</TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                          Delivered
                        </TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                          Paid
                        </TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                          Bonus
                        </TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                          Returned
                        </TableCell>
                        <TableCell align='right' sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                          Net packs
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {productPacksLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className='text-center p-6'>
                            <CircularProgress size={32} />
                          </TableCell>
                        </TableRow>
                      ) : !productPacks?.rows?.length ? (
                        <TableRow>
                          <TableCell colSpan={6} className='text-center p-6'>
                            <Typography color='text.secondary'>
                              No pack sales recorded for {productPacks?.monthLabel || 'this month'}.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {productPacks.rows.map(row => (
                            <TableRow key={row.productId} hover>
                              <TableCell>
                                <Typography fontWeight={600}>{row.productName}</Typography>
                                {row.composition ? (
                                  <Typography variant='caption' color='text.secondary' className='block'>
                                    {row.composition}
                                  </Typography>
                                ) : null}
                              </TableCell>
                              <TableCell align='right'>{formatPacks(row.deliveredPacks)}</TableCell>
                              <TableCell align='right'>{formatPacks(row.paidPacks)}</TableCell>
                              <TableCell align='right'>{formatPacks(row.bonusPacks)}</TableCell>
                              <TableCell align='right'>{formatPacks(row.returnedPacks)}</TableCell>
                              <TableCell align='right'>
                                <Typography fontWeight={600}>{formatPacks(row.netPacks)}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                            <TableCell align='right' sx={{ fontWeight: 700 }}>
                              {formatPacks(
                                productPacks.rows.reduce((s, r) => s + r.deliveredPacks, 0)
                              )}
                            </TableCell>
                            <TableCell align='right' sx={{ fontWeight: 700 }}>
                              {formatPacks(productPacks.totals.paidPacks)}
                            </TableCell>
                            <TableCell align='right' sx={{ fontWeight: 700 }}>
                              {formatPacks(productPacks.totals.bonusPacks)}
                            </TableCell>
                            <TableCell align='right' sx={{ fontWeight: 700 }}>
                              {formatPacks(productPacks.totals.returnedPacks)}
                            </TableCell>
                            <TableCell align='right' sx={{ fontWeight: 700 }}>
                              {formatPacks(productPacks.totals.netPacks)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </>
      ) : (
        <Grid size={{ xs: 12 }}>
          <Typography color='text.secondary'>No data for this fiscal year.</Typography>
        </Grid>
      )}

      <SalesMovementTpDrawer
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        month={drillMonth}
        monthLabel={drillMonthLabel}
        bucket={drillBucket}
        fiscalYearStart={fiscalYearStart}
      />
    </Grid>
  )
}

export default MonthlySummarySection
