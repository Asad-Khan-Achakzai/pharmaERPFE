'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { attendanceService } from '@/services/attendance.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'
import { requestTypeLabel } from '@/utils/attendanceUi'
import { slaSummaryLine } from '@/utils/attendanceWorkflowUi'
import { escalationExplainer } from '@/utils/attendanceApprovalPathUi'

const REJECT_NOTE_MIN = 10
const STUCK_HOURS = 24

function normCanAct(r: any): boolean {
  const g = r.governance
  if (g && typeof g.viewerCanAct === 'boolean') return g.viewerCanAct
  if (typeof r.viewerCanAct === 'boolean') return r.viewerCanAct
  return true
}

function slaMinLeft(r: any): number | null {
  if (r.governance?.slaMinutesRemaining != null) return Number(r.governance.slaMinutesRemaining)
  if (r.slaDueAt) return Math.round((new Date(r.slaDueAt).getTime() - Date.now()) / 60000)
  return null
}

function hoursOpen(r: any): number | null {
  if (!r.createdAt) return null
  return Math.max(0, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 3600000))
}

function urgencyOf(r: any): 'breach' | 'risk' | 'escalated' | 'company' | 'normal' {
  const m = slaMinLeft(r)
  if (m != null && m < 0) return 'breach'
  if (r.status === 'ESCALATED') return 'escalated'
  if (r.adminPool) return 'company'
  if (m != null && m <= 60) return 'risk'
  return 'normal'
}

function ownerLabel(r: any): string {
  if (typeof r.currentApproverId === 'object' && r.currentApproverId?.name) return String(r.currentApproverId.name)
  if (r.adminPool) return 'Company reviewers'
  return '—'
}

type Props = {
  /** Refresh parent attendance widgets (today board, me today) after actions */
  onAttendanceRefresh?: () => void
}

export default function DashboardAttendanceActionCenter({ onAttendanceRefresh }: Props) {
  const { user, hasPermission } = useAuth()
  const flags = getAttendancePermissionFlags(user, hasPermission)

  const show =
    flags.canApprove ||
    flags.canGovernanceRequestQueue ||
    flags.canSeeOversightQueue

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [inbox, setInbox] = useState<any[]>([])
  const [gov, setGov] = useState<any[]>([])
  const [todaySummary, setTodaySummary] = useState<{ pendingLate?: number; missingCo?: number } | null>(null)
  const [monitoring, setMonitoring] = useState<any>(null)
  const [rejectDlg, setRejectDlg] = useState<{ id: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [escalateDlg, setEscalateDlg] = useState<{
    id: string
    stepsSnapshot: any[]
    currentStepIndex: number
  } | null>(null)

  const load = useCallback(async () => {
    if (!show) return
    setLoading(true)
    try {
      const tasks: Promise<void>[] = []

      if (flags.canApprove) {
        tasks.push(
          attendanceService
            .attendanceInbox({ limit: 120, sort: 'oldest' })
            .then(r => {
              setInbox(r.data?.data || [])
            })
            .catch(() => setInbox([]))
        )
      } else {
        setInbox([])
      }

      if (flags.canGovernanceRequestQueue) {
        tasks.push(
          attendanceService
            .governanceRequestQueue({ limit: 120, sort: 'oldest' })
            .then(r => setGov(r.data?.data || []))
            .catch(() => setGov([]))
        )
      } else {
        setGov([])
      }

      if (flags.canAccessTeam) {
        tasks.push(
          attendanceService
            .today()
            .then(r => {
              const d = r.data?.data as { summary?: Record<string, number> } | null
              const s = d?.summary
              if (s) {
                setTodaySummary({
                  pendingLate: s.pendingLateApproval ?? 0,
                  missingCo: s.missingCheckoutToday ?? 0
                })
              } else setTodaySummary(null)
            })
            .catch(() => setTodaySummary(null))
        )
      }

      if (flags.canAccessAdmin || flags.canSeeAlerts) {
        tasks.push(
          attendanceService
            .monitoringSummary()
            .then(r => setMonitoring(r.data?.data || null))
            .catch(() => setMonitoring(null))
        )
      } else {
        setMonitoring(null)
      }

      await Promise.all(tasks)
    } finally {
      setLoading(false)
    }
  }, [show, flags.canApprove, flags.canGovernanceRequestQueue, flags.canAccessTeam, flags.canAccessAdmin, flags.canSeeAlerts])

  useEffect(() => {
    void load()
  }, [load])

  const pendingRows = useMemo(() => {
    const fromInbox = inbox.filter((r: any) => r.status === 'PENDING' || r.status === 'ESCALATED')
    const inboxIds = new Set(fromInbox.map((r: any) => String(r._id)))
    const fromGov = flags.canGovernanceRequestQueue
      ? gov.filter((r: any) => (r.status === 'PENDING' || r.status === 'ESCALATED') && !inboxIds.has(String(r._id)))
      : []
    return [...fromInbox, ...fromGov]
  }, [inbox, gov, flags.canGovernanceRequestQueue])

  const metrics = useMemo(() => {
    const mine = pendingRows.filter(r => normCanAct(r)).length
    const escalated = pendingRows.filter(r => r.status === 'ESCALATED').length
    const breach = pendingRows.filter(r => {
      const m = slaMinLeft(r)
      return m != null && m < 0
    }).length
    const stuck = pendingRows.filter(r => {
      const h = hoursOpen(r)
      return h != null && h >= STUCK_HOURS
    }).length
    const corrections = pendingRows.filter(r =>
      ['TIME_CORRECTION', 'MANUAL_EXCEPTION', 'MISSED_CHECKOUT'].includes(String(r.type))
    ).length
    return { mine, escalated, breach, stuck, corrections, total: pendingRows.length }
  }, [pendingRows])

  const sortedPreview = useMemo(() => {
    const tier = (u: string) => (u === 'breach' ? 0 : u === 'risk' ? 1 : u === 'escalated' ? 2 : u === 'company' ? 3 : 4)
    return [...pendingRows].sort((a, b) => {
      const actA = normCanAct(a) ? 0 : 1
      const actB = normCanAct(b) ? 0 : 1
      if (actA !== actB) return actA - actB
      const uA = tier(urgencyOf(a))
      const uB = tier(urgencyOf(b))
      if (uA !== uB) return uA - uB
      const mA = slaMinLeft(a)
      const mB = slaMinLeft(b)
      if (mA != null && mB != null && mA !== mB) return mA - mB
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tA - tB
    })
  }, [pendingRows])

  const actOn = async (id: string, action: 'approve' | 'reject' | 'escalate', comment?: string) => {
    setBusy(true)
    try {
      if (action === 'approve') await attendanceService.approveAttendanceRequest(id, {})
      if (action === 'reject') await attendanceService.rejectAttendanceRequest(id, { comment: comment || 'Rejected' })
      if (action === 'escalate') await attendanceService.escalateAttendanceRequest(id, { comment: comment || '' })
      showSuccess('Updated')
      await load()
      onAttendanceRefresh?.()
    } catch (e) {
      showApiError(e, 'Could not update request')
    } finally {
      setBusy(false)
    }
  }

  if (!show) return null

  const cov = monitoring?.coverage

  const UrgencyChip = ({ r }: { r: any }) => {
    const u = urgencyOf(r)
    if (u === 'breach') return <Chip size='small' label='Overdue' color='error' variant='tonal' />
    if (u === 'risk') return <Chip size='small' label='Due soon' color='warning' variant='tonal' />
    if (u === 'escalated') return <Chip size='small' label='Escalated' color='warning' variant='outlined' />
    if (u === 'company') return <Chip size='small' label='Company review' color='secondary' variant='outlined' />
    return <Chip size='small' label='Open' variant='outlined' />
  }

  return (
    <>
      <Card sx={{ boxShadow: 'var(--shadow-xs)', border: '1px solid', borderColor: 'divider' }}>
        <CardHeader
          title='Attendance · action center'
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 700 }}
          subheader='What needs attention today — act here or open Team / Approvals for full detail.'
          action={
            <Button size='small' onClick={() => void load()} disabled={loading || busy}>
              Refresh
            </Button>
          }
        />
        <CardContent sx={{ pt: 0 }}>
          {loading ? (
            <Stack spacing={1}>
              <Skeleton variant='rounded' height={56} />
              <Skeleton variant='rounded' height={72} />
              <Skeleton variant='rounded' height={72} />
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction='row' flexWrap='wrap' gap={0.75}>
                <Chip size='small' variant='tonal' color='primary' label={`Your queue: ${metrics.mine}`} />
                <Chip size='small' variant='outlined' label={`Open: ${metrics.total}`} />
                <Chip
                  size='small'
                  variant='outlined'
                  color={metrics.escalated > 0 ? 'warning' : 'default'}
                  label={`Escalated: ${metrics.escalated}`}
                />
                <Chip
                  size='small'
                  variant='outlined'
                  color={metrics.breach > 0 ? 'error' : 'default'}
                  label={`Past due (SLA): ${metrics.breach}`}
                />
                <Chip
                  size='small'
                  variant='outlined'
                  color={metrics.stuck > 0 ? 'warning' : 'default'}
                  label={`${STUCK_HOURS}h+ waiting: ${metrics.stuck}`}
                />
                {todaySummary ? (
                  <>
                    <Chip size='small' variant='outlined' label={`Late pending check-in: ${todaySummary.pendingLate ?? 0}`} />
                    <Chip size='small' variant='outlined' label={`Missing checkout: ${todaySummary.missingCo ?? 0}`} />
                  </>
                ) : null}
                <Chip size='small' variant='outlined' label={`Corrections / exceptions: ${metrics.corrections}`} />
              </Stack>

              {cov ? (
                <>
                  <Divider />
                  <Typography variant='caption' color='text.secondary' fontWeight={600}>
                    Operational signals
                  </Typography>
                  <Stack direction='row' flexWrap='wrap' gap={0.75}>
                    {(cov.employeesWithoutSchedule?.length ?? 0) > 0 ? (
                      <Chip
                        component={Link}
                        href='/attendance/admin'
                        clickable
                        size='small'
                        color='warning'
                        variant='tonal'
                        label={`No schedule: ${cov.employeesWithoutSchedule.length}`}
                      />
                    ) : (
                      <Chip size='small' variant='outlined' label='No schedule: 0' />
                    )}
                    {(cov.employeesWithoutManager?.length ?? 0) > 0 ? (
                      <Chip
                        component={Link}
                        href='/users/list'
                        clickable
                        size='small'
                        color='warning'
                        variant='tonal'
                        label={`No manager: ${cov.employeesWithoutManager.length}`}
                      />
                    ) : (
                      <Chip size='small' variant='outlined' label='No manager: 0' />
                    )}
                    {cov?.overduePendingApprovals != null ? (
                      <Chip
                        component={Link}
                        href='/attendance/governance'
                        clickable
                        size='small'
                        variant='outlined'
                        label={`Long-pending (company): ${cov.overduePendingApprovals}`}
                      />
                    ) : null}
                  </Stack>
                </>
              ) : null}

              <Stack direction='row' flexWrap='wrap' gap={1}>
                {flags.canAccessTeam ? (
                  <Button size='small' variant='tonal' component={Link} href='/attendance/team'>
                    Team attendance
                  </Button>
                ) : null}
                {flags.canGovernanceRequestQueue ? (
                  <Button size='small' variant='outlined' component={Link} href='/attendance/governance'>
                    Company approvals
                  </Button>
                ) : null}
                <Button size='small' variant='text' component={Link} href='/attendance/me'>
                  My day
                </Button>
              </Stack>

              <Divider />

              {sortedPreview.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No open approval items right now. Your team is clear.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {sortedPreview.slice(0, 6).map(r => {
                    const emp = typeof r.requesterId === 'object' ? r.requesterId?.name || 'Team member' : 'Team member'
                    const can = normCanAct(r)
                    const hm = hoursOpen(r)
                    const sla = slaMinLeft(r)
                    const slaLine = slaSummaryLine(sla)
                    return (
                      <Paper key={r._id} variant='outlined' sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                        <Stack spacing={1}>
                          <Stack direction='row' flexWrap='wrap' alignItems='center' justifyContent='space-between' gap={1}>
                            <Typography variant='body2' fontWeight={700}>
                              {emp}
                            </Typography>
                            <UrgencyChip r={r} />
                          </Stack>
                          <Typography variant='caption' color='text.secondary'>
                            {requestTypeLabel(r.type)} · {r.status === 'ESCALATED' ? 'Escalated' : 'Pending'}
                            {hm != null ? ` · Waiting ${hm}h` : ''}
                          </Typography>
                          <Typography variant='caption' color='text.secondary' display='block'>
                            With: {ownerLabel(r)}
                            {slaLine ? ` · ${slaLine}` : ''}
                          </Typography>
                          {can ? (
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              sx={{
                                pt: 0.5,
                                position: { xs: 'sticky', sm: 'static' },
                                bottom: { xs: 8, sm: 'auto' },
                                zIndex: 1
                              }}
                            >
                              <Button
                                size='small'
                                variant='contained'
                                disabled={busy}
                                onClick={() => void actOn(r._id, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                size='small'
                                variant='outlined'
                                disabled={busy}
                                onClick={() => {
                                  setRejectNote('')
                                  setRejectDlg({ id: r._id })
                                }}
                              >
                                Reject
                              </Button>
                              <Button
                                size='small'
                                disabled={busy}
                                onClick={() =>
                                  setEscalateDlg({
                                    id: r._id,
                                    stepsSnapshot: r.stepsSnapshot || [],
                                    currentStepIndex: typeof r.currentStepIndex === 'number' ? r.currentStepIndex : 0
                                  })
                                }
                              >
                                Higher approval
                              </Button>
                            </Stack>
                          ) : (
                            <Typography variant='caption' color='text.secondary'>
                              Waiting on another approver — monitor in Approvals.
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    )
                  })}
                  {sortedPreview.length > 6 ? (
                    <Button component={Link} href='/attendance/team' size='small' variant='text'>
                      View all ({sortedPreview.length}) in Team / Approvals
                    </Button>
                  ) : null}
                </Stack>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejectDlg)} onClose={() => setRejectDlg(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Reject request</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mbe-2'>
            Give a short reason — the employee will see it.
          </Typography>
          <CustomTextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label='Reason'
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            error={rejectNote.trim().length > 0 && rejectNote.trim().length < REJECT_NOTE_MIN}
            helperText={`At least ${REJECT_NOTE_MIN} characters.`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDlg(null)}>Cancel</Button>
          <Button
            color='error'
            variant='contained'
            disabled={busy || !rejectDlg || rejectNote.trim().length < REJECT_NOTE_MIN}
            onClick={() => {
              if (!rejectDlg) return
              void actOn(rejectDlg.id, 'reject', rejectNote.trim()).then(() => setRejectDlg(null))
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(escalateDlg)} onClose={() => setEscalateDlg(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Send to higher approval?</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            {escalateDlg
              ? escalationExplainer(escalateDlg.stepsSnapshot, escalateDlg.currentStepIndex)
              : 'The next reviewer in your company path will receive this request.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalateDlg(null)}>Cancel</Button>
          <Button
            variant='contained'
            disabled={busy || !escalateDlg}
            onClick={() => {
              if (!escalateDlg) return
              void actOn(escalateDlg.id, 'escalate', '').then(() => setEscalateDlg(null))
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
