'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import TablePagination from '@mui/material/TablePagination'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { attendanceService } from '@/services/attendance.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import AttendanceModuleLayout from '@/views/attendance/AttendanceModuleLayout'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'
import { requestTypeLabel } from '@/utils/attendanceUi'
import AttendanceWorkflowTimeline from '@/components/attendance/AttendanceWorkflowTimeline'
import AttendanceApprovalPath from '@/components/attendance/AttendanceApprovalPath'
import { slaSummaryLine } from '@/utils/attendanceWorkflowUi'
import { escalationExplainer, nextStepHint } from '@/utils/attendanceApprovalPathUi'

const REJECT_NOTE_MIN = 10

export default function AttendanceGovernanceQueueView() {
  const { user, hasPermission } = useAuth()
  const flags = getAttendancePermissionFlags(user, hasPermission)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [busy, setBusy] = useState(false)
  const [rejectDlg, setRejectDlg] = useState<{ id: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [escalateDlg, setEscalateDlg] = useState<{
    id: string
    stepsSnapshot: any[]
    currentStepIndex: number
  } | null>(null)
  const [scope, setScope] = useState<'all' | 'action' | 'monitor'>('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [slaRiskOnly, setSlaRiskOnly] = useState(false)
  const [slaSort, setSlaSort] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)

  const load = useCallback(async () => {
    if (!flags.canGovernanceRequestQueue) return
    setLoading(true)
    try {
      const r = await attendanceService.governanceRequestQueue({ limit: 300, sort })
      setRows(r.data?.data || [])
    } catch (e) {
      showApiError(e, 'Could not load company approvals')
    } finally {
      setLoading(false)
    }
  }, [flags.canGovernanceRequestQueue, sort])

  useEffect(() => {
    setPage(0)
  }, [scope, typeFilter, slaRiskOnly, slaSort, sort])

  const filteredRows = useMemo(() => {
    let list = [...rows]
    if (scope === 'action') list = list.filter((r: any) => r.governance?.viewerCanAct !== false)
    if (scope === 'monitor') list = list.filter((r: any) => r.governance?.viewerCanAct === false)
    if (typeFilter) list = list.filter((r: any) => r.type === typeFilter)
    if (slaRiskOnly) {
      list = list.filter((r: any) => {
        const m = r.governance?.slaMinutesRemaining
        if (m == null) return false
        return m <= 60
      })
    }
    if (slaSort) {
      list.sort((a: any, b: any) => {
        const ma = a.governance?.slaMinutesRemaining
        const mb = b.governance?.slaMinutesRemaining
        if (ma == null && mb == null) return 0
        if (ma == null) return 1
        if (mb == null) return -1
        return ma - mb
      })
    }
    return list
  }, [rows, scope, typeFilter, slaRiskOnly, slaSort])

  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage
    return filteredRows.slice(start, start + rowsPerPage)
  }, [filteredRows, page, rowsPerPage])

  useEffect(() => {
    void load()
  }, [load])

  const actOn = async (id: string, action: 'approve' | 'reject' | 'escalate', comment?: string) => {
    setBusy(true)
    try {
      if (action === 'approve') await attendanceService.approveAttendanceRequest(id, { comment: comment || '' })
      if (action === 'reject') await attendanceService.rejectAttendanceRequest(id, { comment: comment || '' })
      if (action === 'escalate') await attendanceService.escalateAttendanceRequest(id, { comment: comment || '' })
      showSuccess('Updated')
      await load()
    } catch (e) {
      showApiError(e, 'Could not update request')
    } finally {
      setBusy(false)
    }
  }

  if (!flags.canGovernanceRequestQueue) {
    return (
      <AttendanceModuleLayout>
        <Typography color='text.secondary'>You do not have access to the company approvals workspace.</Typography>
      </AttendanceModuleLayout>
    )
  }

  return (
    <AttendanceModuleLayout
      subtitle={
        <Typography variant='caption' color='text.secondary'>
          Company-wide open requests — backup when teams need a decision.
        </Typography>
      }
    >
      <Stack spacing={2}>
        <Stack direction='row' flexWrap='wrap' gap={2} alignItems='center' justifyContent='space-between'>
          <Typography variant='subtitle1' fontWeight={700}>
            Approvals queue
          </Typography>
          <CustomTextField
            select
            size='small'
            label='Date order'
            value={sort}
            onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value='newest'>Newest first</MenuItem>
            <MenuItem value='oldest'>Oldest first</MenuItem>
          </CustomTextField>
        </Stack>

        <Stack direction='row' flexWrap='wrap' gap={2} alignItems='center'>
          <CustomTextField
            select
            size='small'
            label='View'
            value={scope}
            onChange={e => setScope(e.target.value as 'all' | 'action' | 'monitor')}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value='all'>All open</MenuItem>
            <MenuItem value='action'>Needs my action</MenuItem>
            <MenuItem value='monitor'>Monitor only</MenuItem>
          </CustomTextField>
          <CustomTextField
            select
            size='small'
            label='Type'
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value=''>All types</MenuItem>
            <MenuItem value='LATE_ARRIVAL'>Late arrival</MenuItem>
            <MenuItem value='MISSED_CHECKOUT'>Missing checkout</MenuItem>
            <MenuItem value='TIME_CORRECTION'>Time correction</MenuItem>
            <MenuItem value='MANUAL_EXCEPTION'>Exception</MenuItem>
          </CustomTextField>
          <FormControlLabel
            control={<Switch size='small' checked={slaRiskOnly} onChange={e => setSlaRiskOnly(e.target.checked)} />}
            label='SLA risk (≤1h)'
          />
          <FormControlLabel
            control={<Switch size='small' checked={slaSort} onChange={e => setSlaSort(e.target.checked)} />}
            label='Due soon first'
          />
        </Stack>

        {loading ? (
          <Stack spacing={1.5}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant='rounded' height={120} />
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color='text.secondary'>No open requests right now.</Typography>
            <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
              Items escalate here when your workflow routes them for company backup.
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Typography color='text.secondary'>No requests match these filters.</Typography>
        ) : (
          <>
            <Stack spacing={1.5}>
              {pagedRows.map((r: any) => {
              const gov = r.governance || {}
              const emp =
                typeof r.requesterId === 'object' ? r.requesterId?.name || 'Employee' : 'Employee'
              const owner =
                typeof r.currentApproverId === 'object' ? r.currentApproverId?.name : null
              const slaLine = slaSummaryLine(gov.slaMinutesRemaining)
              const stepLabel =
                gov.stepTotal > 0 ? `Step ${gov.currentStepDisplay ?? 1} of ${gov.stepTotal}` : null
              const canAct = gov.viewerCanAct !== false
              const queueAdmin = Boolean(gov.isAdminQueue || r.adminPool)
              const escalated = r.status === 'ESCALATED'

              return (
                <Card key={r._id} variant='outlined'>
                  <CardContent>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent='space-between'>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction='row' flexWrap='wrap' gap={0.75} className='mbe-1'>
                          {canAct ? (
                            <Chip size='small' color='primary' label='Your action' variant='tonal' />
                          ) : (
                            <Chip size='small' label='Monitor' variant='outlined' />
                          )}
                          {queueAdmin ? (
                            <Chip size='small' label='Administrators' variant='outlined' color='secondary' />
                          ) : null}
                          {escalated ? <Chip size='small' label='Escalated' color='warning' variant='tonal' /> : null}
                        </Stack>
                        <Typography fontWeight={700}>{requestTypeLabel(r.type)}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {emp}
                          {r.createdAt ? ` · Submitted ${new Date(r.createdAt).toLocaleString()}` : ''}
                        </Typography>
                        {stepLabel ? (
                          <Typography variant='caption' color='text.secondary' display='block'>
                            {stepLabel}
                            {owner ? ` · Waiting on: ${owner}` : queueAdmin ? ' · Waiting on administrators' : ''}
                          </Typography>
                        ) : null}
                        <Typography variant='caption' color='text.secondary' display='block'>
                          {nextStepHint(r.stepsSnapshot, r.currentStepIndex)}
                        </Typography>
                        {slaLine ? (
                          <Chip
                            size='small'
                            color={gov.slaMinutesRemaining != null && gov.slaMinutesRemaining < 0 ? 'warning' : 'default'}
                            label={slaLine}
                            sx={{ mt: 1 }}
                            variant='outlined'
                          />
                        ) : null}
                        {r.reason ? (
                          <Typography variant='body2' sx={{ mt: 1 }}>
                            {r.reason}
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
                            summaryHint={
                              (r.workflowTimeline || []).length
                                ? `${(r.workflowTimeline || []).length} event${(r.workflowTimeline || []).length === 1 ? '' : 's'}`
                                : undefined
                            }
                          />
                        </Box>
                      </Box>
                      {!canAct ? (
                        <Typography variant='caption' color='text.secondary' sx={{ maxWidth: 360, alignSelf: { md: 'center' } }}>
                          {gov.viewerReadOnlyReason || 'Only the assigned approver can act right now.'}
                        </Typography>
                      ) : null}
                      <Stack direction='row' flexWrap='wrap' gap={1} alignItems='flex-start'>
                        <Button
                          size='small'
                          variant='contained'
                          disabled={busy || !canAct}
                          onClick={() => void actOn(r._id, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={busy || !canAct}
                          onClick={() => {
                            setRejectNote('')
                            setRejectDlg({ id: r._id })
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size='small'
                          disabled={busy || !canAct}
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
                  </CardContent>
                </Card>
              )
            })}
            </Stack>
            <TablePagination
              component='div'
              count={filteredRows.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => {
                setRowsPerPage(Number(e.target.value))
                setPage(0)
              }}
              rowsPerPageOptions={[8, 16, 32]}
            />
          </>
        )}
      </Stack>

      <Dialog open={Boolean(rejectDlg)} onClose={() => setRejectDlg(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Reject request</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mbe-2'>
            Short note helps the employee and audit.
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
            helperText={`Required for audit trail (at least ${REJECT_NOTE_MIN} characters).`}
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
              : 'The next approver in your company path will receive it, or it may go to the administrator queue.'}
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
