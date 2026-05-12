'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Skeleton from '@mui/material/Skeleton'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CustomTextField from '@core/components/mui/TextField'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { attendanceService } from '@/services/attendance.service'
import { useAuth } from '@/contexts/AuthContext'
import AttendanceModuleLayout from '@/views/attendance/AttendanceModuleLayout'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'
import { employeeStatusLabel, requestTypeLabel } from '@/utils/attendanceUi'
import AttendanceWorkflowTimeline from '@/components/attendance/AttendanceWorkflowTimeline'
import AttendanceApprovalPath from '@/components/attendance/AttendanceApprovalPath'
import { slaSummaryLine } from '@/utils/attendanceWorkflowUi'
import { escalationExplainer, nextStepHint } from '@/utils/attendanceApprovalPathUi'

const REJECT_NOTE_MIN = 10

function formatTeamTs(v?: string | null): string {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

function personInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}

/** Select value for employees with no resolved schedule (policies off or unassigned). */
const NO_SHIFT_FILTER = '__no_shift__'

type TodayEmp = {
  employeeId: string
  name: string
  status: string
  checkInTime?: string | null
  checkOutTime?: string | null
  hasCheckedOut?: boolean
  lateMinutes?: number | null
  shiftId?: string | null
  shiftName?: string | null
  scheduleLabel?: string | null
}

export default function TeamAttendanceView() {
  const { user, hasPermission } = useAuth()
  const flags = getAttendancePermissionFlags(user, hasPermission)

  const [loading, setLoading] = useState(true)
  const [todayBoard, setTodayBoard] = useState<{ employees: TodayEmp[]; summary: any; businessDate?: string } | null>(null)
  const [exceptions, setExceptions] = useState<any>(null)
  const [inbox, setInbox] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [drawerEmp, setDrawerEmp] = useState<TodayEmp | null>(null)
  const [inboxSort, setInboxSort] = useState<'newest' | 'oldest'>('newest')
  const [rejectDlg, setRejectDlg] = useState<{ id: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [escalateDlg, setEscalateDlg] = useState<{
    id: string
    stepsSnapshot: any[]
    currentStepIndex: number
  } | null>(null)
  const [oversight, setOversight] = useState<any[]>([])
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))
  const debouncedSearch = useDebouncedValue(search, 320)
  const [kpiExpanded, setKpiExpanded] = useState(false)
  const [teamPage, setTeamPage] = useState(0)
  const [teamRowsPerPage, setTeamRowsPerPage] = useState(10)
  const [inboxPage, setInboxPage] = useState(0)
  const [inboxRowsPerPage, setInboxRowsPerPage] = useState(5)
  const [teamQuickFilter, setTeamQuickFilter] = useState<
    '' | 'LATE' | 'PENDING_APPROVAL' | 'MISSING_CO' | 'NOT_IN' | 'PRESENT' | 'ESCALATED_REQUEST'
  >('')
  const [shiftFilter, setShiftFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const t = await attendanceService.today()
      setTodayBoard(t.data?.data || null)
      try {
        const ex = await attendanceService.todayExceptions()
        setExceptions(ex.data?.data || null)
      } catch {
        setExceptions(null)
      }
      if (flags.canApprove) {
        const ib = await attendanceService.attendanceInbox({ limit: 200, sort: inboxSort })
        setInbox(ib.data?.data || [])
      } else {
        setInbox([])
      }
      if (flags.canSeeOversightQueue && !flags.isAdminUser) {
        try {
          const ov = await attendanceService.oversightAttendanceRequests({ limit: 80, sort: inboxSort })
          setOversight(ov.data?.data || [])
        } catch {
          setOversight([])
        }
      } else {
        setOversight([])
      }
    } catch (e) {
      showApiError(e, 'Could not load team attendance')
    } finally {
      setLoading(false)
    }
  }, [flags.canApprove, flags.canSeeOversightQueue, flags.isAdminUser, inboxSort])

  useEffect(() => {
    if (!flags.canAccessTeam) return
    void load()
  }, [load, flags.canAccessTeam])

  const pendingInbox = useMemo(
    () => inbox.filter((r: any) => r.status === 'PENDING' || r.status === 'ESCALATED'),
    [inbox]
  )

  const requestByEmployee = useMemo(() => {
    const map = new Map<string, any>()
    for (const r of inbox) {
      const id =
        typeof r.requesterId === 'object' && r.requesterId?._id
          ? String(r.requesterId._id)
          : String(r.requesterId || '')
      if (!id) continue
      if (!map.has(id)) map.set(id, r)
    }
    return map
  }, [inbox])

  const kpis = useMemo(() => {
    const s = todayBoard?.summary as Record<string, number> | undefined
    const present = s?.presentPayroll ?? s?.present ?? 0
    const pendingLate = s?.pendingLateApproval ?? 0
    const late = s?.lateToday ?? exceptions?.lateCount ?? 0
    const missingCo = s?.missingCheckoutToday ?? exceptions?.missingCheckoutCount ?? 0
    const pending = pendingInbox.length
    const escalated = inbox.filter((r: any) => r.status === 'ESCALATED' || r.adminPool).length
    const slaRisk = pendingInbox.filter((r: any) => {
      if (r.slaDueAt == null) return false
      const m = Math.round((new Date(r.slaDueAt).getTime() - Date.now()) / 60000)
      return m <= 60
    }).length
    return { present, pendingLate, late, missingCo, pending, escalated, slaRisk }
  }, [todayBoard, exceptions, inbox, pendingInbox])

  const scheduleFilterOptions = useMemo(() => {
    const emps: TodayEmp[] = todayBoard?.employees || []
    const byId = new Map<string, string>()
    for (const e of emps) {
      const id = e.shiftId?.trim()
      if (!id) continue
      const label = (e.scheduleLabel || e.shiftName || 'Schedule').trim()
      if (!byId.has(id)) byId.set(id, label)
    }
    return Array.from(byId.entries())
      .map(([shiftId, label]) => ({ shiftId, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [todayBoard])

  const hasEmployeesWithoutSchedule = useMemo(() => {
    const emps: TodayEmp[] = todayBoard?.employees || []
    return emps.some(e => !e.shiftId)
  }, [todayBoard])

  const mergedRows = useMemo(() => {
    const emps: TodayEmp[] = todayBoard?.employees || []
    const q = debouncedSearch.trim().toLowerCase()
    let list = emps.filter(e => (q ? e.name.toLowerCase().includes(q) : true))
    if (statusFilter) list = list.filter(e => e.status === statusFilter)
    if (shiftFilter === NO_SHIFT_FILTER) {
      list = list.filter(e => !e.shiftId)
    } else if (shiftFilter) {
      list = list.filter(e => e.shiftId === shiftFilter)
    }
    if (teamQuickFilter === 'LATE') {
      list = list.filter(e => e.status === 'LATE_CHECKIN_PENDING' || (e.lateMinutes ?? 0) > 0)
    } else if (teamQuickFilter === 'PENDING_APPROVAL') {
      list = list.filter(e => {
        const req = requestByEmployee.get(e.employeeId)
        return req && (req.status === 'PENDING' || req.status === 'ESCALATED')
      })
    } else if (teamQuickFilter === 'MISSING_CO') {
      list = list.filter(e => Boolean(e.checkInTime) && !e.checkOutTime)
    } else if (teamQuickFilter === 'NOT_IN') {
      list = list.filter(e => e.status === 'NOT_MARKED' || e.status === 'ABSENT')
    } else if (teamQuickFilter === 'PRESENT') {
      list = list.filter(e => e.status === 'PRESENT')
    } else if (teamQuickFilter === 'ESCALATED_REQUEST') {
      list = list.filter(e => {
        const req = requestByEmployee.get(e.employeeId)
        return req?.status === 'ESCALATED'
      })
    }
    const dir = 1
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name)
      return dir * a.status.localeCompare(b.status)
    })
    return list
  }, [todayBoard, debouncedSearch, statusFilter, sortBy, teamQuickFilter, requestByEmployee, shiftFilter])

  useEffect(() => {
    setTeamPage(0)
  }, [debouncedSearch, statusFilter, sortBy, teamQuickFilter, shiftFilter])

  useEffect(() => {
    setInboxPage(0)
  }, [inboxSort])

  const pagedTeam = useMemo(() => {
    const start = teamPage * teamRowsPerPage
    return mergedRows.slice(start, start + teamRowsPerPage)
  }, [mergedRows, teamPage, teamRowsPerPage])

  const pagedInbox = useMemo(() => {
    const start = inboxPage * inboxRowsPerPage
    return pendingInbox.slice(start, start + inboxRowsPerPage)
  }, [pendingInbox, inboxPage, inboxRowsPerPage])

  const actOn = async (id: string, action: 'approve' | 'reject' | 'escalate', comment?: string) => {
    setBusy(true)
    try {
      if (action === 'approve') await attendanceService.approveAttendanceRequest(id, {})
      if (action === 'reject') await attendanceService.rejectAttendanceRequest(id, { comment: comment || 'Rejected' })
      if (action === 'escalate') await attendanceService.escalateAttendanceRequest(id, { comment: comment || '' })
      showSuccess('Updated')
      await load()
    } catch (e) {
      showApiError(e, 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!flags.canAccessTeam) {
    return (
      <AttendanceModuleLayout>
        <Typography color='text.secondary'>You do not have access to team attendance.</Typography>
      </AttendanceModuleLayout>
    )
  }

  return (
    <AttendanceModuleLayout
      subtitle={
        todayBoard?.businessDate ? (
          <Typography variant='caption' color='text.secondary'>
            Workday {todayBoard.businessDate}
          </Typography>
        ) : null
      }
    >
      {loading ? (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map(i => (
              <Grid key={i} size={{ xs: 6, md: 3 }}>
                <Skeleton variant='rounded' height={88} />
              </Grid>
            ))}
          </Grid>
          <Skeleton variant='rounded' height={180} />
          <Skeleton variant='rounded' height={280} />
        </Stack>
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {[
              { label: 'Present', value: kpis.present },
              { label: 'Pending approvals', value: kpis.pending },
              { label: 'Missing checkout', value: kpis.missingCo },
              { label: 'SLA risk (≤1h)', value: kpis.slaRisk }
            ].map(k => (
              <Grid key={k.label} size={{ xs: 6, md: 3 }}>
                <Card elevation={0} variant='outlined' sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant='caption' color='text.secondary' display='block'>
                      {k.label}
                    </Typography>
                    <Typography variant='h5' sx={{ fontWeight: 700 }}>
                      {k.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box>
            <Button size='small' color='secondary' onClick={() => setKpiExpanded(v => !v)} sx={{ mb: kpiExpanded ? 1 : 0 }}>
              {kpiExpanded ? 'Hide extra metrics' : 'More metrics'}
            </Button>
            <Collapse in={kpiExpanded}>
              <Grid container spacing={2}>
                {[
                  { label: 'Late approval pending', value: kpis.pendingLate },
                  { label: 'Late today', value: kpis.late },
                  { label: 'Escalated / admin queue', value: kpis.escalated }
                ].map(k => (
                  <Grid key={k.label} size={{ xs: 12, sm: 4 }}>
                    <Card variant='outlined' elevation={0}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Typography variant='caption' color='text.secondary'>
                          {k.label}
                        </Typography>
                        <Typography variant='h6' fontWeight={700}>
                          {k.value}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Collapse>
          </Box>

          {exceptions?.enabled && (kpis.late > 0 || kpis.missingCo > 0) ? (
            <Stack direction='row' flexWrap='wrap' gap={1} alignItems='center'>
              <Typography variant='caption' color='text.secondary' sx={{ mr: 0.5 }}>
                Spotlight
              </Typography>
              {kpis.late > 0 ? <Chip size='small' label={`${kpis.late} late`} color='warning' variant='tonal' /> : null}
              {kpis.missingCo > 0 ? (
                <Chip size='small' label={`${kpis.missingCo} missing checkout`} variant='outlined' />
              ) : null}
            </Stack>
          ) : null}

          {flags.canApprove ? (
            <Card elevation={0} variant='outlined' sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack
                  direction='row'
                  flexWrap='wrap'
                  justifyContent='space-between'
                  alignItems='center'
                  gap={2}
                  className='mbe-3'
                >
                  <Typography variant='subtitle1' fontWeight={700}>
                    Approvals
                  </Typography>
                  <CustomTextField
                    select
                    size='small'
                    label='Sort'
                    value={inboxSort}
                    onChange={e => setInboxSort(e.target.value as 'newest' | 'oldest')}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value='newest'>Newest first</MenuItem>
                    <MenuItem value='oldest'>Oldest first</MenuItem>
                  </CustomTextField>
                </Stack>
                {pendingInbox.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color='text.secondary'>No pending approvals.</Typography>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                      New requests from your team will show up here.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Stack spacing={1.5}>
                      {pagedInbox.map((r: any) => {
                        const empName = typeof r.requesterId === 'object' ? r.requesterId?.name : 'Team member'
                        const subAt = r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'
                        const ageHours =
                          r.createdAt != null
                            ? Math.max(0, Math.round((Date.now() - new Date(r.createdAt).getTime()) / 3600000))
                            : null
                        const stepIdx = typeof r.currentStepIndex === 'number' ? r.currentStepIndex + 1 : 1
                        const stepTotal = Array.isArray(r.stepsSnapshot) ? r.stepsSnapshot.length : 0
                        const canActRow = r.viewerCanAct !== false
                        const ownerNm =
                          typeof r.currentApproverId === 'object' ? r.currentApproverId?.name : null
                        const slaMin =
                          r.slaDueAt != null
                            ? Math.round((new Date(r.slaDueAt).getTime() - Date.now()) / 60000)
                            : null
                        const slaLine = slaSummaryLine(slaMin)
                        const queueAdmin = Boolean(r.adminPool)
                        const escalatedRow = r.status === 'ESCALATED'

                        return (
                          <Card key={r._id} variant='outlined' sx={{ p: 2 }}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent='space-between'>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction='row' flexWrap='wrap' gap={0.75} className='mbe-1'>
                                  {canActRow ? (
                                    <Chip size='small' color='primary' label='Your action' variant='tonal' />
                                  ) : (
                                    <Chip size='small' label='Waiting on someone else' variant='outlined' />
                                  )}
                                  {queueAdmin ? (
                                    <Chip size='small' label='Administrators' variant='outlined' color='secondary' />
                                  ) : null}
                                  {escalatedRow ? <Chip size='small' label='Escalated' color='warning' variant='tonal' /> : null}
                                </Stack>
                                <Typography fontWeight={600}>{requestTypeLabel(r.type)}</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                  {empName} · Submitted {subAt}
                                  {ageHours != null ? ` · Open ${ageHours}h` : ''}
                                  {stepTotal ? ` · Step ${stepIdx}/${stepTotal}` : ''}
                                </Typography>
                                {slaLine ? (
                                  <Chip
                                    size='small'
                                    variant='outlined'
                                    sx={{ mt: 1 }}
                                    label={slaLine}
                                    color={slaMin != null && slaMin < 0 ? 'warning' : 'default'}
                                  />
                                ) : null}
                                {r.reason ? (
                                  <Typography variant='body2' className='mts-1'>
                                    {r.reason}
                                  </Typography>
                                ) : null}
                                {ownerNm ? (
                                  <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                                    Waiting on: {ownerNm}
                                  </Typography>
                                ) : null}
                                <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                                  {nextStepHint(r.stepsSnapshot, r.currentStepIndex)}
                                </Typography>
                                {!canActRow && r.viewerReadOnlyReason ? (
                                  <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                                    {r.viewerReadOnlyReason}
                                  </Typography>
                                ) : null}
                                <Box sx={{ mt: 1.5 }}>
                                  <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
                                    Approval path
                                  </Typography>
                                  <AttendanceApprovalPath
                                    stepsSnapshot={r.stepsSnapshot}
                                    currentStepIndex={r.currentStepIndex}
                                    compact
                                  />
                                </Box>
                                <Box sx={{ mt: 1.5 }}>
                                  <AttendanceWorkflowTimeline
                                    entries={r.workflowTimeline || []}
                                    defaultExpanded={(r.workflowTimeline || []).length <= 3}
                                  />
                                </Box>
                              </Box>
                              <Stack direction='row' flexWrap='wrap' gap={1} alignItems='center'>
                                <Button
                                  size='small'
                                  variant='contained'
                                  disabled={busy || !canActRow}
                                  onClick={() => void actOn(r._id, 'approve')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size='small'
                                  variant='outlined'
                                  disabled={busy || !canActRow}
                                  onClick={() => {
                                    setRejectNote('')
                                    setRejectDlg({ id: r._id })
                                  }}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size='small'
                                  disabled={busy || !canActRow}
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
                            </Stack>
                          </Card>
                        )
                      })}
                    </Stack>
                    <TablePagination
                      component='div'
                      count={pendingInbox.length}
                      page={inboxPage}
                      onPageChange={(_, p) => setInboxPage(p)}
                      rowsPerPage={inboxRowsPerPage}
                      onRowsPerPageChange={e => {
                        setInboxRowsPerPage(Number(e.target.value))
                        setInboxPage(0)
                      }}
                      rowsPerPageOptions={[5, 10, 25]}
                      showFirstButton
                      showLastButton
                      labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {flags.canSeeOversightQueue && !flags.isAdminUser && oversight.length > 0 ? (
            <Card elevation={0} variant='outlined' sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant='subtitle1' fontWeight={700} gutterBottom>
                  Supervision
                </Typography>
                <Typography variant='body2' color='text.secondary' className='mbe-2'>
                  Visibility on requests where you are not the current approver.
                </Typography>
                <Stack spacing={1.5}>
                  {oversight.map((r: any) => {
                    const empName = typeof r.requesterId === 'object' ? r.requesterId?.name : 'Team member'
                    const canTryAct = flags.canApprove && (r.oversight?.isYourTurn || r.oversight?.visibility === 'INTERVENTION_ALLOWED')
                    const slaMin =
                      r.slaDueAt != null
                        ? Math.round((new Date(r.slaDueAt).getTime() - Date.now()) / 60000)
                        : null
                    const slaLine = slaSummaryLine(slaMin)
                    const ownerOv = typeof r.currentApproverId === 'object' ? r.currentApproverId?.name : null
                    return (
                      <Card key={`ov-${r._id}`} variant='outlined' sx={{ p: 2 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent='space-between'>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction='row' flexWrap='wrap' gap={0.75} className='mbe-1'>
                              {r.oversight?.isYourTurn ? (
                                <Chip size='small' color='primary' label='Your action' variant='tonal' />
                              ) : (
                                <Chip size='small' label='Supervising' variant='outlined' />
                              )}
                              {r.adminPool ? (
                                <Chip size='small' label='Administrators' variant='outlined' color='secondary' />
                              ) : null}
                              {r.status === 'ESCALATED' ? (
                                <Chip size='small' label='Escalated' color='warning' variant='tonal' />
                              ) : null}
                            </Stack>
                            <Typography fontWeight={600}>{requestTypeLabel(r.type)}</Typography>
                            <Typography variant='body2' color='text.secondary'>
                              {empName}
                              {r.createdAt ? ` · Submitted ${new Date(r.createdAt).toLocaleString()}` : ''}
                            </Typography>
                            {slaLine ? (
                              <Chip
                                size='small'
                                variant='outlined'
                                label={slaLine}
                                sx={{ mt: 1 }}
                                color={slaMin != null && slaMin < 0 ? 'warning' : 'default'}
                              />
                            ) : null}
                            {ownerOv ? (
                              <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                                Waiting on: {ownerOv}
                              </Typography>
                            ) : null}
                            {r.oversight?.monitorHint ? (
                              <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                                {r.oversight.monitorHint}
                              </Typography>
                            ) : null}
                            <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                              {nextStepHint(r.stepsSnapshot, r.currentStepIndex)}
                            </Typography>
                            <Box sx={{ mt: 1.5 }}>
                              <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
                                Approval path
                              </Typography>
                              <AttendanceApprovalPath
                                stepsSnapshot={r.stepsSnapshot}
                                currentStepIndex={r.currentStepIndex}
                                compact
                              />
                            </Box>
                            <Box sx={{ mt: 1.5 }}>
                              <AttendanceWorkflowTimeline entries={r.workflowTimeline || []} defaultExpanded={false} />
                            </Box>
                          </Box>
                          {canTryAct ? (
                            <Stack direction='row' flexWrap='wrap' gap={1} alignItems='flex-start'>
                              <Button size='small' variant='contained' disabled={busy} onClick={() => void actOn(r._id, 'approve')}>
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
                                Move up
                              </Button>
                            </Stack>
                          ) : (
                            <Chip size='small' label='Monitoring only' variant='outlined' sx={{ alignSelf: { md: 'center' } }} />
                          )}
                        </Stack>
                      </Card>
                    )
                  })}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          <Card elevation={0} variant='outlined' sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant='subtitle1' fontWeight={700} gutterBottom>
                Team today
              </Typography>
              {scheduleFilterOptions.length === 0 && !hasEmployeesWithoutSchedule ? (
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                  Schedules are not enabled or no shifts are configured — turn them on under Attendance → Settings → Schedules to filter
                  by evening / day shifts.
                </Typography>
              ) : null}
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                Quick views
              </Typography>
              <Stack direction='row' flexWrap='wrap' gap={0.75} sx={{ mb: 2 }}>
                {(
                  [
                    { id: '' as const, label: 'All' },
                    { id: 'LATE' as const, label: 'Late' },
                    { id: 'PENDING_APPROVAL' as const, label: 'Pending approval' },
                    { id: 'MISSING_CO' as const, label: 'Missing checkout' },
                    { id: 'NOT_IN' as const, label: 'Not checked in' },
                    { id: 'PRESENT' as const, label: 'Present' },
                    { id: 'ESCALATED_REQUEST' as const, label: 'Escalated' }
                  ] as const
                ).map(opt => (
                  <Chip
                    key={opt.id || 'all'}
                    size='small'
                    label={opt.label}
                    variant={teamQuickFilter === opt.id ? 'filled' : 'outlined'}
                    color={teamQuickFilter === opt.id ? 'primary' : 'default'}
                    onClick={() => {
                      setTeamQuickFilter(opt.id)
                      setStatusFilter('')
                    }}
                  />
                ))}
              </Stack>
              <Stack direction='row' flexWrap='wrap' gap={2} className='mbe-3' alignItems='flex-end'>
                <CustomTextField
                  size='small'
                  label='Search'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder='Name'
                  sx={{ minWidth: 200 }}
                />
                <CustomTextField
                  select
                  size='small'
                  label='Status'
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value=''>All</MenuItem>
                  <MenuItem value='PRESENT'>Present</MenuItem>
                  <MenuItem value='LATE_CHECKIN_PENDING'>Late (pending)</MenuItem>
                  <MenuItem value='ABSENT'>Absent</MenuItem>
                  <MenuItem value='LEAVE'>Leave</MenuItem>
                  <MenuItem value='NOT_MARKED'>Not marked</MenuItem>
                </CustomTextField>
                {(scheduleFilterOptions.length > 0 || hasEmployeesWithoutSchedule) && (
                  <CustomTextField
                    select
                    size='small'
                    label='Schedule / shift'
                    value={shiftFilter}
                    onChange={e => setShiftFilter(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value=''>All schedules</MenuItem>
                    {hasEmployeesWithoutSchedule ? (
                      <MenuItem value={NO_SHIFT_FILTER}>No schedule assigned</MenuItem>
                    ) : null}
                    {scheduleFilterOptions.map(o => (
                      <MenuItem key={o.shiftId} value={o.shiftId}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </CustomTextField>
                )}
                <CustomTextField
                  select
                  size='small'
                  label='Sort'
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'name' | 'status')}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value='name'>Name</MenuItem>
                  <MenuItem value='status'>Status</MenuItem>
                </CustomTextField>
                {(search || statusFilter || teamQuickFilter || shiftFilter) && (
                  <Button
                    size='small'
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('')
                      setTeamQuickFilter('')
                      setShiftFilter('')
                    }}
                  >
                    Clear
                  </Button>
                )}
              </Stack>
              {mergedRows.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color='text.secondary'>No attendance activity matches your filters.</Typography>
                  <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                    Adjust search or status, or check back later in the day.
                  </Typography>
                </Box>
              ) : isMdDown ? (
                <Stack spacing={1.5}>
                  {pagedTeam.map(row => {
                    const req = requestByEmployee.get(row.employeeId)
                    return (
                      <Card key={row.employeeId} variant='outlined' elevation={0}>
                        <CardContent sx={{ py: 2 }}>
                          <Stack direction='row' spacing={2} alignItems='flex-start'>
                            <Avatar sx={{ width: 40, height: 40 }}>{personInitials(row.name)}</Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography fontWeight={700} gutterBottom>
                                {row.name}
                              </Typography>
                              <Stack direction='row' flexWrap='wrap' gap={0.75} className='mbe-1'>
                                <Chip size='small' label={employeeStatusLabel(row.status)} variant='tonal' />
                                {row.lateMinutes != null && row.lateMinutes > 0 ? (
                                  <Chip size='small' variant='outlined' label={`Late ${row.lateMinutes}m`} color='warning' />
                                ) : null}
                              </Stack>
                              <Typography variant='caption' color='text.secondary' display='block'>
                                {row.scheduleLabel || row.shiftName || 'No schedule'}
                              </Typography>
                              <Typography variant='caption' color='text.secondary' display='block'>
                                In {formatTeamTs(row.checkInTime)}{' · '}Out {formatTeamTs(row.checkOutTime)}
                              </Typography>
                              {req ? (
                                <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                                  Request · {requestTypeLabel(req.type)}
                                </Typography>
                              ) : null}
                              <Button size='small' sx={{ mt: 1 }} onClick={() => setDrawerEmp(row)}>
                                View details
                              </Button>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    )
                  })}
                  <TablePagination
                    component='div'
                    count={mergedRows.length}
                    page={teamPage}
                    onPageChange={(_, p) => setTeamPage(p)}
                    rowsPerPage={teamRowsPerPage}
                    onRowsPerPageChange={e => {
                      setTeamRowsPerPage(Number(e.target.value))
                      setTeamPage(0)
                    }}
                    rowsPerPageOptions={[5, 10, 25]}
                    showFirstButton
                    showLastButton
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
                  />
                </Stack>
              ) : (
                <>
                  <TableContainer sx={{ maxHeight: 480 }}>
                    <Table size='small' stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Employee</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Schedule</TableCell>
                          <TableCell>Check-in</TableCell>
                          <TableCell>Check-out</TableCell>
                          <TableCell>Late</TableCell>
                          <TableCell>Request</TableCell>
                          <TableCell align='right'> </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pagedTeam.map(row => {
                          const req = requestByEmployee.get(row.employeeId)
                          return (
                            <TableRow key={row.employeeId} hover sx={{ '& td': { py: 1.125 } }}>
                              <TableCell>
                                <Stack direction='row' alignItems='center' gap={1}>
                                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                    {personInitials(row.name)}
                                  </Avatar>
                                  {row.name}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip size='small' label={employeeStatusLabel(row.status)} variant='tonal' />
                              </TableCell>
                              <TableCell sx={{ maxWidth: 160 }}>
                                <Typography variant='body2' noWrap title={row.scheduleLabel || row.shiftName || ''}>
                                  {row.scheduleLabel || row.shiftName || '—'}
                                </Typography>
                              </TableCell>
                              <TableCell>{formatTeamTs(row.checkInTime)}</TableCell>
                              <TableCell>{formatTeamTs(row.checkOutTime)}</TableCell>
                              <TableCell>
                                {row.lateMinutes != null && row.lateMinutes > 0 ? `${row.lateMinutes} min` : ''}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 220 }}>
                                {req ? (
                                  <Typography variant='body2' noWrap>
                                    {requestTypeLabel(req.type)}
                                    <Typography component='span' variant='caption' color='text.secondary' sx={{ ml: 0.5 }}>
                                      ({req.status})
                                    </Typography>
                                  </Typography>
                                ) : null}
                              </TableCell>
                              <TableCell align='right'>
                                <Button size='small' onClick={() => setDrawerEmp(row)}>
                                  Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component='div'
                    count={mergedRows.length}
                    page={teamPage}
                    onPageChange={(_, p) => setTeamPage(p)}
                    rowsPerPage={teamRowsPerPage}
                    onRowsPerPageChange={e => {
                      setTeamRowsPerPage(Number(e.target.value))
                      setTeamPage(0)
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                    showFirstButton
                    showLastButton
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}

      <Drawer
        anchor='right'
        open={Boolean(drawerEmp)}
        onClose={() => setDrawerEmp(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction='row' justifyContent='space-between' alignItems='center' className='mbe-2'>
            <Typography variant='h6'>{drawerEmp?.name}</Typography>
            <IconButton aria-label='close' onClick={() => setDrawerEmp(null)} size='small'>
              <i className='tabler-x' />
            </IconButton>
          </Stack>
          {drawerEmp ? (
            <Stack spacing={1}>
              <Typography variant='body2' color='text.secondary'>
                <strong>Status:</strong> {employeeStatusLabel(drawerEmp.status)}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                <strong>Schedule:</strong>{' '}
                {drawerEmp.scheduleLabel || drawerEmp.shiftName || '—'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                <strong>Check-in:</strong> {formatTeamTs(drawerEmp.checkInTime)}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                <strong>Check-out:</strong> {formatTeamTs(drawerEmp.checkOutTime)}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Export or deep history: use company reporting tools where available.
              </Typography>
            </Stack>
          ) : null}
        </Box>
      </Drawer>

      <Dialog open={Boolean(rejectDlg)} onClose={() => setRejectDlg(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Reject request</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mbe-2'>
            Provide a clear reason — the employee and auditors will see it.
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
            helperText={`At least ${REJECT_NOTE_MIN} characters required.`}
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
        <DialogTitle>Move this request up?</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            {escalateDlg
              ? escalationExplainer(escalateDlg.stepsSnapshot, escalateDlg.currentStepIndex)
              : 'The next approver in your company path will receive it.'}
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
    </AttendanceModuleLayout>
  )
}
