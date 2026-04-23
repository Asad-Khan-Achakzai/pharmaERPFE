'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SyntheticEvent } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import classnames from 'classnames'
import type { ApexOptions } from 'apexcharts'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import CustomAvatar from '@core/components/mui/Avatar'
import { inventoryService } from '@/services/inventory.service'
import { showApiError } from '@/utils/apiErrors'
import ResponsiveChartWrapper from '@/views/dashboard/ResponsiveChartWrapper'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const TOP_N = 10
const DASHBOARD_DETAIL_LIMIT = 120

type TabId = 'value' | 'quantity' | 'distributor'

type SummaryRow = {
  productName: string
  totalQuantity: number
  totalValue: number
}

type DetailRow = {
  quantity: number
  avgCostPerUnit: number
  distributorId?: { name?: string } | null
}

const truncLabel = (s: string, max: number) => {
  const t = (s || '—').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

type InventoryDashboardChartsProps = {
  deferFetch?: boolean
}

const InventoryDashboardCharts = ({ deferFetch = false }: InventoryDashboardChartsProps) => {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const labelMax = isCompact ? 16 : 36
  const topN = isCompact ? 6 : TOP_N

  const [tab, setTab] = useState<TabId>('value')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(true)
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [totals, setTotals] = useState({ totalUnits: 0, totalValue: 0, uniqueProducts: 0 })

  /** Load summary first; detail rows are deferred until distributor tab is opened. */
  const load = useCallback(() => {
    void (async () => {
      setSummaryLoading(true)
      try {
        const summaryRes = await inventoryService.getSummary()
        const s = summaryRes.data.data
        setSummaryRows(s?.byProduct || [])
        setTotals(s?.totals || { totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
      } catch (e) {
        showApiError(e, 'Failed to load inventory summary')
        setSummaryRows([])
        setTotals({ totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
      } finally {
        setSummaryLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!deferFetch) return
    load()
  }, [deferFetch, load])

  useEffect(() => {
    if (!deferFetch || tab !== 'distributor' || detailRows.length > 0) return
    let cancelled = false
    void (async () => {
      setDetailLoading(true)
      try {
        /**
         * Dashboard only needs a compact slice for the chart; full inventory detail belongs to Inventory page.
         */
        const detailRes = await inventoryService.getAll({ limit: DASHBOARD_DETAIL_LIMIT })
        if (!cancelled) setDetailRows(detailRes.data.data || [])
      } catch (e) {
        if (!cancelled) {
          showApiError(e, 'Failed to load inventory detail for distributor view')
          setDetailRows([])
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deferFetch, tab, detailRows.length])

  const distributorAgg = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of detailRows) {
      const name =
        r.distributorId && typeof r.distributorId === 'object' && r.distributorId.name
          ? String(r.distributorId.name)
          : '—'
      const v = (r.quantity || 0) * (r.avgCostPerUnit || 0)
      m.set(name, (m.get(name) || 0) + v)
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
  }, [detailRows, topN])

  const byValue = useMemo(() => {
    return [...summaryRows]
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      .slice(0, topN)
  }, [summaryRows, topN])

  const byQty = useMemo(() => {
    return [...summaryRows]
      .sort((a, b) => (b.totalQuantity || 0) - (a.totalQuantity || 0))
      .slice(0, topN)
  }, [summaryRows, topN])

  const barHeight = (count: number) => {
    const n = count || 1
    if (isCompact) {
      return Math.max(300, Math.min(580, 56 + n * 46))
    }
    return Math.max(260, Math.min(520, 48 + n * 36))
  }

  const valueOptions: ApexOptions = useMemo(() => {
    const rows = byValue
    const cats = rows.map(r => truncLabel(r.productName || '—', labelMax))
    return {
      chart: { toolbar: { show: false } },
      plotOptions: {
        bar: { horizontal: true, borderRadius: isCompact ? 6 : 4, barHeight: isCompact ? '78%' : '70%' }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: {
          style: { fontSize: isCompact ? '10px' : '11px' },
          maxWidth: isCompact ? 100 : 220,
          trim: true,
          /**
           * Horizontal bars: `xaxis.categories` render on the Y side in Apex. Constrain
           * the category band so long names don’t crush the value axis on mobile.
           */
          hideOverlappingLabels: true
        }
      },
      yaxis: {
        labels: {
          maxWidth: isCompact ? 72 : 100,
          style: { fontSize: isCompact ? '9px' : '12px' },
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      colors: ['var(--mui-palette-primary-main)'],
      grid: {
        strokeDashArray: 4,
        borderColor: 'var(--mui-palette-divider)',
        padding: isCompact
          ? { top: 6, right: 4, bottom: 2, left: 2 }
          : { top: 8, right: 12, bottom: 8, left: 8 }
      }
    }
  }, [byValue, isCompact, labelMax])

  const valueSeries = useMemo(
    () => [{ name: 'Stock value', data: byValue.map(r => r.totalValue || 0) }],
    [byValue]
  )

  const qtyOptions: ApexOptions = useMemo(() => {
    const rows = byQty
    const cats = rows.map(r => truncLabel(r.productName || '—', labelMax))
    return {
      chart: { toolbar: { show: false } },
      plotOptions: {
        bar: { horizontal: true, borderRadius: isCompact ? 6 : 4, barHeight: isCompact ? '78%' : '70%' }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: {
          style: { fontSize: isCompact ? '10px' : '11px' },
          maxWidth: isCompact ? 100 : 220,
          trim: true,
          hideOverlappingLabels: true
        }
      },
      yaxis: {
        labels: {
          maxWidth: isCompact ? 72 : 100,
          style: { fontSize: isCompact ? '9px' : '12px' },
          formatter: (val: number) => (val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
        }
      },
      colors: ['var(--mui-palette-info-main)'],
      grid: {
        strokeDashArray: 4,
        borderColor: 'var(--mui-palette-divider)',
        padding: isCompact
          ? { top: 6, right: 4, bottom: 2, left: 2 }
          : { top: 8, right: 12, bottom: 8, left: 8 }
      }
    }
  }, [byQty, isCompact, labelMax])

  const qtySeries = useMemo(
    () => [{ name: 'Units', data: byQty.map(r => r.totalQuantity || 0) }],
    [byQty]
  )

  const distOptions: ApexOptions = useMemo(() => {
    const cats = distributorAgg.map(([name]) => truncLabel(name, labelMax))
    return {
      chart: { toolbar: { show: false } },
      plotOptions: {
        bar: { horizontal: true, borderRadius: isCompact ? 6 : 4, barHeight: isCompact ? '78%' : '70%' }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: {
          style: { fontSize: isCompact ? '10px' : '11px' },
          maxWidth: isCompact ? 100 : 220,
          trim: true,
          hideOverlappingLabels: true
        }
      },
      yaxis: {
        labels: {
          maxWidth: isCompact ? 72 : 100,
          style: { fontSize: isCompact ? '9px' : '12px' },
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      colors: ['var(--mui-palette-success-main)'],
      grid: {
        strokeDashArray: 4,
        borderColor: 'var(--mui-palette-divider)',
        padding: isCompact
          ? { top: 6, right: 4, bottom: 2, left: 2 }
          : { top: 8, right: 12, bottom: 8, left: 8 }
      }
    }
  }, [distributorAgg, isCompact, labelMax])

  const distSeries = useMemo(
    () => [{ name: 'Stock value', data: distributorAgg.map(([, v]) => v) }],
    [distributorAgg]
  )

  const handleTab = (_: SyntheticEvent, v: string) => setTab(v as TabId)

  const formatPKR = (v: number) =>
    `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const tabDefs: { id: TabId; title: string; icon: string }[] = [
    { id: 'value', title: 'By value', icon: 'tabler-currency-dollar' },
    { id: 'quantity', title: 'By quantity', icon: 'tabler-packages' },
    { id: 'distributor', title: 'By distributor', icon: 'tabler-truck-delivery' }
  ]

  return (
    <Grid size={{ xs: 12 }}>
      <Card variant='outlined' sx={{ boxShadow: 'none', borderColor: 'divider' }}>
        <CardHeader
          title='Inventory overview'
          subheader='Top products and distributor stock (same sources as the Inventory page).'
          action={
            <Button component={Link} href='/inventory' size='small' variant='tonal'>
              Open inventory
            </Button>
          }
        />
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
          {summaryLoading ? (
            <Skeleton variant='text' width='85%' height={24} animation='wave' />
          ) : (
            <Typography variant='body2' color='text.secondary'>
              Total value {formatPKR(totals.totalValue)} · {totals.totalUnits.toLocaleString('en-PK')} units ·{' '}
              {totals.uniqueProducts} products
            </Typography>
          )}

          {summaryLoading && detailLoading ? (
            <>
              <div className='flex flex-wrap gap-3 mbe-2'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant='rounded' width={110} height={100} animation='wave' />
                ))}
              </div>
              <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
            </>
          ) : (
            <TabContext value={tab}>
              <TabList
                variant='scrollable'
                scrollButtons='auto'
                onChange={handleTab}
                aria-label='inventory chart tabs'
                className='!border-0 mbe-4'
                sx={{
                  minHeight: 0,
                  '& .MuiTabs-indicator': { display: 'none !important' },
                  '& .MuiTab-root': { padding: '0 !important', border: '0 !important', minHeight: 0 }
                }}
              >
                {tabDefs.map(def => (
                  <Tab
                    key={def.id}
                    value={def.id}
                    className={isCompact ? 'mie-2' : 'mie-4'}
                    label={
                      <Box
                        className={classnames(
                          'flex flex-col items-center justify-center gap-1.5 border rounded-xl',
                          tab === def.id
                            ? 'border-solid border-[var(--mui-palette-primary-main)]'
                            : 'border-dashed'
                        )}
                        sx={{
                          width: { xs: 96, sm: 110 },
                          minHeight: { xs: 86, sm: 100 },
                          px: 0.5,
                          py: 1
                        }}
                      >
                        <CustomAvatar
                          variant='rounded'
                          skin='light'
                          size={isCompact ? 34 : 38}
                          {...(tab === def.id && { color: 'primary' })}
                        >
                          <i
                            className={classnames(isCompact ? 'text-[20px]' : 'text-[22px]', def.icon, {
                              'text-textSecondary': tab !== def.id
                            })}
                          />
                        </CustomAvatar>
                        <Typography
                          variant='caption'
                          className='font-medium text-center leading-tight'
                          color='text.primary'
                          sx={{ fontSize: isCompact ? '0.7rem' : '0.8125rem' }}
                        >
                          {def.title}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </TabList>

              <TabPanel value='value' className='!p-0' sx={{ pt: 0.5 }}>
                {summaryLoading ? (
                  <Skeleton
                    variant='rounded'
                    width='100%'
                    height={barHeight(Math.max(byValue.length, 1))}
                    animation='wave'
                  />
                ) : valueSeries[0]?.data?.some((n: number) => n > 0) ? (
                  <ResponsiveChartWrapper minHeight={barHeight(byValue.length)}>
                    <AppReactApexCharts
                      type='bar'
                      height={barHeight(byValue.length)}
                      width='100%'
                      options={valueOptions}
                      series={valueSeries}
                    />
                  </ResponsiveChartWrapper>
                ) : (
                  <Typography color='text.secondary'>No product summary to chart.</Typography>
                )}
              </TabPanel>
              <TabPanel value='quantity' className='!p-0' sx={{ pt: 0.5 }}>
                {summaryLoading ? (
                  <Skeleton
                    variant='rounded'
                    width='100%'
                    height={barHeight(Math.max(byQty.length, 1))}
                    animation='wave'
                  />
                ) : qtySeries[0]?.data?.some((n: number) => n > 0) ? (
                  <ResponsiveChartWrapper minHeight={barHeight(byQty.length)}>
                    <AppReactApexCharts
                      type='bar'
                      height={barHeight(byQty.length)}
                      width='100%'
                      options={qtyOptions}
                      series={qtySeries}
                    />
                  </ResponsiveChartWrapper>
                ) : (
                  <Typography color='text.secondary'>No product summary to chart.</Typography>
                )}
              </TabPanel>
              <TabPanel value='distributor' className='!p-0' sx={{ pt: 0.5 }}>
                {detailLoading ? (
                  <Skeleton
                    variant='rounded'
                    width='100%'
                    height={barHeight(Math.max(distributorAgg.length, 1))}
                    animation='wave'
                  />
                ) : distSeries[0]?.data?.some((n: number) => n > 0) ? (
                  <ResponsiveChartWrapper minHeight={barHeight(distributorAgg.length)}>
                    <AppReactApexCharts
                      type='bar'
                      height={barHeight(distributorAgg.length)}
                      width='100%'
                      options={distOptions}
                      series={distSeries}
                    />
                  </ResponsiveChartWrapper>
                ) : (
                  <Typography color='text.secondary'>No distributor-level stock rows.</Typography>
                )}
              </TabPanel>
            </TabContext>
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}

export default InventoryDashboardCharts
