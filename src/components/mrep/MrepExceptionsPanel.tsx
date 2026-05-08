'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'

export type OverviewRep = {
  repId: string
  name?: string | null
  coverage?: { coveragePercent?: number | null; doctorsTracked?: number | null }
  planExecution?: {
    missed?: number
    unplannedRatio?: number | null
    visited?: number
    outOfOrderVisited?: number
    adherencePercent?: number | null
  }
}

export type PendingApprovalPlan = {
  _id: string
  weekStart?: string
  medicalRepId?: { name?: string } | string
}

type Props = {
  month: string
  overviewByRepId: Map<string, OverviewRep>
  deviationReps: Array<{
    repId: string
    name?: string | null
    planExecution?: OverviewRep['planExecution']
  }>
  pendingPlans?: PendingApprovalPlan[] | null
  loading?: boolean
  /** When false, hides the “Full list” button (e.g. on `/dashboard/mrep/exceptions`). */
  showFullListButton?: boolean
}

const LOW_COVERAGE_PCT = 60
const HIGH_MISSED = 5
const HIGH_UNPLANNED_PCT = 25
const LOW_ADHERENCE_PCT = 70

export function MrepExceptionsPanel({
  month,
  overviewByRepId,
  deviationReps,
  pendingPlans,
  loading,
  showFullListButton = true
}: Props) {
  const items = useMemo(() => {
    const rows: Array<{
      key: string
      severity: 'warning' | 'error' | 'info'
      title: string
      subtitle: string
      repId?: string
      href?: string
    }> = []

    if (pendingPlans?.length) {
      rows.push({
        key: 'pending-approvals',
        severity: 'warning',
        title: `${pendingPlans.length} weekly plan(s) awaiting approval`,
        subtitle: 'Review and approve or reject submitted plans.',
        href: '/weekly-plans'
      })
    }

    for (const r of deviationReps) {
      const o = overviewByRepId.get(r.repId)
      const label = r.name || o?.name || 'Rep'
      const cov = o?.coverage?.coveragePercent
      const pe = r.planExecution || o?.planExecution
      const missed = pe?.missed ?? 0
      const unplanned = pe?.unplannedRatio
      const visited = pe?.visited ?? 0
      const outOrd = pe?.outOfOrderVisited ?? 0
      const adherence = pe?.adherencePercent

      if (cov != null && cov < LOW_COVERAGE_PCT) {
        rows.push({
          key: `low-cov-${r.repId}`,
          severity: 'error',
          title: `${label}: low team coverage (${cov}%)`,
          subtitle: 'Coverage vs monthly doctor targets (current month).',
          repId: r.repId,
          href: `/doctors/list?assignedRepId=${encodeURIComponent(r.repId)}`
        })
      }

      if (missed >= HIGH_MISSED) {
        rows.push({
          key: `missed-${r.repId}`,
          severity: 'warning',
          title: `${label}: high missed route items (${missed})`,
          subtitle: 'Planned doctor visits marked missed this month.',
          repId: r.repId,
          href: `/weekly-plans?medicalRepId=${encodeURIComponent(r.repId)}`
        })
      }

      if (unplanned != null && unplanned >= HIGH_UNPLANNED_PCT) {
        rows.push({
          key: `unplanned-${r.repId}`,
          severity: 'warning',
          title: `${label}: high unplanned visits (${unplanned}%)`,
          subtitle: 'Share of completed visits that were unplanned.',
          repId: r.repId,
          href: `/dashboard/manager?repId=${encodeURIComponent(r.repId)}`
        })
      }

      if (visited > 0 && outOrd / visited > 0.3) {
        rows.push({
          key: `oos-${r.repId}`,
          severity: 'info',
          title: `${label}: many out-of-sequence visits`,
          subtitle: 'Route discipline may need coaching.',
          repId: r.repId,
          href: `/dashboard/manager?repId=${encodeURIComponent(r.repId)}`
        })
      }

      if (adherence != null && adherence < LOW_ADHERENCE_PCT && visited > 2) {
        rows.push({
          key: `adh-${r.repId}`,
          severity: 'info',
          title: `${label}: low in-sequence adherence (${adherence}%)`,
          subtitle: 'Planned visits completed in order.',
          repId: r.repId,
          href: `/dashboard/manager?repId=${encodeURIComponent(r.repId)}`
        })
      }
    }

    return rows
  }, [deviationReps, overviewByRepId, pendingPlans])

  return (
    <Card variant='outlined'>
      <CardHeader
        title='Action center'
        subheader={`Exceptions & flags · ${month} · Thresholds are UI hints only`}
        action={
          showFullListButton ? (
            <Button component={Link} href='/dashboard/mrep/exceptions' size='small' variant='text'>
              Full list
            </Button>
          ) : null
        }
      />
      <Divider />
      <CardContent sx={{ pt: 2 }}>
        {loading ? (
          <Typography color='text.secondary'>Loading…</Typography>
        ) : items.length === 0 ? (
          <Typography color='text.secondary'>No exceptions matched this month. Good discipline.</Typography>
        ) : (
          <List dense disablePadding>
            {items.map((it, i) => (
              <div key={it.key}>
                {i > 0 ? <Divider component='li' /> : null}
                <ListItem
                  secondaryAction={
                    it.href ? (
                      <Button component={Link} href={it.href} size='small' variant='outlined'>
                        Open
                      </Button>
                    ) : null
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction='row' spacing={1} alignItems='center'>
                        <Chip size='small' label={it.severity} color={it.severity === 'error' ? 'error' : 'default'} />
                        <Typography variant='body2' fontWeight={600}>
                          {it.title}
                        </Typography>
                      </Stack>
                    }
                    secondary={it.subtitle}
                  />
                </ListItem>
              </div>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  )
}
