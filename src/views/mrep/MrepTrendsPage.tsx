'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import { showApiError } from '@/utils/apiErrors'

type RepPoint = {
  repId?: string
  coverage?: { coveragePercent?: number | null }
  planExecution?: { visitCompletionPercent?: number | null }
  ordersInPeriod?: { grossRevenue?: number; orderCount?: number }
}

const pct = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`)

const fmtPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function MrepTrendsPage() {
  const { hasPermission } = useAuth()
  const canSee = useMemo(
    () =>
      hasPermission('weeklyPlans.view') ||
      hasPermission('weeklyPlans.markVisit') ||
      hasPermission('team.viewAllReports') ||
      hasPermission('admin.access'),
    [hasPermission]
  )

  const [loading, setLoading] = useState(true)
  const [trends, setTrends] = useState<{
    months?: string[]
    points?: { month: string; reps: RepPoint[] }[]
  } | null>(null)

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const tr = await reportsService.mrepTrends({ months: 6 })
      const trd = (tr.data as any)?.data ?? tr.data
      setTrends(trd && typeof trd === 'object' ? trd : null)
    } catch (e) {
      showApiError(e, 'Could not load trends')
      setTrends(null)
    } finally {
      setLoading(false)
    }
  }, [canSee])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const pts = trends?.points
    if (!Array.isArray(pts)) return []
    return pts.map(pt => {
      const reps = Array.isArray(pt.reps) ? pt.reps : []
      const n = reps.length
      if (!n) {
        return { month: pt.month, avgCoverage: null as number | null, avgVisit: null as number | null, revenue: 0 }
      }
      let c = 0
      let cn = 0
      let v = 0
      let vn = 0
      let rev = 0
      for (const r of reps) {
        const cov = r.coverage?.coveragePercent
        if (cov != null) {
          c += Number(cov)
          cn += 1
        }
        const vc = r.planExecution?.visitCompletionPercent
        if (vc != null) {
          v += Number(vc)
          vn += 1
        }
        rev += Number(r.ordersInPeriod?.grossRevenue || 0)
      }
      return {
        month: pt.month,
        avgCoverage: cn ? Math.round(c / cn) : null,
        avgVisit: vn ? Math.round(v / vn) : null,
        revenue: rev
      }
    })
  }, [trends])

  if (!canSee) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Typography color='text.secondary'>You don’t have access to this page.</Typography>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent='space-between'>
          <div>
            <Typography variant='h4'>MRep trends</Typography>
            <Typography variant='body2' color='text.secondary'>
              Team-aggregated coverage, visit completion, and revenue by month (same series as monthly overview).
            </Typography>
          </div>
          <Button component={Link} href='/dashboard/mrep' variant='outlined' size='small'>
            Command center
          </Button>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Card variant='outlined'>
          <CardHeader title='Month-over-month (team roll-up)' subheader='Averages are unweighted across reps in scope' />
          <CardContent>
            {loading ? (
              <Skeleton variant='rounded' height={260} />
            ) : rows.length === 0 ? (
              <Typography color='text.secondary'>No trend points returned.</Typography>
            ) : (
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell align='right'>Avg coverage %</TableCell>
                      <TableCell align='right'>Avg visit completion %</TableCell>
                      <TableCell align='right'>Team revenue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.month} hover>
                        <TableCell>{r.month}</TableCell>
                        <TableCell align='right'>{pct(r.avgCoverage)}</TableCell>
                        <TableCell align='right'>{pct(r.avgVisit)}</TableCell>
                        <TableCell align='right'>{fmtPKR(r.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
