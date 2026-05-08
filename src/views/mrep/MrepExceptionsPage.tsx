'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { showApiError } from '@/utils/apiErrors'
import { MrepExceptionsPanel, type OverviewRep } from '@/components/mrep/MrepExceptionsPanel'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MrepExceptionsPage() {
  const { hasPermission } = useAuth()
  const canSee = useMemo(
    () =>
      hasPermission('weeklyPlans.view') ||
      hasPermission('weeklyPlans.markVisit') ||
      hasPermission('team.viewAllReports') ||
      hasPermission('admin.access'),
    [hasPermission]
  )
  const canSeeApprovals = hasPermission('weeklyPlans.review') || hasPermission('admin.access')

  const [month, setMonth] = useState(ymNow)
  const [loading, setLoading] = useState(true)
  const [overviewReps, setOverviewReps] = useState<OverviewRep[]>([])
  const [deviationReps, setDeviationReps] = useState<
    Array<{ repId: string; name?: string | null; planExecution?: OverviewRep['planExecution'] }>
  >([])
  const [pendingPlans, setPendingPlans] = useState<any[] | null>(null)

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const [ov, dev, pend] = await Promise.all([
        reportsService.mrepMonthlyOverview({ params: { month } }),
        reportsService.mrepDeviationSummary({ month }),
        canSeeApprovals ? weeklyPlansService.pendingApprovals().catch(() => ({ data: { data: [] } })) : Promise.resolve(null)
      ])

      const reps = (ov.data as any)?.data?.reps ?? (ov.data as any)?.reps ?? []
      setOverviewReps(Array.isArray(reps) ? reps : [])

      const dr = (dev.data as any)?.data?.reps ?? (dev.data as any)?.reps ?? []
      setDeviationReps(Array.isArray(dr) ? dr : [])

      if (pend && (pend as any).data) {
        const raw = (pend as any).data?.data ?? (pend as any).data
        setPendingPlans(Array.isArray(raw) ? raw : [])
      } else {
        setPendingPlans(null)
      }
    } catch (e) {
      showApiError(e, 'Could not load exceptions')
      setOverviewReps([])
      setDeviationReps([])
      setPendingPlans(null)
    } finally {
      setLoading(false)
    }
  }, [canSee, month, canSeeApprovals])

  useEffect(() => {
    void load()
  }, [load])

  const overviewByRepId = useMemo(() => {
    const m = new Map<string, OverviewRep>()
    for (const r of overviewReps) {
      if (r.repId) m.set(String(r.repId), r)
    }
    return m
  }, [overviewReps])

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
            <Typography variant='h4'>MRep exceptions</Typography>
            <Typography variant='body2' color='text.secondary'>
              Full action-center list from deviation summary + monthly overview. Thresholds are UI hints only.
            </Typography>
          </div>
          <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
            <Button component={Link} href='/dashboard/mrep' variant='outlined' size='small'>
              Command center
            </Button>
            <TextField
              label='Month'
              type='month'
              size='small'
              value={month}
              onChange={e => setMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12 }}>
        {loading ? (
          <Skeleton variant='rounded' height={320} />
        ) : (
          <MrepExceptionsPanel
            month={month}
            overviewByRepId={overviewByRepId}
            deviationReps={deviationReps}
            pendingPlans={pendingPlans}
            loading={loading}
            showFullListButton={false}
          />
        )}
      </Grid>
    </Grid>
  )
}
