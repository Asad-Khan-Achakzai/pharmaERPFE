'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { attendanceService } from '@/services/attendance.service'
import { showApiError } from '@/utils/apiErrors'
import type { AttendancePermissionFlags } from '@/views/attendance/attendancePermissions'
import { slaSummaryLine } from '@/utils/attendanceWorkflowUi'

type Props = {
  flags: AttendancePermissionFlags
  exceptions: any
  monitoring: any
  onOpenAdminTab: (tabIndex: number) => void
}

function MetricChips({
  items
}: {
  items: { label: string; value: string | number; color?: 'default' | 'warning' | 'error' | 'success' }[]
}) {
  return (
    <Stack direction='row' flexWrap='wrap' gap={1}>
      {items.map(it => (
        <Chip
          key={it.label}
          size='small'
          label={`${it.label}: ${it.value}`}
          variant={it.color === 'warning' || it.color === 'error' ? 'tonal' : 'outlined'}
          color={it.color === 'default' ? 'default' : it.color}
        />
      ))}
    </Stack>
  )
}

export default function AttendanceOperationsCenter({ flags, exceptions, monitoring, onOpenAdminTab }: Props) {
  const op = monitoring?.coverage?.operations
  const [govRows, setGovRows] = useState<any[]>([])
  const [govLoading, setGovLoading] = useState(false)

  const loadGov = useCallback(async () => {
    if (!flags.canGovernanceRequestQueue) return
    setGovLoading(true)
    try {
      const r = await attendanceService.governanceRequestQueue({ limit: 250, sort: 'oldest' })
      setGovRows(r.data?.data || [])
    } catch (e) {
      showApiError(e, 'Could not load approval queue for operations summary')
      setGovRows([])
    } finally {
      setGovLoading(false)
    }
  }, [flags.canGovernanceRequestQueue])

  useEffect(() => {
    void loadGov()
  }, [loadGov])

  const staleH = monitoring?.coverage?.staleHoursThreshold ?? 48
  const stuck = govRows.filter((r: any) => {
    const t = r.createdAt ? new Date(r.createdAt).getTime() : 0
    if (!t) return false
    return Date.now() - t > staleH * 3600000
  }).length

  const slaRisk = govRows.filter((r: any) => {
    if (!r.slaDueAt) return false
    const due = new Date(r.slaDueAt).getTime()
    if (due < Date.now()) return false
    return due - Date.now() < 45 * 60000
  }).length

  const quick = (
    <Stack direction='row' flexWrap='wrap' gap={1}>
      {flags.canGovernanceRequestQueue ? (
        <Button component={Link} href='/attendance/governance' size='small' variant='outlined'>
          Company approvals
        </Button>
      ) : null}
      {flags.canAccessTeam ? (
        <Button component={Link} href='/attendance/team' size='small' variant='outlined'>
          Team & inbox
        </Button>
      ) : null}
      <Button component={Link} href='/attendance/me' size='small' variant='outlined'>
        My workday
      </Button>
      {flags.canConfigureSchedules ? (
        <Button size='small' variant='outlined' onClick={() => onOpenAdminTab(1)}>
          Schedules
        </Button>
      ) : null}
      {flags.canConfigureSchedules ? (
        <Button size='small' variant='outlined' onClick={() => onOpenAdminTab(2)}>
          Who approves
        </Button>
      ) : null}
      {flags.canAccessAdmin ? (
        <Button component={Link} href='/users/list' size='small' variant='outlined'>
          Employees
        </Button>
      ) : null}
    </Stack>
  )

  return (
    <Stack spacing={2}>
      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='At a glance'
          subheader='Shortcuts and signals. Details stay under Team attendance and Approvals.'
        />
        <CardContent>
          <Typography variant='subtitle2' gutterBottom>
            Quick actions
          </Typography>
          {quick}
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader title='1 · Attendance today' subheader='Field-day signals aligned with company timezone.' />
        <CardContent>
          {exceptions?.enabled ? (
            <Stack spacing={2}>
              <MetricChips
                items={[
                  { label: 'Late records', value: exceptions.lateCount ?? 0, color: 'warning' },
                  { label: 'Missing checkout', value: exceptions.missingCheckoutCount ?? 0 },
                  { label: 'Workday', value: exceptions.businessDate ?? '—' }
                ]}
              />
              <Typography variant='body2' color='text.secondary'>
                Late and open checkouts are also visible to managers in Team attendance. Pending late approvals are counted below.
              </Typography>
            </Stack>
          ) : (
            <Alert severity='info' variant='outlined'>
              Turn on schedules under Rules & automation to unlock late and checkout monitoring.
            </Alert>
          )}
          <Divider sx={{ my: 2 }} />
          <Typography variant='subtitle2' gutterBottom>
            Open approvals (company)
          </Typography>
          {govLoading ? (
            <Skeleton height={48} />
          ) : flags.canGovernanceRequestQueue ? (
            <Stack spacing={1.5}>
              <MetricChips
                items={[
                  { label: 'Open requests', value: op?.openRequestsTotal ?? govRows.length },
                  { label: 'Company review queue', value: op?.openRequestsAdminQueue ?? '—' },
                  { label: 'Escalated', value: op?.openRequestsEscalatedStatus ?? '—' },
                  {
                    label: 'Past SLA deadline',
                    value: op?.openRequestsSlaBreached ?? '—',
                    color: (op?.openRequestsSlaBreached ?? 0) > 0 ? 'warning' : 'default'
                  },
                  { label: 'Late arrival pending', value: op?.openRequestsPendingLateArrival ?? '—' },
                  {
                    label: 'Last move by automation',
                    value: op?.openRequestsLastTouchAutomatic ?? '—'
                  },
                  { label: 'Stuck over threshold', value: stuck, color: stuck > 0 ? 'warning' : 'default' },
                  { label: 'SLA under 45 min', value: slaRisk, color: slaRisk > 0 ? 'warning' : 'default' }
                ]}
              />
              <Typography variant='caption' color='text.secondary'>
                “Last move by automation” counts items recently advanced by a deadline rule. Open Approvals for names and history.
              </Typography>
            </Stack>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              You don’t have access to company-wide approval totals. Ask a company administrator to grant visibility if you need them.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='2 · Configuration health'
          subheader='Fix before payroll: schedules, managers, duplicates, expired coverage.'
        />
        <CardContent>
          {monitoring?.coverage ? (
            <Stack spacing={2}>
              <MetricChips
                items={[
                  { label: 'Active employees', value: monitoring.coverage.totalActiveEmployees ?? '—' },
                  {
                    label: 'No manager',
                    value: monitoring.coverage.employeesWithoutManager?.length ?? 0,
                    color: (monitoring.coverage.employeesWithoutManager?.length ?? 0) > 0 ? 'warning' : 'default'
                  },
                  {
                    label: 'No schedule',
                    value: monitoring.coverage.employeesWithoutSchedule?.length ?? 0,
                    color: (monitoring.coverage.employeesWithoutSchedule?.length ?? 0) > 0 ? 'warning' : 'default'
                  },
                  {
                    label: 'Company fallbacks',
                    value: op?.companyWideFallbackCount ?? '—',
                    color: (op?.companyWideFallbackCount ?? 0) > 1 ? 'warning' : 'default'
                  }
                ]}
              />
              {op?.duplicatePoliciesSameShift?.length ? (
                <Alert severity='warning' variant='outlined'>
                  <Typography variant='body2' fontWeight={600} gutterBottom>
                    Multiple named shifts point at the same working-hours template
                  </Typography>
                  {op.duplicatePoliciesSameShift.slice(0, 4).map((d: any, i: number) => (
                    <Typography key={i} variant='caption' color='text.secondary' display='block'>
                      {(d.policies as any[])?.map(p => p?.name).filter(Boolean).join(', ') || 'Unnamed'}
                    </Typography>
                  ))}
                </Alert>
              ) : null}
              {op?.duplicateShiftTimings?.length ? (
                <Alert severity='info' variant='outlined'>
                  <Typography variant='body2' gutterBottom>
                    {op.duplicateShiftTimings.length} group(s) of templates share identical times — consider consolidating labels.
                  </Typography>
                </Alert>
              ) : null}
              {op?.staleDelegations?.length ? (
                <Alert severity='warning' variant='outlined'>
                  <Typography variant='body2' fontWeight={600} gutterBottom>
                    Delegation dates passed but coverage fields remain ({op.staleDelegations.length})
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Ask people to clear delegation under My workday, or update in user admin. Shown: max 30 accounts.
                  </Typography>
                </Alert>
              ) : null}
              {op?.brokenManagerReferences?.length ? (
                <Alert severity='error' variant='outlined'>
                  <Typography variant='body2' fontWeight={600} gutterBottom>
                    Manager references point to inactive or missing users ({op.brokenManagerReferences.length})
                  </Typography>
                </Alert>
              ) : null}
              {monitoring.coverage.duplicateApprovalFlows?.length ? (
                <Typography color='warning.main' variant='body2'>
                  Duplicate approval paths for the same category — review Who approves:{' '}
                  {monitoring.coverage.duplicateApprovalFlows.map((d: any) => String(d.category)).join(', ')}
                </Typography>
              ) : null}
              {monitoring.coverage.orphanedSchedules?.length ? (
                <Typography variant='body2' color='text.secondary'>
                  {monitoring.coverage.orphanedSchedules.length} working-hours template(s) are not linked to any named shift.
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography color='text.secondary'>No monitoring summary loaded.</Typography>
          )}
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='3 · Reviewer load'
          subheader='Who is holding the longest queues — use with Team and Approvals to clear.'
        />
        <CardContent>
          {monitoring?.coverage ? (
            <Stack spacing={2}>
              <Typography variant='body2'>
                Requests pending longer than{' '}
                <strong>{staleH} hours</strong> (still open):{' '}
                <strong>{monitoring.coverage.overduePendingApprovals ?? 0}</strong>
              </Typography>
              {op?.managerApprovalLoads?.length ? (
                <Stack spacing={1}>
                  <Typography variant='subtitle2'>Managers with most open items (assigned step)</Typography>
                  {op.managerApprovalLoads.map((m: any) => (
                    <Stack
                      key={m.userId}
                      direction='row'
                      flexWrap='wrap'
                      alignItems='center'
                      justifyContent='space-between'
                      gap={1}
                    >
                      <Typography variant='body2'>
                        {m.name}
                        {m.isActiveApprover === false ? (
                          <Chip size='small' label='Inactive?' color='warning' sx={{ ml: 1 }} variant='tonal' />
                        ) : null}
                      </Typography>
                      <Chip size='small' label={`${m.pendingCount} open`} variant='outlined' />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant='body2' color='text.secondary'>
                  No per-manager breakdown, or items are in the company review queue.
                </Typography>
              )}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      {flags.canGovernanceRequestQueue && govRows.length > 0 && !govLoading ? (
        <Card variant='outlined' elevation={0}>
          <CardHeader title='Oldest open items (preview)' subheader='First five by age — open full queue for actions.' />
          <CardContent>
            <Stack spacing={1}>
              {govRows.slice(0, 5).map((r: any) => {
                const gov = r.governance || {}
                const emp = typeof r.requesterId === 'object' ? r.requesterId?.name : 'Employee'
                const sla = gov.slaMinutesRemaining
                const line = slaSummaryLine(sla)
                return (
                  <Box key={r._id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                    <Typography variant='body2' fontWeight={600}>
                      {emp}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' display='block'>
                      {r.createdAt ? `Submitted ${new Date(r.createdAt).toLocaleString()}` : ''}
                    </Typography>
                    {line ? (
                      <Typography variant='caption' color={sla != null && sla < 0 ? 'warning.main' : 'text.secondary'} display='block'>
                        {line}
                      </Typography>
                    ) : null}
                  </Box>
                )
              })}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  )
}
