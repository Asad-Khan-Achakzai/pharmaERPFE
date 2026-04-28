'use client'

import { useMemo } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Link from 'next/link'
import { useDashboardV3Data } from '../../core/dashboardDataOrchestrator'

export function OrdersStatusWidget() {
  const d = useDashboardV3Data()
  const kpi = d.kpi as { ordersByStatus?: Record<string, number> } | null

  const entries = useMemo(() => {
    const o = kpi?.ordersByStatus
    if (!o || typeof o !== 'object') return []
    return Object.entries(o).filter(([, n]) => Number(n) > 0)
  }, [kpi])

  if (d.kpiLoading && !kpi) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardHeader title='Orders' subheader='Loading…' />
      </Card>
    )
  }

  if (entries.length === 0) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardHeader title='Orders' subheader='Open the orders list for your pipeline.' />
        <CardContent>
          <Button component={Link} href='/orders/list' variant='outlined' size='small'>
            Go to orders
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
      <CardHeader
        title='Orders'
        subheader='Counts by status (from dashboard metrics).'
        action={
          <Button component={Link} href='/orders/list' size='small' variant='text'>
            View all
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack direction='row' flexWrap='wrap' gap={1}>
          {entries.map(([status, count]) => (
            <Typography key={status} variant='body2' color='text.secondary'>
              <strong>{status}</strong>: {count}
            </Typography>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
