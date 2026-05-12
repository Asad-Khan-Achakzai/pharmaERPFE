'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import { useTheme } from '@mui/material/styles'
import CustomTextField from '@core/components/mui/TextField'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { attendanceService } from '@/services/attendance.service'
import { usersService } from '@/services/users.service'
import { useAuth } from '@/contexts/AuthContext'
import AttendanceModuleLayout from '@/views/attendance/AttendanceModuleLayout'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'
import {
  requestStatusLabel,
  requestTypeLabel,
  employeeStatusLabel
} from '@/utils/attendanceUi'
import AttendanceWorkflowTimeline from '@/components/attendance/AttendanceWorkflowTimeline'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { slaSummaryLine } from '@/utils/attendanceWorkflowUi'

type MeToday = Record<string, unknown> & {
  _id?: string
  uiStatus?: string
  checkInTime?: string
  checkOutTime?: string
  canCheckIn?: boolean
  canCheckOut?: boolean
  lateMinutes?: number | null
  lateCheckInApprovalStatus?: string
  businessDate?: string
  pstDate?: string
  policySummary?: {
    shiftName?: string
    expectedStartLocal?: string
    expectedEndLocal?: string
    graceMinutes?: number
    shiftEndsNextDay?: boolean
    postShiftCheckInCutoffMinutes?: number
    checkInClosedForShift?: boolean
  } | null
  shiftCheckInClosed?: boolean
  shiftCheckInClosedMessage?: string
}

type AttRow = {
  _id: string
  date: string
  status: string
  checkInTime?: string
  checkOutTime?: string
  lateMinutes?: number | null
  lateCheckInApprovalStatus?: string
  markedBy?: string
  notes?: string
}

function formatLocalHm(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function sameDayHours(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return '—'
  try {
    const a = new Date(checkIn).getTime()
    const b = new Date(checkOut).getTime()
    if (b <= a) return '—'
    const mins = Math.round((b - a) / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h <= 0) return `${m}m`
    return `${h}h ${m}m`
  } catch {
    return '—'
  }
}

const parseYyyyMm = (s: string): Date | null => {
  const t = s.trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const [y, m] = t.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

const formatYyyyMm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MyAttendanceView() {
  const { user, hasPermission, refreshUser } = useAuth()
  const flags = getAttendancePermissionFlags(user, hasPermission)
  const theme = useTheme()

  const [meToday, setMeToday] = useState<MeToday | null>(null)
  const [meLoading, setMeLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [mine, setMine] = useState<any[]>([])
  const [mineLoading, setMineLoading] = useState(false)
  const [reqTab, setReqTab] = useState(0)
  const [historyTab, setHistoryTab] = useState(0)
  const [reqSearch, setReqSearch] = useState('')
  const debouncedReqSearch = useDebouncedValue(reqSearch, 320)
  const [reqTypeFilter, setReqTypeFilter] = useState('')
  const [reqPage, setReqPage] = useState(0)
  const [reqRowsPerPage, setReqRowsPerPage] = useState(8)
  const [histPage, setHistPage] = useState(0)
  const [histRowsPerPage, setHistRowsPerPage] = useState(10)

  const [startDate, setStartDate] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<AttRow[]>([])
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [monthly, setMonthly] = useState<Record<string, unknown> | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  const [submitCard, setSubmitCard] = useState<string | null>(null)
  const [reqType, setReqType] = useState('LATE_ARRIVAL')
  const [reqReason, setReqReason] = useState('')
  const [timeCorrId, setTimeCorrId] = useState('')
  const [timeCorrIn, setTimeCorrIn] = useState('')
  const [timeCorrOut, setTimeCorrOut] = useState('')
  const [missedCoProposed, setMissedCoProposed] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)

  const [delegateUsers, setDelegateUsers] = useState<{ _id: string; name: string }[]>([])
  const [delegateUserId, setDelegateUserId] = useState('')
  const [delegateUntilIso, setDelegateUntilIso] = useState('')
  const [delegateBusy, setDelegateBusy] = useState(false)

  const employeeId = user?._id || ''

  const loadMe = useCallback(async () => {
    setMeLoading(true)
    try {
      const r = await attendanceService.meToday()
      setMeToday((r.data?.data as MeToday) || null)
    } catch (e) {
      showApiError(e, 'Could not load today status')
    } finally {
      setMeLoading(false)
    }
  }, [])

  const loadMine = useCallback(async () => {
    if (!flags.canSubmitRequest) return
    setMineLoading(true)
    try {
      const r = await attendanceService.myAttendanceRequests()
      setMine(r.data?.data || [])
    } catch (e) {
      showApiError(e, 'Could not load your requests')
    } finally {
      setMineLoading(false)
    }
  }, [flags.canSubmitRequest])

  useEffect(() => {
    void loadMe()
  }, [loadMe])
  useEffect(() => {
    void loadMine()
  }, [loadMine])

  useEffect(() => {
    if (!flags.canEditOwnDelegation) return
    void usersService
      .assignable({ limit: 200 })
      .then(r => {
        const raw = r.data?.data
        const list = Array.isArray(raw) ? raw : (raw as { users?: unknown })?.users
        if (Array.isArray(list)) {
          setDelegateUsers(
            list.map((u: any) => ({ _id: String(u._id), name: String(u.name || u.email || 'User') })).filter(u => u._id !== employeeId)
          )
        } else {
          setDelegateUsers([])
        }
      })
      .catch(() => setDelegateUsers([]))
  }, [flags.canEditOwnDelegation, employeeId])

  useEffect(() => {
    if (!flags.canEditOwnDelegation || !user) return
    const uid = user.attendanceApproveDelegateUserId
    const until = user.attendanceApproveDelegateUntil
    setDelegateUserId(uid ? String(uid) : '')
    if (until) {
      const d = new Date(until)
      setDelegateUntilIso(!Number.isNaN(d.getTime()) ? toDatetimeLocalValue(d) : '')
    } else {
      setDelegateUntilIso('')
    }
  }, [user, flags.canEditOwnDelegation])

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const res = await attendanceService.checkIn()
      const doc = res.data?.data as { lateCheckInApprovalStatus?: string } | undefined
      if (doc?.lateCheckInApprovalStatus === 'PENDING') {
        showSuccess('Check-in sent to your manager for approval')
      } else {
        showSuccess('Checked in')
      }
      await loadMe()
      await loadMine()
    } catch (e) {
      showApiError(e, 'Could not check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const saveDelegation = async () => {
    setDelegateBusy(true)
    try {
      const idTrim = delegateUserId.trim()
      const untilTrim = delegateUntilIso.trim()
      if (!idTrim && !untilTrim) {
        await attendanceService.patchMyApprovalDelegation({ delegateUserId: null, delegateUntil: null })
        showSuccess('Approval coverage removed')
      } else {
        if (!idTrim || !untilTrim) {
          showApiError(
            new Error('Choose a colleague and an end date, or clear both fields to remove coverage.'),
            'Approval coverage'
          )
          return
        }
        const untilDate = new Date(untilTrim)
        if (Number.isNaN(untilDate.getTime())) {
          showApiError(new Error('End date is not valid.'), 'Approval coverage')
          return
        }
        await attendanceService.patchMyApprovalDelegation({
          delegateUserId: idTrim,
          delegateUntil: untilDate.toISOString()
        })
        showSuccess('Approval coverage saved')
      }
      await refreshUser()
    } catch (e) {
      showApiError(e, 'Could not update approval coverage')
    } finally {
      setDelegateBusy(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      await attendanceService.checkOut()
      showSuccess('Checked out')
      await loadMe()
    } catch (e) {
      showApiError(e, 'Could not check out')
    } finally {
      setCheckingOut(false)
    }
  }

  const runReport = useCallback(async () => {
    if (!employeeId) return
    setHistLoading(true)
    try {
      const r = await attendanceService.report({ employeeId, startDate, endDate })
      setRows(r.data?.data?.records || [])
      setSummary(r.data?.data?.summary || null)
    } catch (e) {
      showApiError(e, 'Could not load history')
    } finally {
      setHistLoading(false)
    }
  }, [employeeId, startDate, endDate])

  const runMonthly = useCallback(async () => {
    if (!employeeId) return
    setHistLoading(true)
    try {
      const r = await attendanceService.monthlySummary({ employeeId, month })
      setMonthly(r.data?.data || null)
    } catch (e) {
      showApiError(e, 'Could not load monthly summary')
    } finally {
      setHistLoading(false)
    }
  }, [employeeId, month])

  useEffect(() => {
    if (!flags.canAccessMe || !employeeId) return
    if (historyTab === 0) void runReport()
  }, [historyTab, employeeId, runReport, flags.canAccessMe])

  useEffect(() => {
    if (!flags.canAccessMe || !employeeId) return
    if (historyTab === 1) void runMonthly()
  }, [historyTab, employeeId, runMonthly, flags.canAccessMe])

  const operationalState = useMemo(() => {
    const s = meToday?.uiStatus
    if (s === 'LATE_CHECKIN_PENDING') return { label: 'Waiting for approval', color: 'warning' as const }
    if (s === 'LATE_CHECKIN_REJECTED') return { label: 'Late check-in not approved', color: 'error' as const }
    if (s === 'SHIFT_CHECKIN_CLOSED') return { label: 'Shift ended — check-in closed', color: 'default' as const }
    if (s === 'CHECKED_OUT') return { label: 'Checked out', color: 'default' as const }
    if (s === 'PRESENT') {
      const late = meToday?.lateMinutes
      if (late != null && late > 0) return { label: 'Late', color: 'warning' as const }
      return { label: 'On time', color: 'success' as const }
    }
    return { label: 'Not checked in', color: 'warning' as const }
  }, [meToday])

  const filteredRequests = useMemo(() => {
    const groups = [
      (r: any) => r.status === 'PENDING',
      (r: any) => r.status === 'APPROVED',
      (r: any) => r.status === 'REJECTED',
      (r: any) => r.status === 'ESCALATED'
    ]
    const fn = groups[reqTab]
    let list = mine.filter(fn)
    const q = debouncedReqSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((r: any) => {
        const typeL = requestTypeLabel(r.type).toLowerCase()
        const reason = String(r.reason || '').toLowerCase()
        const appr =
          typeof r.currentApproverId === 'object' ? String(r.currentApproverId?.name || '').toLowerCase() : ''
        return typeL.includes(q) || reason.includes(q) || appr.includes(q)
      })
    }
    if (reqTypeFilter) list = list.filter((r: any) => r.type === reqTypeFilter)
    return list
  }, [mine, reqTab, debouncedReqSearch, reqTypeFilter])

  useEffect(() => {
    setReqPage(0)
  }, [reqTab, debouncedReqSearch, reqTypeFilter])

  const pagedRequests = useMemo(() => {
    const start = reqPage * reqRowsPerPage
    return filteredRequests.slice(start, start + reqRowsPerPage)
  }, [filteredRequests, reqPage, reqRowsPerPage])

  const pagedHistoryRows = useMemo(() => {
    const start = histPage * histRowsPerPage
    return rows.slice(start, start + histRowsPerPage)
  }, [rows, histPage, histRowsPerPage])

  useEffect(() => {
    setHistPage(0)
  }, [rows, startDate, endDate, historyTab])

  const primaryOpenRequest = useMemo(
    () => mine.find((r: any) => r.status === 'PENDING' || r.status === 'ESCALATED'),
    [mine]
  )

  const lateCountRange = useMemo(() => {
    return rows.filter(r => (r.lateMinutes ?? 0) > 0).length
  }, [rows])

  const openCheckoutCount = useMemo(() => rows.filter(r => r.checkInTime && !r.checkOutTime).length, [rows])

  const submitRequest = async () => {
    if (!flags.canSubmitRequest || !reqReason.trim()) return
    if (reqType === 'TIME_CORRECTION') {
      const aid = timeCorrId.trim()
      if (!/^[\da-f]{24}$/i.test(aid)) {
        showApiError(new Error('Pick a day from your history.'), 'Validation')
        return
      }
      if (!timeCorrIn.trim() && !timeCorrOut.trim()) {
        showApiError(new Error('Provide at least one corrected time.'), 'Time correction')
        return
      }
    }
    if (reqType === 'MISSED_CHECKOUT') {
      const aid = typeof meToday?._id === 'string' ? meToday._id : ''
      if (!/^[\da-f]{24}$/i.test(aid)) {
        showApiError(
          new Error('You need an open workday (checked in, not checked out) to request a missing checkout.'),
          'Validation'
        )
        return
      }
    }
    setSubmitBusy(true)
    try {
      const body: {
        type: string
        reason: string
        attendanceId?: string
        payload?: { checkInTime?: string; checkOutTime?: string }
      } = { type: reqType, reason: reqReason.trim() }
      if (reqType === 'TIME_CORRECTION') {
        body.attendanceId = timeCorrId.trim()
        body.payload = {}
        if (timeCorrIn.trim()) body.payload.checkInTime = new Date(timeCorrIn).toISOString()
        if (timeCorrOut.trim()) body.payload.checkOutTime = new Date(timeCorrOut).toISOString()
      }
      if (reqType === 'MISSED_CHECKOUT') {
        body.attendanceId = String(meToday?._id || '').trim()
        if (missedCoProposed.trim()) {
          body.payload = { checkOutTime: new Date(missedCoProposed).toISOString() }
        }
      }
      await attendanceService.submitAttendanceRequest(body)
      showSuccess('Request submitted')
      setReqReason('')
      setTimeCorrId('')
      setTimeCorrIn('')
      setTimeCorrOut('')
      setMissedCoProposed('')
      setSubmitCard(null)
      await loadMine()
      await loadMe()
    } catch (e) {
      showApiError(e, 'Could not submit request')
    } finally {
      setSubmitBusy(false)
    }
  }

  const tzBanner = meToday?.businessDate || meToday?.pstDate

  if (!flags.canAccessMe) {
    return (
      <AttendanceModuleLayout>
        <Typography color='text.secondary'>You do not have access to personal attendance.</Typography>
      </AttendanceModuleLayout>
    )
  }

  return (
    <AttendanceModuleLayout>
      <Grid container spacing={3} sx={{ pb: { xs: 12, sm: 0 } }}>
        <Grid size={{ xs: 12 }}>
          <Card
            elevation={0}
            variant='outlined'
            sx={{
              borderRadius: 2,
              borderWidth: 1,
              ...(primaryOpenRequest
                ? { borderColor: 'info.light', boxShadow: theme => `inset 0 0 0 1px ${theme.palette.info.main}22` }
                : {})
            }}
          >
            <CardHeader
              title='Today'
              titleTypographyProps={{ variant: 'h5', fontWeight: 700 }}
              subheader={tzBanner ? `Workday ${String(tzBanner)}` : undefined}
              sx={{ pb: 0 }}
            />
            <CardContent>
              {meLoading ? (
                <Stack spacing={1.5}>
                  <Skeleton variant='rounded' height={36} width='55%' />
                  <Skeleton variant='rounded' height={20} width='85%' />
                  <Stack direction='row' spacing={2}>
                    <Skeleton variant='rounded' height={20} width={120} />
                    <Skeleton variant='rounded' height={20} width={120} />
                  </Stack>
                  <Skeleton variant='rounded' height={44} width={200} />
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Stack direction='row' flexWrap='wrap' gap={1} alignItems='center'>
                    <Chip label={operationalState.label} color={operationalState.color} variant='tonal' size='medium' />
                    {meToday?.lateMinutes != null && meToday.lateMinutes > 0 ? (
                      <Chip label={`Late · ${meToday.lateMinutes} min`} color='warning' variant='outlined' size='small' />
                    ) : null}
                    {meToday?.uiStatus === 'SHIFT_CHECKIN_CLOSED' || meToday?.shiftCheckInClosed ? (
                      <Chip label='Shift closed' size='small' variant='outlined' />
                    ) : null}
                  </Stack>

                  {primaryOpenRequest ? (
                    <Stack spacing={0.5}>
                      <Typography variant='caption' color='text.secondary' fontWeight={600}>
                        Open request
                      </Typography>
                      <Typography variant='body2'>
                        {requestTypeLabel(primaryOpenRequest.type)}
                        {' · '}
                        {typeof primaryOpenRequest.currentApproverId === 'object' &&
                        primaryOpenRequest.currentApproverId?.name
                          ? `With ${primaryOpenRequest.currentApproverId.name}`
                          : primaryOpenRequest.adminPool
                            ? 'With company administrators'
                            : 'Awaiting approver'}
                      </Typography>
                      {primaryOpenRequest.slaDueAt ? (
                        <Typography variant='caption' color='text.secondary'>
                          {slaSummaryLine(
                            Math.round((new Date(primaryOpenRequest.slaDueAt).getTime() - Date.now()) / 60000)
                          )}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : null}

                  {meToday?.policySummary ? (
                    <Typography variant='body2' color='text.secondary'>
                      Shift · {meToday.policySummary.shiftName || 'Scheduled'}{' '}
                      {meToday.policySummary.expectedStartLocal} – {meToday.policySummary.expectedEndLocal}
                      {meToday.policySummary.graceMinutes != null ? ` · ${meToday.policySummary.graceMinutes}m grace` : ''}
                      {meToday.policySummary.shiftEndsNextDay ? ' · Overnight' : ''}
                    </Typography>
                  ) : null}

                  <Box sx={{ borderLeft: 2, borderColor: 'divider', pl: 2, py: 0.5 }}>
                    <Typography variant='caption' color='text.secondary' fontWeight={600} display='block' sx={{ mb: 0.75 }}>
                      Today&apos;s activity
                    </Typography>
                    <Stack spacing={0.5}>
                      <Typography variant='body2' color='text.secondary'>
                        {meToday?.checkInTime
                          ? `Check-in · ${formatLocalHm(meToday.checkInTime)}`
                          : 'Not checked in yet — use Check in when your shift starts.'}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {meToday?.checkOutTime
                          ? `Check-out · ${formatLocalHm(meToday.checkOutTime)}`
                          : meToday?.checkInTime
                            ? 'Still on the clock — check out when you finish.'
                            : ''}
                      </Typography>
                      {meToday?.checkInTime && meToday?.checkOutTime ? (
                        <Typography variant='body2' fontWeight={600}>
                          Time on shift · {sameDayHours(meToday.checkInTime, meToday.checkOutTime)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>

                  {meToday?.uiStatus === 'LATE_CHECKIN_PENDING' ? (
                    <Typography variant='body2' color='warning.main'>
                      Late check-in needs approval before checkout.
                    </Typography>
                  ) : null}
                  {meToday?.uiStatus === 'LATE_CHECKIN_REJECTED' ? (
                    <Typography variant='body2' color='error.main'>
                      Late check-in was declined. You can check in again if you are still working.
                    </Typography>
                  ) : null}
                  {meToday?.uiStatus === 'SHIFT_CHECKIN_CLOSED' ? (
                    <Typography variant='body2' color='text.secondary'>
                      {meToday.shiftCheckInClosedMessage ||
                        'This shift has ended. Use a correction request if you still need changes.'}
                    </Typography>
                  ) : null}

                  <Divider sx={{ display: { xs: 'none', sm: 'block' } }} />
                  <Stack direction='row' flexWrap='wrap' gap={1.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    <Button
                      variant='contained'
                      onClick={() => void handleCheckIn()}
                      disabled={meLoading || checkingIn || checkingOut || !meToday?.canCheckIn}
                    >
                      {checkingIn ? 'Checking in…' : 'Check in'}
                    </Button>
                    <Button
                      variant='outlined'
                      onClick={() => void handleCheckOut()}
                      disabled={meLoading || checkingIn || checkingOut || !meToday?.canCheckOut}
                    >
                      {checkingOut ? 'Checking out…' : 'Check out'}
                    </Button>
                    {flags.canSubmitRequest ? (
                      <Button variant='tonal' color='secondary' onClick={() => setSubmitCard(submitCard ? null : 'hub')}>
                        Request
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {flags.canEditOwnDelegation ? (
          <Grid size={{ xs: 12 }}>
            <Accordion
              defaultExpanded={Boolean(delegateUserId)}
              disableGutters
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
                <Stack spacing={0.25}>
                  <Typography variant='subtitle1' fontWeight={700}>
                    Approval coverage
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    When you are away, route your approvals to a colleague until a set time.
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2} maxWidth={480}>
                  <CustomTextField
                    select
                    fullWidth
                    label='Covering approver'
                    value={delegateUserId}
                    onChange={e => setDelegateUserId(e.target.value)}
                    SelectProps={{ displayEmpty: true }}
                  >
                    <MenuItem value=''>
                      <em>None</em>
                    </MenuItem>
                    {delegateUsers.map(u => (
                      <MenuItem key={u._id} value={u._id}>
                        {u.name}
                      </MenuItem>
                    ))}
                  </CustomTextField>
                  <CustomTextField
                    fullWidth
                    label='Coverage ends'
                    type='datetime-local'
                    value={delegateUntilIso}
                    onChange={e => setDelegateUntilIso(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Stack direction='row' flexWrap='wrap' gap={1}>
                    <Button variant='contained' onClick={() => void saveDelegation()} disabled={delegateBusy}>
                      {delegateBusy ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      variant='text'
                      onClick={() => {
                        setDelegateUserId('')
                        setDelegateUntilIso('')
                        void (async () => {
                          setDelegateBusy(true)
                          try {
                            await attendanceService.patchMyApprovalDelegation({
                              delegateUserId: null,
                              delegateUntil: null
                            })
                            showSuccess('Coverage cleared')
                            await refreshUser()
                          } catch (e) {
                            showApiError(e, 'Could not remove coverage')
                          } finally {
                            setDelegateBusy(false)
                          }
                        })()
                      }}
                      disabled={delegateBusy}
                    >
                      Clear
                    </Button>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Grid>
        ) : null}

        {flags.canSubmitRequest ? (
          <Grid size={{ xs: 12 }}>
            <Collapse in={submitCard === 'hub'}>
              <Card elevation={0} variant='outlined' sx={{ borderRadius: 2, mb: 2 }}>
                <CardHeader title='Submit a request' subheader='Choose a category and tell us what happened.' />
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction='row' flexWrap='wrap' gap={1}>
                      {[
                        { id: 'LATE_ARRIVAL', title: 'Late arrival', sub: 'Explain why you arrived late.' },
                        { id: 'MISSED_CHECKOUT', title: 'Missing checkout', sub: 'You forgot to check out.' },
                        { id: 'TIME_CORRECTION', title: 'Time correction', sub: 'Fix check-in or check-out time.' },
                        { id: 'MANUAL_EXCEPTION', title: 'Attendance exception', sub: 'Other attendance issue.' }
                      ].map(c => (
                        <Button
                          key={c.id}
                          variant={reqType === c.id ? 'contained' : 'outlined'}
                          onClick={() => setReqType(c.id)}
                          sx={{ textAlign: 'left', justifyContent: 'flex-start', py: 1.5, px: 2, maxWidth: 280 }}
                        >
                          <span>
                            <Typography display='block' fontWeight={600}>
                              {c.title}
                            </Typography>
                            <Typography variant='caption' color='inherit' sx={{ opacity: 0.85 }}>
                              {c.sub}
                            </Typography>
                          </span>
                        </Button>
                      ))}
                    </Stack>
                    {reqType === 'LATE_ARRIVAL' ? (
                      <Typography variant='caption' color='text.secondary'>
                        Explain why you checked in late (traffic, customer visit, etc.).
                      </Typography>
                    ) : null}
                    {reqType === 'MISSED_CHECKOUT' ? (
                      <Typography variant='body2' color='text.secondary'>
                        For today’s open workday, your manager can approve a <strong>closing check-out time</strong>. After
                        approval your day is marked complete — optionally suggest a time below.
                      </Typography>
                    ) : null}
                    {reqType === 'TIME_CORRECTION' ? (
                      <Stack spacing={2}>
                        <CustomTextField
                          select
                          label='Day to correct'
                          value={timeCorrId}
                          onChange={e => setTimeCorrId(e.target.value)}
                          sx={{ minWidth: 320 }}
                          disabled={!rows.length}
                        >
                          {rows.map(r => (
                            <MenuItem key={r._id} value={r._id}>
                              {String(r.date).slice(0, 10)} · In {formatLocalHm(r.checkInTime)} · Out{' '}
                              {formatLocalHm(r.checkOutTime)}
                            </MenuItem>
                          ))}
                        </CustomTextField>
                        {!rows.length ? (
                          <Typography variant='caption' color='text.secondary'>
                            Load history from the date range below, then pick a day.
                          </Typography>
                        ) : null}
                        <Stack direction='row' flexWrap='wrap' gap={2}>
                          <CustomTextField
                            label='Correct check-in'
                            type='datetime-local'
                            InputLabelProps={{ shrink: true }}
                            value={timeCorrIn}
                            onChange={e => setTimeCorrIn(e.target.value)}
                            sx={{ minWidth: 240 }}
                          />
                          <CustomTextField
                            label='Correct check-out'
                            type='datetime-local'
                            InputLabelProps={{ shrink: true }}
                            value={timeCorrOut}
                            onChange={e => setTimeCorrOut(e.target.value)}
                            sx={{ minWidth: 240 }}
                          />
                        </Stack>
                      </Stack>
                    ) : null}
                    {reqType === 'MISSED_CHECKOUT' ? (
                      <CustomTextField
                        label='Suggested check-out time (optional)'
                        type='datetime-local'
                        InputLabelProps={{ shrink: true }}
                        value={missedCoProposed}
                        onChange={e => setMissedCoProposed(e.target.value)}
                        sx={{ minWidth: 280 }}
                      />
                    ) : null}
                    <CustomTextField
                      label={
                        reqType === 'LATE_ARRIVAL'
                          ? 'What happened?'
                          : reqType === 'MISSED_CHECKOUT'
                            ? 'What happened?'
                            : 'Details'
                      }
                      value={reqReason}
                      onChange={e => setReqReason(e.target.value)}
                      multiline
                      minRows={2}
                      fullWidth
                    />
                    <Button variant='contained' disabled={submitBusy || !reqReason.trim()} onClick={() => void submitRequest()}>
                      Submit request
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Collapse>
          </Grid>
        ) : null}

        {flags.canSubmitRequest ? (
          <Grid size={{ xs: 12 }}>
            <Card elevation={0} variant='outlined' sx={{ borderRadius: 2 }}>
              <CardHeader title='My requests' titleTypographyProps={{ variant: 'h6', fontWeight: 700 }} sx={{ pb: 0 }} />
              <CardContent>
                <Tabs value={reqTab} onChange={(_, v) => setReqTab(v)} sx={{ mb: 2 }}>
                  <Tab label='Pending' />
                  <Tab label='Approved' />
                  <Tab label='Rejected' />
                  <Tab label='Higher approval' />
                </Tabs>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className='mbe-2' alignItems={{ sm: 'flex-end' }}>
                  <CustomTextField
                    size='small'
                    label='Search'
                    placeholder='Type, note, approver'
                    value={reqSearch}
                    onChange={e => setReqSearch(e.target.value)}
                    sx={{ minWidth: { xs: '100%', sm: 220 } }}
                    InputProps={{
                      endAdornment: reqSearch ? (
                        <InputAdornment position='end'>
                          <IconButton size='small' aria-label='Clear search' onClick={() => setReqSearch('')}>
                            <i className='tabler-x' />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined
                    }}
                  />
                  <CustomTextField
                    select
                    size='small'
                    label='Request type'
                    value={reqTypeFilter}
                    onChange={e => setReqTypeFilter(e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value=''>All types</MenuItem>
                    <MenuItem value='LATE_ARRIVAL'>Late arrival</MenuItem>
                    <MenuItem value='MISSED_CHECKOUT'>Missing checkout</MenuItem>
                    <MenuItem value='TIME_CORRECTION'>Time correction</MenuItem>
                    <MenuItem value='MANUAL_EXCEPTION'>Exception</MenuItem>
                  </CustomTextField>
                  {(reqSearch || reqTypeFilter) && (
                    <Button size='small' onClick={() => { setReqSearch(''); setReqTypeFilter('') }}>
                      Clear filters
                    </Button>
                  )}
                </Stack>
                <TableContainerMini
                  empty={!filteredRequests.length}
                  loading={mineLoading}
                  emptyMessage={
                    mine.length && !filteredRequests.length
                      ? 'No requests match your filters.'
                      : 'No requests in this view yet.'
                  }
                >
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Submitted</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Approver</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedRequests.map(r => (
                        <TableRow key={r._id} hover>
                          <TableCell>{requestTypeLabel(r.type)}</TableCell>
                          <TableCell>
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip size='small' label={requestStatusLabel(r.status)} variant='tonal' />
                          </TableCell>
                          <TableCell>
                            {typeof r.currentApproverId === 'object' && r.currentApproverId?.name
                              ? r.currentApproverId.name
                              : r.adminPool
                                ? 'Administrators'
                                : '—'}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280, verticalAlign: 'top' }}>
                            <Typography variant='body2' sx={{ mb: 0.5 }}>
                              {r.reason?.trim() ? r.reason : '—'}
                            </Typography>
                            {(r.workflowTimeline?.length ?? 0) > 0 ? (
                              <AttendanceWorkflowTimeline entries={r.workflowTimeline} defaultExpanded={false} />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainerMini>
                <TablePagination
                  component='div'
                  count={filteredRequests.length}
                  page={reqPage}
                  onPageChange={(_, p) => setReqPage(p)}
                  rowsPerPage={reqRowsPerPage}
                  onRowsPerPageChange={e => {
                    setReqRowsPerPage(Number(e.target.value))
                    setReqPage(0)
                  }}
                  rowsPerPageOptions={[5, 8, 15, 25]}
                />
              </CardContent>
            </Card>
          </Grid>
        ) : null}

        <Grid size={{ xs: 12 }}>
          <Card elevation={0} variant='outlined' sx={{ borderRadius: 2 }}>
            <CardHeader title='History' subheader='Your attendance for the selected range.' />
            <CardContent>
              <Tabs value={historyTab} onChange={(_, v) => setHistoryTab(v)} sx={{ mb: 2 }}>
                <Tab label='Date range' />
                <Tab label='Monthly summary' />
              </Tabs>
              {historyTab === 0 ? (
                <Stack spacing={2}>
                  <Stack direction='row' flexWrap='wrap' gap={2} alignItems='flex-end'>
                    <CustomTextField
                      type='date'
                      label='From'
                      InputLabelProps={{ shrink: true }}
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                    <CustomTextField
                      type='date'
                      label='To'
                      InputLabelProps={{ shrink: true }}
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                    <Button variant='contained' onClick={() => void runReport()} disabled={histLoading}>
                      Load
                    </Button>
                  </Stack>
                  {summary ? (
                    <Stack direction='row' flexWrap='wrap' gap={1}>
                      <Chip label={`Days in range: ${summary.totalDays}`} variant='outlined' size='small' />
                      <Chip label={`Present: ${summary.presentDays}`} color='success' variant='tonal' size='small' />
                      <Chip label={`Late days: ${lateCountRange}`} color='warning' variant='outlined' size='small' />
                      <Chip label={`Open checkout: ${openCheckoutCount}`} variant='outlined' size='small' />
                      <Chip label={`Absent: ${summary.absentDays}`} color='error' variant='tonal' size='small' />
                    </Stack>
                  ) : null}
                  <TableContainerMini
                    empty={!rows.length}
                    loading={histLoading}
                    emptyMessage='Choose dates and load to see your history.'
                  >
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Check-in</TableCell>
                          <TableCell>Check-out</TableCell>
                          <TableCell>Late</TableCell>
                          <TableCell>Approval</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pagedHistoryRows.map(r => (
                          <TableRow key={r._id} hover>
                            <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Chip
                                size='small'
                                label={employeeStatusLabel(r.status)}
                                variant='tonal'
                              />
                            </TableCell>
                            <TableCell>{r.checkInTime ? new Date(r.checkInTime).toLocaleString() : '—'}</TableCell>
                            <TableCell>{r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : '—'}</TableCell>
                            <TableCell>
                              {(r.lateMinutes ?? 0) > 0 ? `${r.lateMinutes} min` : '—'}
                            </TableCell>
                            <TableCell>
                              {r.lateCheckInApprovalStatus === 'PENDING'
                                ? 'Pending'
                                : r.lateCheckInApprovalStatus === 'APPROVED'
                                  ? 'Approved'
                                  : r.lateCheckInApprovalStatus === 'REJECTED'
                                    ? 'Declined'
                                    : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainerMini>
                  {rows.length > 0 ? (
                    <TablePagination
                      component='div'
                      count={rows.length}
                      page={histPage}
                      onPageChange={(_, p) => setHistPage(p)}
                      rowsPerPage={histRowsPerPage}
                      onRowsPerPageChange={e => {
                        setHistRowsPerPage(Number(e.target.value))
                        setHistPage(0)
                      }}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  ) : null}
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Stack direction='row' flexWrap='wrap' gap={2} alignItems='flex-end'>
                    <AppReactDatepicker
                      showMonthYearPicker
                      selected={parseYyyyMm(month) ?? new Date()}
                      onChange={(date: Date | null) => {
                        setMonth(date ? formatYyyyMm(date) : '')
                        setMonthly(null)
                      }}
                      dateFormat='yyyy-MM'
                      customInput={<CustomTextField sx={{ minWidth: 200 }} label='Month' />}
                    />
                    <Button variant='tonal' onClick={() => void runMonthly()} disabled={histLoading}>
                      Load summary
                    </Button>
                  </Stack>
                  {monthly ? (
                    <Stack direction='row' flexWrap='wrap' gap={1}>
                      <Chip label={`Present: ${monthly.presentDays}`} variant='outlined' size='small' />
                      <Chip label={`Absent: ${monthly.absentDays}`} variant='outlined' size='small' />
                      <Chip label={`Half day: ${monthly.halfDays}`} variant='outlined' size='small' />
                    </Stack>
                  ) : null}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {!meLoading && meToday ? (
        <Paper
          elevation={6}
          sx={{
            display: { xs: 'block', sm: 'none' },
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            p: 2,
            zIndex: theme.zIndex.appBar + 1,
            borderRadius: 0,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction='row' spacing={1}>
            <Button
              fullWidth
              variant='contained'
              onClick={() => void handleCheckIn()}
              disabled={checkingIn || checkingOut || !meToday?.canCheckIn}
            >
              {checkingIn ? 'Checking in…' : 'Check in'}
            </Button>
            <Button
              fullWidth
              variant='outlined'
              onClick={() => void handleCheckOut()}
              disabled={checkingIn || checkingOut || !meToday?.canCheckOut}
            >
              {checkingOut ? 'Checking out…' : 'Check out'}
            </Button>
          </Stack>
        </Paper>
      ) : null}
    </AttendanceModuleLayout>
  )
}

function TableContainerMini({
  children,
  empty,
  loading,
  emptyMessage = 'Nothing to show yet.',
  skeletonRows = 6
}: {
  children: ReactNode
  empty: boolean
  loading: boolean
  emptyMessage?: string
  skeletonRows?: number
}) {
  if (loading) {
    return (
      <Stack spacing={1} role='status' aria-busy='true'>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} variant='rounded' height={44} />
        ))}
      </Stack>
    )
  }
  if (empty) {
    return (
      <Box sx={{ py: 4, px: 1, textAlign: 'center' }}>
        <Typography variant='body2' color='text.secondary'>
          {emptyMessage}
        </Typography>
      </Box>
    )
  }
  return <Box sx={{ overflowX: 'auto' }}>{children}</Box>
}
