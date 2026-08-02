'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import type { ApexOptions } from 'apexcharts'
import { taxService } from '@/services/tax.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { formatMoney } from './taxUiLabels'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), {
  ssr: false
})

const TaxReportsPage = () => {
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [collection, setCollection] = useState<any>(null)
  const [monthly, setMonthly] = useState<any[]>([])
  const [byPharmacy, setByPharmacy] = useState<any[]>([])
  const [byType, setByType] = useState<any[]>([])
  const [outstanding, setOutstanding] = useState<any>(null)
  const [filing, setFiling] = useState<any>(null)
  const [deposits, setDeposits] = useState<any[]>([])
  const [recon, setRecon] = useState<any>(null)
  const [charts, setCharts] = useState<any>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (from) p.from = from
    if (to) p.to = to
    return p
  }, [from, to])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, m, p, t, o, f, d, r, ch] = await Promise.all([
        taxService.collectionSummary(params),
        taxService.summaryReport(params),
        taxService.byPharmacy(params),
        taxService.byTaxType(params),
        taxService.outstanding(),
        taxService.filingReport(params),
        taxService.depositHistory(params),
        taxService.reconciliation(params),
        taxService.charts(params)
      ])
      setCollection(c.data.data)
      setMonthly((m.data.data as any)?.rows || [])
      setByPharmacy(p.data.data?.rows || [])
      setByType(t.data.data?.rows || [])
      setOutstanding(o.data.data)
      setFiling(f.data.data)
      setDeposits(d.data.data?.rows || [])
      setRecon(r.data.data)
      setCharts(ch.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load tax reports')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    void load()
  }, [load])

  const exportType = async (type: string, format: string) => {
    try {
      await taxService.exportReport(type, { ...params, format })
      showSuccess(`${format.toUpperCase()} download started`)
    } catch (err) {
      showApiError(err, 'Export failed')
    }
  }

  const ExportButtons = ({ type }: { type: string }) => (
    <Stack direction='row' spacing={1}>
      <Button size='small' onClick={() => void exportType(type, 'xlsx')}>
        Excel
      </Button>
      <Button size='small' onClick={() => void exportType(type, 'csv')}>
        CSV
      </Button>
      <Button size='small' onClick={() => void exportType(type, 'pdf')}>
        PDF
      </Button>
    </Stack>
  )

  const monthlyChart = useMemo(() => {
    const seriesData = charts?.monthlyCollection || []
    const options: ApexOptions = {
      chart: { type: 'bar', toolbar: { show: false } },
      xaxis: { categories: seriesData.map((r: any) => r.periodKey) },
      dataLabels: { enabled: false },
      yaxis: { labels: { formatter: v => Number(v).toLocaleString() } }
    }
    return {
      options,
      series: [{ name: 'Tax collected', data: seriesData.map((r: any) => r.taxAmount) }]
    }
  }, [charts])

  const typeChart = useMemo(() => {
    const rows = charts?.taxByType || []
    const options: ApexOptions = {
      labels: rows.map((r: any) => r.taxTypeLabel),
      legend: { position: 'bottom' }
    }
    return {
      options,
      series: rows.map((r: any) => Math.max(0, Number(r.taxAmount) || 0))
    }
  }, [charts])

  const trendChart = useMemo(() => {
    const seriesData = charts?.outstandingLiabilityTrend || []
    const options: ApexOptions = {
      chart: { type: 'line', toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: seriesData.map((r: any) => r.periodKey) },
      dataLabels: { enabled: false }
    }
    return {
      options,
      series: [
        {
          name: 'Liability trend',
          data: seriesData.map((r: any) => r.outstandingEstimate)
        }
      ]
    }
  }, [charts])

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={2}>
        <Box>
          <Typography variant='h5' fontWeight={700}>
            Tax Reports
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Collection, remittance, filing, and GL reconciliation for finance and compliance.
          </Typography>
        </Box>
        <Stack direction='row' spacing={1}>
          <Button component={Link} href='/finance/tax/register' size='small' variant='outlined'>
            Tax Register
          </Button>
          <Button size='small' onClick={() => void load()}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems='center'>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                type='date'
                label='From'
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                type='date'
                label='To'
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading ? (
        <CircularProgress size={28} />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardHeader title='Monthly Tax Collection' />
                <CardContent>
                  {(charts?.monthlyCollection || []).length ? (
                    <AppReactApexCharts
                      type='bar'
                      height={260}
                      options={monthlyChart.options}
                      series={monthlyChart.series}
                    />
                  ) : (
                    <Typography color='text.secondary'>No chart data yet.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardHeader title='Tax By Type' />
                <CardContent>
                  {(charts?.taxByType || []).length ? (
                    <AppReactApexCharts
                      type='donut'
                      height={260}
                      options={typeChart.options}
                      series={typeChart.series}
                    />
                  ) : (
                    <Typography color='text.secondary'>No chart data yet.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardHeader title='Outstanding Liability Trend' />
                <CardContent>
                  {(charts?.outstandingLiabilityTrend || []).length ? (
                    <AppReactApexCharts
                      type='line'
                      height={260}
                      options={trendChart.options}
                      series={trendChart.series}
                    />
                  ) : (
                    <Typography color='text.secondary'>No chart data yet.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant='scrollable'>
              <Tab label='Collection Summary' />
              <Tab label='Monthly' />
              <Tab label='By Pharmacy' />
              <Tab label='By Tax Type' />
              <Tab label='Outstanding' />
              <Tab label='Filing' />
              <Tab label='Remittance History' />
              <Tab label='Reconciliation' />
              <Tab label='Register Export' />
            </Tabs>
            <CardContent>
              {tab === 0 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Tax Collection Summary</Typography>
                    <ExportButtons type='collection' />
                  </Stack>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant='caption'>Collected</Typography>
                      <Typography fontWeight={700}>{formatMoney(collection?.collected || 0)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant='caption'>Remitted</Typography>
                      <Typography fontWeight={700}>{formatMoney(collection?.remitted || 0)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant='caption'>Outstanding</Typography>
                      <Typography fontWeight={700}>
                        {formatMoney(collection?.outstanding || 0)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, md: 3 }}>
                      <Typography variant='caption'>Period</Typography>
                      <Typography fontWeight={700}>{collection?.currentTaxPeriod || '—'}</Typography>
                    </Grid>
                  </Grid>
                </Stack>
              )}

              {tab === 1 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Monthly Tax Summary</Typography>
                    <ExportButtons type='monthly' />
                  </Stack>
                  <SimpleTable
                    columns={['Period', 'Tax Type', 'Taxable', 'Tax', 'Entries']}
                    rows={monthly.map(r => [
                      r.periodKey,
                      r.taxTypeLabel,
                      formatMoney(r.taxableAmount),
                      formatMoney(r.taxAmount),
                      r.entryCount
                    ])}
                  />
                </Stack>
              )}

              {tab === 2 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Tax By Pharmacy</Typography>
                    <ExportButtons type='pharmacy' />
                  </Stack>
                  <SimpleTable
                    columns={['Pharmacy', 'Taxable', 'Tax', 'Entries']}
                    rows={byPharmacy.map(r => [
                      r.pharmacyName,
                      formatMoney(r.taxableAmount),
                      formatMoney(r.taxAmount),
                      r.entryCount
                    ])}
                  />
                </Stack>
              )}

              {tab === 3 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Tax By Tax Type</Typography>
                    <ExportButtons type='type' />
                  </Stack>
                  <SimpleTable
                    columns={['Tax Type', 'Taxable', 'Tax', 'Entries']}
                    rows={byType.map(r => [
                      r.taxTypeLabel,
                      formatMoney(r.taxableAmount),
                      formatMoney(r.taxAmount),
                      r.entryCount
                    ])}
                  />
                </Stack>
              )}

              {tab === 4 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Outstanding Liability</Typography>
                    <ExportButtons type='outstanding' />
                  </Stack>
                  <Typography>
                    Open total: <strong>{formatMoney(outstanding?.registerOpenTotal || 0)}</strong>
                  </Typography>
                  <SimpleTable
                    columns={['Invoice', 'Pharmacy', 'Type', 'Status', 'Tax']}
                    rows={(outstanding?.rows || []).map((r: any) => [
                      r.invoiceNumber || '—',
                      r.pharmacyName || '—',
                      r.taxTypeLabel || r.taxTypeCode,
                      r.statusLabel || r.status,
                      formatMoney(r.taxAmount)
                    ])}
                  />
                </Stack>
              )}

              {tab === 5 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Government Filing Report</Typography>
                    <ExportButtons type='filing' />
                  </Stack>
                  <Alert severity='info'>
                    Use this pack with challan references for authority filing. Original remittances
                    stay immutable; returns after remittance appear as open adjustments in a later
                    period.
                  </Alert>
                  <SimpleTable
                    columns={['Deposit', 'Authority', 'Payment Date', 'Payment Ref', 'Amount', 'Status']}
                    rows={(filing?.deposits || []).map((r: any) => [
                      r.depositNumber,
                      r.governmentAuthority,
                      r.paymentDate ? String(r.paymentDate).slice(0, 10) : '—',
                      r.paymentReference || '—',
                      formatMoney(r.amount),
                      r.status
                    ])}
                  />
                </Stack>
              )}

              {tab === 6 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Remittance History</Typography>
                    <ExportButtons type='deposits' />
                  </Stack>
                  <SimpleTable
                    columns={['Deposit', 'Authority', 'Date', 'Amount', 'Status', 'Payment Ref']}
                    rows={deposits.map(r => [
                      r.depositNumber,
                      r.governmentAuthority,
                      r.paymentDate ? String(r.paymentDate).slice(0, 10) : '—',
                      formatMoney(r.amount),
                      r.status,
                      r.paymentReference || '—'
                    ])}
                  />
                </Stack>
              )}

              {tab === 7 && (
                <Stack spacing={2}>
                  <Stack direction='row' justifyContent='space-between'>
                    <Typography variant='h6'>Reconciliation Report</Typography>
                    <ExportButtons type='reconciliation' />
                  </Stack>
                  <Alert severity={recon?.outOfBalance ? 'warning' : 'success'}>
                    GL Balance {formatMoney(recon?.glBalance || 0)} vs Register Balance{' '}
                    {formatMoney(recon?.registerBalance || 0)} · Difference{' '}
                    <strong>{formatMoney(recon?.difference || 0)}</strong>
                  </Alert>
                </Stack>
              )}

              {tab === 8 && (
                <Stack spacing={2}>
                  <Typography variant='h6'>Tax Register Export</Typography>
                  <Typography color='text.secondary'>
                    Export the operational register with current date filters applied.
                  </Typography>
                  <ExportButtons type='register' />
                </Stack>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  )
}

const SimpleTable = ({
  columns,
  rows
}: {
  columns: string[]
  rows: Array<Array<string | number>>
}) => (
  <Table size='small'>
    <TableHead>
      <TableRow>
        {columns.map(c => (
          <TableCell key={c}>{c}</TableCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((row, idx) => (
        <TableRow key={idx}>
          {row.map((cell, i) => (
            <TableCell key={i}>{cell}</TableCell>
          ))}
        </TableRow>
      ))}
      {!rows.length && (
        <TableRow>
          <TableCell colSpan={columns.length}>
            <Typography color='text.secondary'>No rows for this report period.</Typography>
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
)

export default TaxReportsPage
