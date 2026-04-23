'use client'

import { memo, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import type { ApexOptions } from 'apexcharts'
import { useTheme } from '@mui/material/styles'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false, loading: () => null })

const SPARK = 6

const buildSeries = (v: number) => {
  const a = Math.max(Math.abs(v), 0.0001)
  return [a * 0.72, a * 0.78, a * 0.85, a * 0.9, a * 0.96, a]
}

type DashboardMiniLineKpiProps = {
  title: string
  subheader: string
  valueLabel: string
  /** Single numeric driver for a compact spark (same sign as the metric). */
  value: number
  /** Right label — real derived text only (e.g. margin % from existing fields). */
  deltaLabel: string
  /** Theme color for stroke */
  colorKey: 'primary' | 'success' | 'info' | 'warning' | 'error'
}

const DashboardMiniLineKpi = memo(function DashboardMiniLineKpi({
  title,
  subheader,
  valueLabel,
  value,
  deltaLabel,
  colorKey
}: DashboardMiniLineKpiProps) {
  const theme = useTheme()
  const stroke = theme.palette[colorKey].main
  const series = useMemo(() => [{ data: buildSeries(value) }], [value])

  const options: ApexOptions = useMemo(() => {
    return {
      chart: {
        parentHeightOffset: 0,
        toolbar: { show: false }
      },
      tooltip: { enabled: false },
      grid: {
        strokeDashArray: 6,
        borderColor: 'var(--mui-palette-divider)',
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: false } },
        padding: { top: -8, left: 0, right: 8, bottom: 6 }
      },
      stroke: { width: 3, lineCap: 'butt', curve: 'smooth' as const },
      colors: [stroke],
      markers: {
        size: 3,
        strokeWidth: 2,
        colors: stroke,
        strokeColors: 'transparent',
        hover: { size: 4 }
      },
      xaxis: {
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        labels: { show: false }
      }
    }
  }, [stroke])

  return (
    <Card className='h-full' sx={{ boxShadow: 'var(--shadow-xs)' }}>
      <CardHeader title={title} subheader={subheader} className='pbe-0' titleTypographyProps={{ variant: 'subtitle1' }} />
      <CardContent className='flex flex-col' sx={{ gap: 0.5, pt: 0 }}>
        <div className='min-bs-[90px] flex items-center justify-center mbe-1'>
          <AppReactApexCharts type='line' height={98} width='100%' options={options} series={series} />
        </div>
        <div className='flex items-center justify-between flex-wrap gap-x-3 gap-y-0.5'>
          <Typography variant='h4' color='text.primary' className='text-lg sm:text-2xl font-semibold' sx={{ lineHeight: 1.2 }}>
            {valueLabel}
          </Typography>
          <Typography variant='body2' color='text.secondary' className='text-end max-is-[50%]'>
            {deltaLabel}
          </Typography>
        </div>
      </CardContent>
    </Card>
  )
})

export default DashboardMiniLineKpi
