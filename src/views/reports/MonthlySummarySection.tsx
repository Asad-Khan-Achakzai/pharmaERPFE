'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import PageSkeleton from '@/components/skeletons/PageSkeleton'
import { currentFiscalYearStart, fiscalYearOptions } from '@/utils/fiscalYear'
import type { MonthlySummaryResponse, MonthlySummaryRow } from '@/types/monthlySummary'
import ResponsiveChartWrapper from '@/views/dashboard/ResponsiveChartWrapper'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

let monthlySummaryCache: { key: string; data: MonthlySummaryResponse } | null = null

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatPKRPlain = (v: number) =>
  (v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const plColor = (v: number) => (v > 0 ? 'success.main' : v < 0 ? 'error.main' : 'text.primary')

const NUM_COLS: { key: keyof MonthlySummaryRow; label: string; short?: string }[] = [
  { key: 'netSales', label: 'Net Sales' },
  { key: 'distribution', label: 'Distribution' },
  { key: 'discount', label: 'Discount' },
  { key: 'stockPurchaseExpenses', label: 'Stock Purchase', short: 'Supplier GRN / purchase' },
  { key: 'expenses', label: 'Expenses', short: 'Payroll + operating' },
  { key: 'pl', label: 'P/L' },
  { key: 'marketing', label: 'Marketing', short: 'Doctor investment' }
]

const exportCsv = (data: MonthlySummaryResponse) => {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const row = (cells: (string | number)[]) => cells.map(c => esc(String(c))).join(',')
  const headers = ['Month', ...NUM_COLS.map(c => c.label)]
  const lines = [row(['Monthly Summary', data.fiscalYearLabel]), row(['Period', `${data.period.from} → ${data.period.to}`]), '']
  lines.push(row(headers))
  for (const r of data.rows) {
    lines.push(
      row([
        r.monthLabel,
        r.netSales,
        r.distribution,
        r.discount,
        r.stockPurchaseExpenses,
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
      t.stockPurchaseExpenses,
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

const MonthlySummarySection = () => {
  const fyOptions = useMemo(() => fiscalYearOptions(8), [])
  const [fiscalYearStart, setFiscalYearStart] = useState(() => currentFiscalYearStart())
  const cacheKey = String(fiscalYearStart)
  const [loading, setLoading] = useState(!monthlySummaryCache || monthlySummaryCache.key !== cacheKey)
  const [data, setData] = useState<MonthlySummaryResponse | null>(
    monthlySummaryCache?.key === cacheKey ? monthlySummaryCache.data : null
  )

  const load = useCallback(async () => {
    const hasCache = monthlySummaryCache?.key === cacheKey
    if (!hasCache) setLoading(true)
    try {
      const res = await reportsService.monthlySummary({ fiscalYearStart: String(fiscalYearStart) })
      const payload = res.data.data as MonthlySummaryResponse
      monthlySummaryCache = { key: cacheKey, data: payload }
      setData(payload)
    } catch (e) {
      showApiError(e, 'Failed to load monthly summary')
    } finally {
      setLoading(false)
    }
  }, [cacheKey, fiscalYearStart])

  useEffect(() => {
    load()
  }, [load])

  const chartCategories = data?.rows.map(r => r.monthLabel) ?? []

  const chartBase: ApexOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: { categories: chartCategories },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      grid: { strokeDashArray: 4, borderColor: 'var(--mui-palette-divider)' }
    }),
    [chartCategories]
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
                <ResponsiveChartWrapper minHeight={280}>
                  <AppReactApexCharts
                    type='line'
                    height={280}
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
                <ResponsiveChartWrapper minHeight={280}>
                  <AppReactApexCharts
                    type='line'
                    height={280}
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
                title={`Monthly summary — ${data.fiscalYearLabel}`}
                subheader={data.meta?.plFormula}
              />
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <TableContainer
                  component={Paper}
                  variant='outlined'
                  sx={{
                    maxHeight: 560,
                    overflow: 'auto',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  <Table stickyHeader size='small' sx={{ minWidth: 960 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>Month</TableCell>
                        {NUM_COLS.map(col => (
                          <TableCell key={col.key} align='right' sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                            {col.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.rows.map(row => (
                        <TableRow key={row.month} hover>
                          <TableCell>{row.monthLabel}</TableCell>
                          {NUM_COLS.map(col => {
                            const val = row[col.key] as number
                            return (
                              <TableCell
                                key={col.key}
                                align='right'
                                sx={col.key === 'pl' ? { color: plColor(val), fontWeight: 600 } : undefined}
                              >
                                {formatPKRPlain(val)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 700 }}>{data.totals.monthLabel}</TableCell>
                        {NUM_COLS.map(col => {
                          const val = data.totals[col.key] as number
                          return (
                            <TableCell
                              key={col.key}
                              align='right'
                              sx={{ fontWeight: 700, ...(col.key === 'pl' ? { color: plColor(val) } : {}) }}
                            >
                              {formatPKRPlain(val)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                {data.meta?.notes?.length ? (
                  <Box sx={{ px: 3, py: 2 }}>
                    {data.meta.notes.map(note => (
                      <Typography key={note} variant='caption' color='text.secondary' display='block'>
                        {note}
                      </Typography>
                    ))}
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        </>
      ) : (
        <Grid size={{ xs: 12 }}>
          <Typography color='text.secondary'>No data for this fiscal year.</Typography>
        </Grid>
      )}
    </Grid>
  )
}

export default MonthlySummarySection
