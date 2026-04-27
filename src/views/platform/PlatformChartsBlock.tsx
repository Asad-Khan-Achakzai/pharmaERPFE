'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from '@mui/material/styles'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import type { ApexOptions } from 'apexcharts'

import type { PlatformCompanyRow } from '@/types/platformDashboard'
import type { RevenueViewMode } from './PlatformFilterToolbar'
import ResponsiveChartWrapper from '@/views/dashboard/ResponsiveChartWrapper'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const trunc = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

type PlatformChartsBlockProps = {
  dates: string[]
  dayTotals: number[]
  byCompany: Record<string, number[]>
  viewMode: RevenueViewMode
  topCompanies: PlatformCompanyRow[]
  ordersBar: { name: string; orders: number }[]
  mixLabels: string[]
  mixValues: number[]
  exposureLabels: string[]
  exposureValues: number[]
  loading?: boolean
}

const PlatformChartsBlock = ({
  dates,
  dayTotals,
  byCompany,
  viewMode,
  topCompanies,
  ordersBar,
  mixLabels,
  mixValues,
  exposureLabels,
  exposureValues
}: PlatformChartsBlockProps) => {
  const th = useTheme()
  const palette = [
    th.palette.primary.main,
    th.palette.secondary.main,
    th.palette.info.main,
    th.palette.success.main,
    th.palette.warning.main
  ]

  const { lineOptions, lineSeries } = useMemo(() => {
    const base: ApexOptions = {
      chart: { id: 'platform-revenue', toolbar: { show: true }, zoom: { enabled: true }, fontFamily: th.typography.fontFamily },
      dataLabels: { enabled: false },
      xaxis: {
        categories: dates,
        labels: { rotate: -45, rotateAlways: dates.length > 14 }
      },
      yaxis: { labels: { formatter: (v: number) => `₨ ${(v / 1000).toFixed(0)}k` } },
      legend: { position: 'bottom', fontSize: '12px' },
      tooltip: {
        y: { formatter: (v: number) => `₨ ${v.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` }
      },
      grid: { strokeDashArray: 4, borderColor: th.palette.divider }
    }

    if (viewMode === 'total') {
      return {
        lineSeries: [{ name: 'Total Revenue', data: dayTotals.map(x => x) }],
        lineOptions: {
          ...base,
          colors: [th.palette.primary.main],
          stroke: { width: 2, curve: 'smooth' }
        } as ApexOptions
      }
    }

    const max = 5
    const pick = topCompanies.slice(0, max)
    const companySeries = pick.map(c => ({
      name: trunc(c.name, 20),
      data: (byCompany[c.companyId] || new Array(dates.length).fill(0)).map(x => x)
    }))
    const totalFirst = { name: 'Total (All Companies)', data: dayTotals.map(x => x) }
    const series = [totalFirst, ...companySeries]
    const nCompany = companySeries.length
    const width = [4, ...Array(Math.max(0, nCompany)).fill(2)]
    const dashArray: number[] = [8, ...Array(Math.max(0, nCompany)).fill(0)]
    const totalLineColor = th.palette.mode === 'dark' ? th.palette.grey[200] : th.palette.grey[800]
    const lineColors = [totalLineColor, ...palette.slice(0, nCompany)]

    return {
      lineSeries: series,
      lineOptions: {
        ...base,
        colors: lineColors,
        stroke: { width, dashArray, curve: 'smooth' }
      } as ApexOptions
    }
  }, [viewMode, dayTotals, topCompanies, byCompany, dates, th, palette])

  const barOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: th.typography.fontFamily },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%', distributed: true } },
      xaxis: { categories: ordersBar.map(o => trunc(o.name, 12)), labels: { rotate: -35 } },
      yaxis: { title: { text: 'Orders' } },
      dataLabels: { enabled: true },
      colors: palette,
      legend: { show: false },
      grid: { strokeDashArray: 4, borderColor: th.palette.divider },
      tooltip: { y: { formatter: (v: number) => String(Math.round(v)) } }
    }),
    [ordersBar, th, palette]
  )

  const buildDonut = (labels: string[], values: number[]) => ({
    options: {
      chart: { type: 'donut' as const, fontFamily: th.typography.fontFamily },
      labels,
      legend: { position: 'bottom' as const, fontSize: '11px' },
      dataLabels: { enabled: true },
      plotOptions: { pie: { donut: { size: '68%' } } },
      colors: [th.palette.primary.main, th.palette.secondary.main, th.palette.info.main, th.palette.warning.main],
      tooltip: { y: { formatter: (v: number) => `₨ ${v.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` } }
    } as ApexOptions,
    series: values.map(v => Math.max(0, v))
  })

  const mix = useMemo(() => buildDonut(mixLabels, mixValues), [mixLabels, mixValues, th])
  const exp = useMemo(() => buildDonut(exposureLabels, exposureValues), [exposureLabels, exposureValues, th])

  return (
    <Grid container spacing={3} component='section' role='region' aria-label='Platform charts'>
      {dates.length > 0 ? (
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card variant='outlined' className='h-full' sx={t => ({ boxShadow: t.shadows[0] })}>
            <CardHeader
              title='Revenue trend'
              subheader={
                viewMode === 'total'
                  ? 'Single series: total posted revenue for your selection per day.'
                  : 'Dashed, thicker “Total (All Companies)” line plus up to five company lines. Same numbers when one company: total + company for clarity.'
              }
            />
            <CardContent>
              <ResponsiveChartWrapper minHeight={340}>
                <AppReactApexCharts type='line' height={340} options={lineOptions} series={lineSeries} />
              </ResponsiveChartWrapper>
            </CardContent>
          </Card>
        </Grid>
      ) : null}
      {ordersBar.length > 0 ? (
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant='outlined' className='h-full' sx={t => ({ boxShadow: t.shadows[0] })}>
            <CardHeader title='Orders by company' subheader='Count in selected date range' />
            <CardContent>
              <ResponsiveChartWrapper minHeight={320}>
                <AppReactApexCharts
                  type='bar'
                  height={320}
                  options={barOptions}
                  series={[{ name: 'Orders', data: ordersBar.map(o => o.orders) }]}
                />
              </ResponsiveChartWrapper>
            </CardContent>
          </Card>
        </Grid>
      ) : null}
      {mixValues.some(v => v > 0) ? (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant='outlined' className='h-full' sx={t => ({ boxShadow: t.shadows[0] })}>
            <CardHeader title='Revenue share' subheader='Split of period revenue in current selection' />
            <CardContent>
              <ResponsiveChartWrapper minHeight={300}>
                <AppReactApexCharts type='donut' height={300} options={mix.options} series={mix.series} />
              </ResponsiveChartWrapper>
            </CardContent>
          </Card>
        </Grid>
      ) : null}
      {exposureValues.some(v => v > 0) ? (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant='outlined' className='h-full' sx={t => ({ boxShadow: t.shadows[0] })}>
            <CardHeader title='Outstanding snapshot' subheader='Point-in-time; not period-filtered' />
            <CardContent>
              <ResponsiveChartWrapper minHeight={300}>
                <AppReactApexCharts type='donut' height={300} options={exp.options} series={exp.series} />
              </ResponsiveChartWrapper>
            </CardContent>
          </Card>
        </Grid>
      ) : null}
    </Grid>
  )
}

export default PlatformChartsBlock
