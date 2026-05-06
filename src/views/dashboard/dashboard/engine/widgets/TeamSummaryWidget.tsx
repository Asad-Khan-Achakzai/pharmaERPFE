'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import { dashboardService } from '@/services/dashboard.service'
import { showApiError } from '@/utils/apiErrors'

type TeamSummary = {
  teamSize: number
  activeReps: number
  today: {
    date: string
    visited: number
    missed: number
    pending: number
    total: number
    coveragePercent: number
    outOfSequenceCount: number
    unplannedCount: number
  }
  pendingApprovalsCount: number
}

const StatBlock = ({
  label,
  value,
  hint,
  tone = 'default'
}: {
  label: string
  value: number | string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'error'
}) => {
  const colorMap: Record<string, string> = {
    default: 'text.primary',
    success: 'success.main',
    warning: 'warning.main',
    error: 'error.main'
  }
  return (
    <Stack spacing={0.5}>
      <Typography variant='caption' color='text.secondary' textTransform='uppercase' letterSpacing={0.5}>
        {label}
      </Typography>
      <Typography variant='h4' sx={{ color: colorMap[tone], lineHeight: 1.1, fontWeight: 700 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant='caption' color='text.secondary'>
          {hint}
        </Typography>
      ) : null}
    </Stack>
  )
}

/**
 * Manager rollup of subtree visit progress + pending approvals (Phase 2C).
 * Self-fetching — does not require orchestrator wiring; gated via `team.view` in the registry.
 */
export function TeamSummaryWidget() {
  const [data, setData] = useState<TeamSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const r = await dashboardService.teamSummary()
        if (!cancelled) setData(r.data.data || null)
      } catch (e) {
        if (!cancelled) showApiError(e, 'Failed to load team summary')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardContent>
          <Skeleton width='40%' height={28} />
          <Skeleton width='100%' height={120} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    )
  }
  if (!data) return null

  const { today, pendingApprovalsCount, teamSize, activeReps } = data
  const coverage = today.coveragePercent

  return (
    <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
      <CardHeader
        title='Team summary'
        subheader={
          <Stack direction='row' spacing={1} alignItems='center' useFlexGap flexWrap='wrap'>
            <Typography variant='body2' color='text.secondary'>
              {today.date} · {activeReps} active rep{activeReps === 1 ? '' : 's'} of {teamSize}
            </Typography>
            {pendingApprovalsCount > 0 && (
              <Chip
                size='small'
                color='warning'
                variant='tonal'
                label={`${pendingApprovalsCount} plan${pendingApprovalsCount === 1 ? '' : 's'} pending approval`}
              />
            )}
          </Stack>
        }
        action={
          pendingApprovalsCount > 0 ? (
            <Button component={Link} href='/weekly-plans' size='small' variant='outlined'>
              Review plans
            </Button>
          ) : undefined
        }
      />
      <CardContent>
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2' color='text.secondary'>
              Today's coverage
            </Typography>
            <Typography variant='body2' fontWeight={600}>
              {coverage}%
            </Typography>
          </Stack>
          <LinearProgress
            value={Math.min(100, Math.max(0, coverage))}
            variant='determinate'
            sx={{ height: 8, borderRadius: 4 }}
            color={coverage >= 75 ? 'success' : coverage >= 40 ? 'warning' : 'error'}
          />
        </Stack>

        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatBlock
              label='Visited'
              value={today.visited}
              hint={`of ${today.total}`}
              tone='success'
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatBlock
              label='Missed'
              value={today.missed}
              tone={today.missed > 0 ? 'error' : 'default'}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatBlock label='Pending' value={today.pending} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatBlock
              label='Unplanned'
              value={today.unplannedCount}
              hint={today.outOfSequenceCount ? `${today.outOfSequenceCount} out of sequence` : undefined}
              tone={today.unplannedCount > 0 ? 'warning' : 'default'}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

export default TeamSummaryWidget
