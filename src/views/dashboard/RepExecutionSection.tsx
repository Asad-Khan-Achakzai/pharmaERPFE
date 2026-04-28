'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import { showApiError } from '@/utils/apiErrors'
import { planItemsService } from '@/services/planItems.service'
import { targetsService } from '@/services/targets.service'
import SectionHeader from './SectionHeader'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const currentMonthYyyyMm = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type PlanItemRow = {
  _id: string
  type?: string
  title?: string
  doctorId?: { name?: string; specialization?: string } | null
  weeklyPlanId?: { weekStartDate?: string; weekEndDate?: string; status?: string } | null
}

type MedRepTarget = {
  month: string
  salesTarget: number
  achievedSales: number
  packsTarget: number
  achievedPacks: number
}

export type RepExecutionPrefetch = {
  planItems: PlanItemRow[]
  monthTarget: MedRepTarget | null
}

const RepExecutionSection = memo(function RepExecutionSection({
  repUserId,
  canViewTargets,
  /** When set (e.g. from GET /dashboard/home), skip client fetches for plan + targets */
  prefetch,
  showPlan = true,
  showTargets = true
}: {
  repUserId: string
  canViewTargets: boolean
  prefetch?: RepExecutionPrefetch | null
  showPlan?: boolean
  showTargets?: boolean
}) {
  const [planLoading, setPlanLoading] = useState(() => Boolean(showPlan && prefetch == null))
  const [planItems, setPlanItems] = useState<PlanItemRow[]>(() => prefetch?.planItems ?? [])
  const [targetLoading, setTargetLoading] = useState(() => (prefetch != null ? false : canViewTargets))
  const [monthTarget, setMonthTarget] = useState<MedRepTarget | null>(() => prefetch?.monthTarget ?? null)

  useEffect(() => {
    if (prefetch) {
      if (showPlan) setPlanItems(prefetch.planItems)
      if (showTargets) setMonthTarget(prefetch.monthTarget)
      if (showPlan) setPlanLoading(false)
      if (showTargets) setTargetLoading(false)
    }
  }, [prefetch, showPlan, showTargets])

  useEffect(() => {
    if (prefetch || !showPlan) {
      if (!showPlan) setPlanLoading(false)
      return
    }
    let cancel = false
    setPlanLoading(true)
    ;(async () => {
      try {
        const r = await planItemsService.listToday()
        if (cancel) return
        const list = (r.data as { data?: PlanItemRow[] })?.data
        setPlanItems(Array.isArray(list) ? list : [])
      } catch (e) {
        if (!cancel) {
          showApiError(e, 'Could not load today’s plan')
          setPlanItems([])
        }
      } finally {
        if (!cancel) setPlanLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [prefetch, repUserId, showPlan])

  useEffect(() => {
    if (prefetch || !showTargets) {
      if (!showTargets) setTargetLoading(false)
      return
    }
    if (!canViewTargets || !repUserId) {
      setMonthTarget(null)
      return
    }
    let cancel = false
    setTargetLoading(true)
    const yyyymm = currentMonthYyyyMm()
    ;(async () => {
      try {
        const r = await targetsService.getByRep(repUserId)
        if (cancel) return
        const raw = (r.data as { data?: MedRepTarget[] | MedRepTarget })?.data
        const rows = Array.isArray(raw) ? raw : raw ? [raw] : []
        const match = rows.find(t => t.month === yyyymm) ?? rows[0] ?? null
        setMonthTarget(match)
      } catch (e) {
        if (!cancel) setMonthTarget(null)
      } finally {
        if (!cancel) setTargetLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [prefetch, canViewTargets, repUserId, showTargets])

  const pendingCount = planItems.length
  const salesProgress = useMemo(() => {
    if (!monthTarget) return 0
    const t = Number(monthTarget.salesTarget) || 0
    if (t <= 0) return 0
    return Math.min(100, (Number(monthTarget.achievedSales) / t) * 100)
  }, [monthTarget])
  const packsProgress = useMemo(() => {
    if (!monthTarget) return 0
    const t = Number(monthTarget.packsTarget) || 0
    if (t <= 0) return 0
    return Math.min(100, (Number(monthTarget.achievedPacks) / t) * 100)
  }, [monthTarget])

  if (showPlan && planLoading) {
    return (
      <Grid size={{ xs: 12 }}>
        <Card variant='outlined' sx={{ borderRadius: 3 }}>
          <CardContent>
            <Skeleton width='40%' height={28} />
            <Skeleton width='100%' height={80} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      </Grid>
    )
  }

  if (!showPlan && showTargets && targetLoading) {
    return (
      <Grid size={{ xs: 12 }}>
        <Card variant='outlined' sx={{ borderRadius: 3 }}>
          <CardContent>
            <Skeleton width='50%' height={28} />
            <Skeleton width='100%' height={100} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      </Grid>
    )
  }

  if (!showPlan && !showTargets) {
    return null
  }

  return (
    <Grid size={{ xs: 12 }}>
      <Stack spacing={2.5}>
        {showPlan ? (
        <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
          <CardHeader
            title='Today’s plan'
            subheader={
              pendingCount === 0
                ? 'No pending visits scheduled for today.'
                : `${pendingCount} visit${pendingCount === 1 ? '' : 's'} pending — mark them as you go.`
            }
            action={
              <Button
                size='small'
                component={Link}
                href='/visits/today'
                variant='contained'
                endIcon={<i className='tabler-arrow-right' />}
              >
                Open visits
              </Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {planItems.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                You’re all caught up for today, or your weekly plan has no items on this date. You can open{' '}
                <Link href='/weekly-plans' className='text-primary no-underline hover:underline'>
                  Weekly plans
                </Link>{' '}
                to adjust.
              </Typography>
            ) : (
              <Stack component='ul' sx={{ listStyle: 'none', p: 0, m: 0, gap: 1.25 }}>
                {planItems.slice(0, 6).map(item => {
                  const label =
                    item.type === 'OTHER_TASK' && item.title
                      ? item.title
                      : item.doctorId?.name
                        ? `${item.doctorId.name}${item.doctorId.specialization ? ` · ${item.doctorId.specialization}` : ''}`
                        : 'Visit'
                  return (
                    <Box
                      key={item._id}
                      component='li'
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        border: '1px solid var(--mui-palette-divider)',
                        bgcolor: 'action.hover'
                      }}
                    >
                      <Typography variant='body2' fontWeight={600} noWrap title={label}>
                        {label}
                      </Typography>
                    </Box>
                  )
                })}
                {planItems.length > 6 ? (
                  <Typography variant='caption' color='text.secondary'>
                    +{planItems.length - 6} more on the visits page
                  </Typography>
                ) : null}
              </Stack>
            )}
          </CardContent>
        </Card>
        ) : null}

        {showTargets && canViewTargets ? (
          <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <SectionHeader
                title='This month’s targets'
                subtitle={targetLoading ? 'Loading…' : monthTarget ? `Month ${monthTarget.month}` : 'No target row for this month yet.'}
                action={
                  <Button size='small' component={Link} href='/targets' color='primary'>
                    Details
                  </Button>
                }
              />
              {targetLoading ? (
                <Skeleton variant='rounded' height={100} />
              ) : monthTarget ? (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant='caption' color='text.secondary'>
                        Sales
                      </Typography>
                      <Typography variant='caption' fontWeight={600}>
                        {formatPKR(Number(monthTarget.achievedSales))} / {formatPKR(Number(monthTarget.salesTarget))}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant='determinate'
                      value={Number.isFinite(salesProgress) ? salesProgress : 0}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant='caption' color='text.secondary'>
                        Packs
                      </Typography>
                      <Typography variant='caption' fontWeight={600}>
                        {Number(monthTarget.achievedPacks) || 0} / {Number(monthTarget.packsTarget) || 0}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant='determinate'
                      color='secondary'
                      value={Number.isFinite(packsProgress) ? packsProgress : 0}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </Grid>
  )
})

export default RepExecutionSection
