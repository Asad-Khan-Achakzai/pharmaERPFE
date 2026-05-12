'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CustomTextField from '@core/components/mui/TextField'
import TablePagination from '@mui/material/TablePagination'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { attendanceService } from '@/services/attendance.service'
import { usersService } from '@/services/users.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { formatShiftRangeLabel, timeInputToMinutes } from '@/utils/attendanceUi'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type AssignableUser = {
  _id: string
  name: string
  email: string
  roleName?: string | null
  roleCode?: string | null
}

type Props = {
  shifts: any[]
  policies: any[]
  assignments: any[]
  onRefresh: () => Promise<void>
  /** Company attendance rules for plain-language chips on shift cards (optional). */
  companyRules?: {
    attendanceApprovalsEnabled?: boolean
    strictLateBlocking?: boolean
    attendanceGovernanceEnabled?: boolean
    attendanceApprovalSlaHours?: number | null
    attendanceEodEscalationEnabled?: boolean
  } | null
}

function idKey(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object' && '_id' in (v as object)) return String((v as { _id: unknown })._id)
  return String(v)
}

function policyDoc(assignments: any[], policies: any[], row: any): any | null {
  if (row?.policyId && typeof row.policyId === 'object') return row.policyId
  const pid = idKey(row?.policyId)
  return policies.find((p: any) => String(p._id) === pid) ?? null
}

function shiftSignature(sh: any): string {
  return [
    String(sh?.name ?? '').trim().toLowerCase(),
    sh?.startMinutes,
    sh?.endMinutes,
    Boolean(sh?.shiftEndsNextDay),
    sh?.graceMinutes ?? 0,
    sh?.postShiftCheckInCutoffMinutes ?? 0
  ].join('|')
}

function shiftHasNoAssignments(shiftId: string, policies: any[], assignments: any[]): boolean {
  const pIds = new Set(
    policies.filter((p: any) => String(idKey(p.workShiftId)) === String(shiftId)).map((p: any) => String(p._id))
  )
  if (pIds.size === 0) return true
  for (const row of assignments) {
    const pid =
      row.policyId && typeof row.policyId === 'object' ? String(row.policyId._id) : String(row.policyId || '')
    if (pid && pIds.has(pid)) return false
  }
  return true
}

/** Assignment table rows tied to policies on this shift (company-wide rows block delete like per-person rows). */
function assignmentRowCountsForShift(shiftId: string, policies: any[], assignments: any[]): {
  perPersonRows: number
  companyWideRows: number
} {
  const pIds = new Set(
    policies.filter((p: any) => String(idKey(p.workShiftId)) === String(shiftId)).map((p: any) => String(p._id))
  )
  let perPersonRows = 0
  let companyWideRows = 0
  for (const row of assignments) {
    const pid =
      row.policyId && typeof row.policyId === 'object' ? String(row.policyId._id) : String(row.policyId || '')
    if (!pid || !pIds.has(pid)) continue
    if (row.employeeId == null) companyWideRows += 1
    else perPersonRows += 1
  }
  return { perPersonRows, companyWideRows }
}

const ASSIGNABLE_CAP = 100

export default function SchedulesPeopleTab({ shifts, policies, assignments, onRefresh, companyRules }: Props) {
  const { user } = useAuth()
  const companyKey = idKey(user?.companyId) || 'default'
  const storageKey = `attendance-primary-default-policy-${companyKey}`

  const [roster, setRoster] = useState<AssignableUser[]>([])
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const [bulkPolicyId, setBulkPolicyId] = useState('')
  const [bulkIdsText, setBulkIdsText] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [pickerKey, setPickerKey] = useState(0)
  const [selectedEmployees, setSelectedEmployees] = useState<AssignableUser[]>([])
  const [effectiveSearch, setEffectiveSearch] = useState('')
  const debouncedEffectiveSearch = useDebouncedValue(effectiveSearch, 320)
  const [effectivePage, setEffectivePage] = useState(0)
  const [effectiveRowsPerPage, setEffectiveRowsPerPage] = useState(10)

  const [previewUser, setPreviewUser] = useState<AssignableUser | null>(null)

  const [shiftForm, setShiftForm] = useState({
    name: 'Field team · standard day',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 15,
    postShiftCheckInCutoffMinutes: 0,
    shiftEndsNextDay: false,
    isDefault: true
  })

  const [newPolicyName, setNewPolicyName] = useState('')
  const [newPolicyShiftId, setNewPolicyShiftId] = useState('')
  const [newPolicyIsDefault, setNewPolicyIsDefault] = useState(false)

  const policyById = useMemo(() => Object.fromEntries(policies.map((p: any) => [String(p._id), p])), [policies])

  const companyWideRows = useMemo(
    () => assignments.filter((a: any) => !a.employeeId && idKey(a.policyId)),
    [assignments]
  )

  const companyWidePolicyIds = useMemo(() => {
    const set = new Set<string>()
    for (const row of companyWideRows) {
      const p = policyDoc(assignments, policies, row)
      if (p?._id) set.add(String(p._id))
    }
    return Array.from(set)
  }, [assignments, policies, companyWideRows])

  const [primaryPolicyId, setPrimaryPolicyId] = useState<string>('')

  useEffect(() => {
    if (companyWidePolicyIds.length === 1) {
      const only = companyWidePolicyIds[0]
      setPrimaryPolicyId(only)
      try {
        sessionStorage.setItem(storageKey, only)
      } catch {
        /* ignore */
      }
      return
    }
    if (companyWidePolicyIds.length === 0) {
      setPrimaryPolicyId('')
      return
    }
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved && companyWidePolicyIds.includes(saved)) {
        setPrimaryPolicyId(saved)
        return
      }
    } catch {
      /* ignore */
    }
    setPrimaryPolicyId('')
  }, [companyWidePolicyIds, storageKey])

  const setPrimaryAndPersist = (pid: string) => {
    setPrimaryPolicyId(pid)
    try {
      if (pid) sessionStorage.setItem(storageKey, pid)
      else sessionStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }

  const primaryPolicy = primaryPolicyId ? policyById[primaryPolicyId] : null
  const primaryShiftId = primaryPolicy ? idKey(primaryPolicy.workShiftId) : ''

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await usersService.assignable({ limit: ASSIGNABLE_CAP })
        if (!cancel) setRoster((res.data?.data || []) as AssignableUser[])
      } catch {
        if (!cancel) setRoster([])
      } finally {
        if (!cancel) setRosterLoaded(true)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const rosterById = useMemo(() => new Map(roster.map(u => [String(u._id), u])), [roster])

  const directAssignmentRows = useMemo(() => assignments.filter((a: any) => Boolean(a.employeeId)), [assignments])

  const directAssignmentUpdatedAt = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of directAssignmentRows) {
      const uid = idKey(row.employeeId)
      if (!uid) continue
      const raw = row.updatedAt || row.createdAt
      m.set(uid, raw ? new Date(raw).toLocaleString() : '—')
    }
    return m
  }, [directAssignmentRows])

  const userDirectPolicyId = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of directAssignmentRows) {
      const p = policyDoc(assignments, policies, row)
      if (!p?._id) continue
      m.set(idKey(row.employeeId), String(p._id))
    }
    return m
  }, [assignments, policies, directAssignmentRows])

  const resolveScheduleForUserId = useCallback(
    (uid: string): { policyName: string; shiftLabel: string; source: 'direct' | 'fallback' | 'none' } => {
      const pidDirect = userDirectPolicyId.get(String(uid))
      if (pidDirect) {
        const pol = policyById[pidDirect]
        const sid = pol ? idKey(pol.workShiftId) : ''
        const sh = sid ? shifts.find((s: any) => String(s._id) === sid) : null
        return {
          policyName: pol?.name ?? 'Named schedule',
          shiftLabel: sh
            ? `${formatShiftRangeLabel(sh.startMinutes, sh.endMinutes, Boolean(sh.shiftEndsNextDay))} · ${sh.name ?? 'Schedule'}`
            : '—',
          source: 'direct'
        }
      }
      if (companyWidePolicyIds.length > 1 && !primaryPolicyId) {
        return {
          policyName: 'Multiple company fallbacks',
          shiftLabel: 'Choose “Primary company fallback” above to see hours',
          source: 'none'
        }
      }
      if (primaryPolicyId && policyById[primaryPolicyId]) {
        const pol = policyById[primaryPolicyId]
        const sid = idKey(pol.workShiftId)
        const sh = shifts.find((s: any) => String(s._id) === sid)
        return {
          policyName: pol.name ?? 'Named schedule',
          shiftLabel: sh
            ? `${formatShiftRangeLabel(sh.startMinutes, sh.endMinutes, Boolean(sh.shiftEndsNextDay))} · ${sh.name ?? 'Schedule'}`
            : '—',
          source: 'fallback'
        }
      }
      return { policyName: '—', shiftLabel: '—', source: 'none' }
    },
    [userDirectPolicyId, primaryPolicyId, policyById, shifts, companyWidePolicyIds.length]
  )

  const scheduleUsage = useMemo(() => {
    const policyCountByShift = new Map<string, number>()
    for (const pol of policies) {
      const sid = idKey(pol.workShiftId)
      if (!sid) continue
      policyCountByShift.set(sid, (policyCountByShift.get(sid) || 0) + 1)
    }

    const directUsersByShift = new Map<string, Set<string>>()
    for (const row of directAssignmentRows) {
      const p = policyDoc(assignments, policies, row)
      if (!p?._id) continue
      const sid = idKey(p.workShiftId)
      const uid = idKey(row.employeeId)
      if (!sid || !uid) continue
      if (!directUsersByShift.has(sid)) directUsersByShift.set(sid, new Set())
      directUsersByShift.get(sid)!.add(uid)
    }

    let fallbackCount = 0
    if (primaryShiftId && roster.length) {
      for (const u of roster) {
        if (userDirectPolicyId.has(String(u._id))) continue
        fallbackCount += 1
      }
    }

    const byShift = new Map<
      string,
      { direct: number; fallback: number; policies: number; unused: boolean }
    >()

    for (const sh of shifts) {
      const sid = String(sh._id)
      const policiesN = policyCountByShift.get(sid) || 0
      const direct = directUsersByShift.get(sid)?.size ?? 0
      const isPrimaryShift = primaryShiftId === sid
      const fb = isPrimaryShift ? fallbackCount : 0
      const unused = policiesN === 0
      byShift.set(sid, { direct, fallback: fb, policies: policiesN, unused })
    }
    return { byShift, directUsersByShift }
  }, [shifts, policies, directAssignmentRows, assignments, primaryShiftId, roster, userDirectPolicyId])

  const { byShift: shiftByIdMeta, directUsersByShift } = scheduleUsage

  const shiftGroups = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const sh of shifts) {
      const sig = shiftSignature(sh)
      const arr = map.get(sig) || []
      arr.push(sh)
      map.set(sig, arr)
    }
    return Array.from(map.entries()).map(([sig, group]) => ({
      sig,
      group: group.sort((a, b) => String(a.name).localeCompare(String(b.name)))
    }))
  }, [shifts])

  const fetchAssignable = useCallback(async (search: string) => {
    const res = await usersService.assignable({ search, limit: 25 })
    return (res.data?.data || []) as AssignableUser[]
  }, [])

  const applyBulk = async (employeeIds: string[]) => {
    if (!bulkPolicyId || !employeeIds.length) {
      showApiError(new Error('Choose a named schedule and at least one person.'), 'Validation')
      return
    }
    setBusy(true)
    try {
      await attendanceService.bulkPolicyAssignments({ policyId: bulkPolicyId, employeeIds })
      showSuccess('Assignments saved')
      setBulkIdsText('')
      setSelectedEmployees([])
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not save assignments')
    } finally {
      setBusy(false)
    }
  }

  const applyBulkFromState = () => {
    const fromPicker = selectedEmployees.map(u => String(u._id))
    const fromAdvanced = bulkIdsText
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean)
    const merged = Array.from(new Set([...fromPicker, ...fromAdvanced]))
    void applyBulk(merged)
  }

  const removeAssignment = async (id: string) => {
    if (
      !window.confirm(
        'Remove this assignment? The person may switch to the company default if one exists, or have no expected hours until you assign again.'
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await attendanceService.deletePolicyAssignment(id)
      showSuccess('Assignment removed')
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not remove assignment')
    } finally {
      setBusy(false)
    }
  }

  const createPolicyFromForm = async () => {
    const name = newPolicyName.trim()
    if (!name || !newPolicyShiftId) {
      showApiError(new Error('Enter a name and choose which work schedule (clock pattern) this policy uses.'), 'Validation')
      return
    }
    const dupExisting = policies.some((p: any) => String(idKey(p.workShiftId)) === String(newPolicyShiftId))
    if (
      dupExisting &&
      !window.confirm(
        'Another named shift already uses this working-hours template. You can continue (e.g. regional labels), or cancel to pick a different template.'
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await attendanceService.createPolicy({
        name: name.slice(0, 120),
        workShiftId: newPolicyShiftId,
        isDefault: newPolicyIsDefault
      })
      showSuccess('Policy created — it will appear in the assign dropdown')
      setNewPolicyName('')
      setNewPolicyShiftId('')
      setNewPolicyIsDefault(false)
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not create policy')
    } finally {
      setBusy(false)
    }
  }

  const deleteWorkShiftById = async (shiftId: string) => {
    if (
      !window.confirm(
        'Delete this schedule? Linked policies with no active assignments will be removed. Past attendance days stay on record; their link to this schedule (and deleted policy) will be cleared. Continue?'
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await attendanceService.deleteWorkShift(shiftId)
      showSuccess('Schedule deleted')
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not delete schedule')
    } finally {
      setBusy(false)
    }
  }

  const createShiftFromForm = async () => {
    const sm = timeInputToMinutes(shiftForm.startTime)
    const em = timeInputToMinutes(shiftForm.endTime)
    if (sm == null || em == null) {
      showApiError(new Error('Enter valid start and end times.'), 'Validation')
      return
    }
    setBusy(true)
    try {
      await attendanceService.createWorkShift({
        name: shiftForm.name,
        startMinutes: sm,
        endMinutes: em,
        graceMinutes: shiftForm.graceMinutes,
        postShiftCheckInCutoffMinutes: shiftForm.postShiftCheckInCutoffMinutes,
        shiftEndsNextDay: shiftForm.shiftEndsNextDay,
        isDefault: shiftForm.isDefault,
        notes: ''
      })
      showSuccess('Schedule created')
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not create schedule')
    } finally {
      setBusy(false)
    }
  }

  const previewResolved =
    previewUser != null ? resolveScheduleForUserId(String(previewUser._id)) : null

  const effectiveRowsAll = useMemo(() => {
    const q = debouncedEffectiveSearch.trim().toLowerCase()
    return roster
      .filter(u => (q ? `${u.name} ${u.email}`.toLowerCase().includes(q) : true))
      .map(u => {
        const res = resolveScheduleForUserId(String(u._id))
        const since =
          res.source === 'direct'
            ? directAssignmentUpdatedAt.get(String(u._id)) ?? '—'
            : res.source === 'fallback'
              ? 'Company default'
              : '—'
        return { u, res, since }
      })
  }, [roster, debouncedEffectiveSearch, resolveScheduleForUserId, directAssignmentUpdatedAt])

  useEffect(() => {
    setEffectivePage(0)
  }, [debouncedEffectiveSearch, roster.length])

  const effectiveRowsPaged = useMemo(() => {
    const start = effectivePage * effectiveRowsPerPage
    return effectiveRowsAll.slice(start, start + effectiveRowsPerPage)
  }, [effectiveRowsAll, effectivePage, effectiveRowsPerPage])

  return (
    <Stack spacing={3}>
      <Accordion
        defaultExpanded={false}
        disableGutters
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
          <Typography variant='subtitle2' fontWeight={600}>
            How schedules work
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity='info' icon={false} sx={{ boxShadow: 'none', border: 'none', p: 0 }}>
            <Typography variant='body2' color='text.secondary' className='mbe-2'>
              Three steps: <strong>hours</strong> → <strong>shift name</strong> → <strong>who it applies to</strong>.
            </Typography>
            <Stack component='ul' spacing={0.5} sx={{ m: 0, pl: 2.5, mb: 0 }}>
              <Typography component='li' variant='body2'>
                <strong>Hours</strong> — start, end, grace, overnight.
              </Typography>
              <Typography component='li' variant='body2'>
                <strong>Shift name</strong> — the label people see (links to one hours template).
              </Typography>
              <Typography component='li' variant='body2'>
                <strong>Who</strong> — per person, or company default if not assigned.
              </Typography>
            </Stack>
          </Alert>
        </AccordionDetails>
      </Accordion>

      <Card variant='outlined' sx={{ bgcolor: 'action.hover' }}>
        <CardContent sx={{ py: 2 }}>
          <Typography variant='subtitle2' fontWeight={700} gutterBottom textAlign='center'>
            How it chains together
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems='center'
            justifyContent='center'
            sx={{ flexWrap: 'wrap' }}
          >
            {(['Working hours template', 'Named shift', 'Who is assigned'] as const).map((label, i) => (
              <Stack key={label} direction='row' alignItems='center' spacing={1}>
                <Chip label={String(i + 1)} size='small' color='primary' />
                <Typography variant='body2' fontWeight={600}>
                  {label}
                </Typography>
                {i < 2 ? (
                  <Typography color='text.disabled' sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    →
                  </Typography>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='Working hour templates'
          subheader='Quick view of every saved pattern, how many people use it, and whether it is redundant or unused.'
        />
        <CardContent>
          {shifts.length === 0 ? (
            <Typography color='text.secondary' variant='body2'>
              No templates yet. Add one under “Add a working hours template” at the bottom of this page.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {shifts.map((sh: any) => {
                const sid = String(sh._id)
                const meta = shiftByIdMeta.get(sid) ?? {
                  direct: 0,
                  fallback: 0,
                  policies: 0,
                  unused: true
                }
                const dupGroup = shiftGroups.find(g => g.group.some((x: any) => String(x._id) === sid) && g.group.length > 1)
                const postEnd = sh.postShiftCheckInCutoffMinutes ?? 0
                return (
                  <Grid key={sid} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card variant='outlined' sx={{ height: '100%', borderColor: meta.unused ? 'warning.light' : 'divider' }}>
                      <CardContent>
                        <Typography fontWeight={700}>{sh.name || 'Untitled template'}</Typography>
                        <Box
                          className='mts-1'
                          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.5 }}
                        >
                          <Typography component='span' variant='body2' color='text.secondary'>
                            {formatShiftRangeLabel(sh.startMinutes, sh.endMinutes, Boolean(sh.shiftEndsNextDay))}
                          </Typography>
                          {Boolean(sh.shiftEndsNextDay) || sh.endMinutes < sh.startMinutes ? (
                            <Chip size='small' label='Overnight' variant='outlined' />
                          ) : null}
                        </Box>
                        <Stack direction='row' flexWrap='wrap' gap={0.75} sx={{ mt: 1.5 }}>
                          <Chip size='small' variant='tonal' label={`Grace ${sh.graceMinutes ?? 0} min`} />
                          <Chip
                            size='small'
                            variant='outlined'
                            label={postEnd > 0 ? `Check-in until ${postEnd} min after end` : 'Check-in stops at shift end'}
                          />
                          {sh.isDefault ? <Chip size='small' color='secondary' variant='outlined' label='Marked default' /> : null}
                          {meta.unused ? (
                            <Chip size='small' color='warning' variant='tonal' label='Unused — no named shift' />
                          ) : null}
                          {dupGroup ? (
                            <Chip size='small' color='warning' variant='outlined' label='Same hours as another template' />
                          ) : null}
                          {companyRules?.strictLateBlocking && companyRules?.attendanceApprovalsEnabled ? (
                            <Chip size='small' variant='outlined' label='Late may need approval (company)' />
                          ) : null}
                          {companyRules?.attendanceApprovalsEnabled ? (
                            <Chip size='small' variant='outlined' label='Approvals on' />
                          ) : (
                            <Chip size='small' variant='outlined' label='Approvals off' />
                          )}
                          {(companyRules?.attendanceApprovalSlaHours ?? 0) > 0 || companyRules?.attendanceEodEscalationEnabled ? (
                            <Chip size='small' variant='tonal' label='Auto follow-up rules on' />
                          ) : null}
                        </Stack>
                        <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1.5 }}>
                          Named shifts using this template: <strong>{meta.policies}</strong>
                          <br />
                          People with a direct assignment: <strong>{meta.direct}</strong>
                          {meta.fallback > 0 ? (
                            <>
                              <br />
                              Plus up to <strong>{meta.fallback}</strong> on company default (in preview list) when this template is primary.
                            </>
                          ) : null}
                          {(sh.updatedAt || sh.createdAt) && (
                            <>
                              <br />
                              Last saved: {new Date(sh.updatedAt || sh.createdAt).toLocaleString()}
                            </>
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}
        </CardContent>
      </Card>

      {companyWidePolicyIds.length > 1 ? (
        <Alert severity='warning'>
          <Typography variant='body2' gutterBottom>
            Multiple company-wide fallbacks exist. Only one should be the primary schedule people rely on when they have no direct
            assignment. This choice is for clarity in this screen only and does not change server behaviour.
          </Typography>
          <FormControl size='small' sx={{ minWidth: 280, mt: 1 }}>
            <InputLabel id='sched-primary-default-label'>Primary company fallback</InputLabel>
            <Select
              labelId='sched-primary-default-label'
              label='Primary company fallback'
              value={primaryPolicyId || ''}
              onChange={e => setPrimaryAndPersist(String(e.target.value))}
            >
              <MenuItem value=''>
                <em>Select which policy is the main default…</em>
              </MenuItem>
              {companyWidePolicyIds.map(pid => (
                <MenuItem key={pid} value={pid}>
                  {policyById[pid]?.name?.trim() || 'Unnamed shift profile'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Alert>
      ) : null}

      {companyWidePolicyIds.length === 1 ? (
        <Alert severity='success' variant='outlined' icon={false}>
          <Typography variant='body2'>
            <strong>Active company default:</strong>{' '}
            {policyById[companyWidePolicyIds[0]]?.name?.trim() || 'Unnamed shift'} — applies to everyone who does not have a personal
            assignment.
          </Typography>
        </Alert>
      ) : null}

      {rosterLoaded && roster.length >= ASSIGNABLE_CAP ? (
        <Alert severity='info' variant='outlined'>
          Directory preview lists up to {ASSIGNABLE_CAP} people. In very large companies, totals may be higher than what you see here.
        </Alert>
      ) : null}

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='User schedule preview'
          subheader='Pick someone to see which named schedule and working hours apply — direct assignment or company-wide fallback.'
        />
        <CardContent>
          <LookupAutocomplete<AssignableUser>
            value={previewUser}
            onChange={v => setPreviewUser(v)}
            fetchOptions={fetchAssignable}
            label='Search person'
            helperText='By name or email'
            getOptionLabel={o => `${o.name} (${o.email})`}
          />
          {previewUser && previewResolved ? (
            <Stack spacing={1} sx={{ mt: 2 }} className='plb-1'>
              <Typography variant='body2'>
                <strong>Named shift:</strong> {previewResolved.policyName}
              </Typography>
              <Typography variant='body2'>
                <strong>Working hours:</strong> {previewResolved.shiftLabel}
              </Typography>
              <Chip
                size='small'
                variant='tonal'
                color={previewResolved.source === 'direct' ? 'primary' : previewResolved.source === 'fallback' ? 'secondary' : 'default'}
                label={
                  previewResolved.source === 'direct'
                    ? 'Source: Direct assignment'
                    : previewResolved.source === 'fallback'
                      ? 'Source: Company default fallback'
                      : 'Source: No assignment — add a direct assignment or a company-wide fallback'
                }
              />
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='Who has which schedule'
          subheader='Everyone in the preview list, with the shift that applies and why. Search is debounced.'
        />
        <CardContent>
          {!rosterLoaded ? (
            <Typography variant='body2' color='text.secondary'>
              Loading directory…
            </Typography>
          ) : (
            <>
              <CustomTextField
                size='small'
                label='Filter by name or email'
                value={effectiveSearch}
                onChange={e => setEffectiveSearch(e.target.value)}
                sx={{ maxWidth: 360, mb: 2 }}
              />
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size='small' stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Person</TableCell>
                      <TableCell>Named shift</TableCell>
                      <TableCell>Working hours</TableCell>
                      <TableCell>Why</TableCell>
                      <TableCell>Since / note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {effectiveRowsAll.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant='body2' color='text.secondary'>
                            {roster.length === 0 ? 'No people in this preview list yet.' : 'No one matches this search.'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      effectiveRowsPaged.map(({ u, res, since }) => (
                        <TableRow key={u._id} hover>
                          <TableCell>
                            {u.name}
                            <Typography variant='caption' color='text.secondary' display='block'>
                              {u.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{res.policyName}</TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>{res.shiftLabel}</TableCell>
                          <TableCell>
                            <Chip
                              size='small'
                              variant='tonal'
                              label={
                                res.source === 'direct'
                                  ? 'Personal assignment'
                                  : res.source === 'fallback'
                                    ? 'Company default'
                                    : 'Not covered'
                              }
                              color={res.source === 'none' ? 'warning' : res.source === 'direct' ? 'primary' : 'secondary'}
                            />
                          </TableCell>
                          <TableCell>{since}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {effectiveRowsAll.length > 0 ? (
                <TablePagination
                  component='div'
                  count={effectiveRowsAll.length}
                  page={effectivePage}
                  onPageChange={(_, p) => setEffectivePage(p)}
                  rowsPerPage={effectiveRowsPerPage}
                  onRowsPerPageChange={e => {
                    setEffectiveRowsPerPage(Number(e.target.value))
                    setEffectivePage(0)
                  }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='Create named schedule (policy)'
          subheader='A policy is the label your people and admins see in lists. It points at exactly one work schedule (the clock pattern: start, end, grace). You need both before you can assign anyone.'
        />
        <CardContent>
          {shifts.length === 0 ? (
            <Alert severity='warning' variant='outlined'>
              Create at least one work schedule first — use “Create another schedule” below, then return here.
            </Alert>
          ) : (
            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} flexWrap='wrap' alignItems='flex-end'>
              <CustomTextField
                label='Policy name'
                value={newPolicyName}
                onChange={e => setNewPolicyName(e.target.value)}
                placeholder='e.g. Morning field, Evening warehouse'
                sx={{ minWidth: 220, flex: 1 }}
              />
              <CustomTextField
                select
                label='Uses work schedule'
                value={newPolicyShiftId}
                onChange={e => setNewPolicyShiftId(e.target.value)}
                sx={{ minWidth: 280 }}
              >
                <MenuItem value=''>
                  <em>Select clock pattern…</em>
                </MenuItem>
                {shifts.map((sh: any) => (
                  <MenuItem key={sh._id} value={String(sh._id)}>
                    {sh.name} · {formatShiftRangeLabel(sh.startMinutes, sh.endMinutes, Boolean(sh.shiftEndsNextDay))} · grace{' '}
                    {sh.graceMinutes ?? 0}m
                    {(sh.postShiftCheckInCutoffMinutes ?? 0) > 0
                      ? ` · +${sh.postShiftCheckInCutoffMinutes}m check-in after end`
                      : ''}
                  </MenuItem>
                ))}
              </CustomTextField>
              <FormControlLabel
                control={
                  <Switch checked={newPolicyIsDefault} onChange={(_, v) => setNewPolicyIsDefault(v)} disabled={busy} />
                }
                label='Company default policy (optional)'
              />
              <Button variant='contained' disabled={busy} onClick={() => void createPolicyFromForm()}>
                Create policy
              </Button>
            </Stack>
          )}
          {policies.length > 0 ? (
            <Typography variant='caption' color='text.secondary' display='block' className='mts-3'>
              Existing policies: {policies.map((p: any) => p.name).join(', ')}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='Assign shifts to people'
          subheader='Choose a named shift, add people by search, then assign. Advanced is only for imports.'
        />
        <CardContent>
          <Stack spacing={2}>
            <CustomTextField
              select
              label='Named schedule (policy)'
              value={bulkPolicyId}
              onChange={e => setBulkPolicyId(e.target.value)}
              sx={{ maxWidth: 400 }}
            >
              <MenuItem value=''>
                <em>Select…</em>
              </MenuItem>
              {policies.map((p: any) => (
                <MenuItem key={p._id} value={p._id}>
                  {p.name}
                </MenuItem>
              ))}
            </CustomTextField>

            <Box>
              <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
                People to assign
              </Typography>
              <LookupAutocomplete<AssignableUser>
                key={pickerKey}
                value={null}
                onChange={v => {
                  if (!v) return
                  setSelectedEmployees(prev =>
                    prev.some(p => String(p._id) === String(v._id)) ? prev : [...prev, v]
                  )
                  setPickerKey(k => k + 1)
                }}
                fetchOptions={fetchAssignable}
                label='Add person'
                placeholder='Type name or email'
                helperText='Each selection adds one person. Remove with the chip below.'
                getOptionLabel={o => `${o.name} · ${o.email}`}
              />
              <Stack direction='row' flexWrap='wrap' gap={1} sx={{ mt: 1.5 }}>
                {selectedEmployees.map(u => (
                  <Chip
                    key={u._id}
                    label={`${u.name}${u.roleName ? ` · ${u.roleName}` : ''}`}
                    onDelete={() => setSelectedEmployees(prev => prev.filter(p => p._id !== u._id))}
                    disabled={busy}
                  />
                ))}
                {selectedEmployees.length === 0 ? (
                  <Typography variant='body2' color='text.secondary'>
                    No one selected yet.
                  </Typography>
                ) : null}
              </Stack>
            </Box>

            <Stack direction='row' flexWrap='wrap' gap={1} alignItems='center'>
              <Button variant='contained' disabled={busy} onClick={() => void applyBulkFromState()}>
                Assign schedule
              </Button>
              <Button variant='text' size='small' onClick={() => setAdvancedOpen(s => !s)}>
                {advancedOpen ? 'Hide advanced' : 'Advanced — paste user IDs'}
              </Button>
            </Stack>

            <Collapse in={advancedOpen}>
              <CustomTextField
                label='User IDs (optional)'
                value={bulkIdsText}
                onChange={e => setBulkIdsText(e.target.value)}
                multiline
                minRows={2}
                fullWidth
                placeholder='Paste internal IDs separated by commas or spaces'
                helperText='For bulk imports or integrations. Names above are recommended for day-to-day use.'
              />
            </Collapse>

            <Divider className='mts-2' />

            <Typography variant='subtitle2' gutterBottom>
              Company-wide fallback
            </Typography>
            <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
              These rows apply to everyone who does not have a direct assignment. Each row is what blocks deleting a duplicate schedule until
              you remove it here (or remove the whole named schedule in your data model).
            </Typography>
            {companyWideRows.length === 0 ? (
              <Typography color='text.secondary' variant='body2'>
                No company-wide fallback yet — people without a direct assignment may not get expected hours until you add one (e.g. Guided
                setup).
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {companyWideRows.map((as: any) => {
                  const pid = idKey(as.policyId)
                  const fullPol = policies.find((p: any) => String(p._id) === pid)
                  const pol = fullPol ?? policyDoc(assignments, policies, as)
                  const shift = fullPol?.workShiftId && typeof fullPol.workShiftId === 'object' ? fullPol.workShiftId : null
                  const hoursHint =
                    shift && typeof shift.startMinutes === 'number'
                      ? `${formatShiftRangeLabel(shift.startMinutes, shift.endMinutes, Boolean(shift.shiftEndsNextDay))}`
                      : null
                  return (
                    <Alert
                      key={as._id}
                      severity='info'
                      variant='outlined'
                      action={
                        <Button size='small' color='inherit' disabled={busy} onClick={() => void removeAssignment(String(as._id))}>
                          Remove
                        </Button>
                      }
                    >
                      <Typography variant='body2' fontWeight={600}>
                        {pol?.name ?? 'Policy'} — company-wide fallback
                      </Typography>
                      {hoursHint ? (
                        <Typography variant='caption' color='text.secondary' display='block'>
                          Working hours: {hoursHint}
                        </Typography>
                      ) : null}
                      <Typography variant='caption' color='text.secondary'>
                        Removing this frees the linked schedule for deletion if no other assignments use it.
                      </Typography>
                    </Alert>
                  )
                })}
              </Stack>
            )}

            <Typography variant='subtitle2' className='mts-4' gutterBottom>
              Direct assignments
            </Typography>
            {directAssignmentRows.length === 0 ? (
              <Typography color='text.secondary' variant='body2'>
                No per-person rows yet. Use search above to assign individuals to a named schedule.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {directAssignmentRows.slice(0, 80).map((as: any) => {
                  const pol = policyDoc(assignments, policies, as)
                  const uid = idKey(as.employeeId)
                  const ru = rosterById.get(uid)
                  return (
                    <Stack
                      key={as._id}
                      direction={{ xs: 'column', sm: 'row' }}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent='space-between'
                      gap={1}
                    >
                      <Typography variant='body2'>
                        {pol?.name ?? 'Policy'} →{' '}
                        <strong>
                          {ru
                            ? `${ru.name} (${ru.email})`
                            : 'Person not in preview list — expand directory cap or search by email in Admin'}
                        </strong>
                      </Typography>
                      <Button size='small' color='error' disabled={busy} onClick={() => void removeAssignment(String(as._id))}>
                        Remove
                      </Button>
                    </Stack>
                  )
                })}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant='outlined' elevation={0}>
        <CardHeader title='Create another schedule' subheader='Adds a new clock pattern. Link it to a policy to put people on it.' />
        <CardContent>
          <Stack direction='row' flexWrap='wrap' gap={2} alignItems='flex-end'>
            <CustomTextField
              label='Schedule name'
              value={shiftForm.name}
              onChange={e => setShiftForm(s => ({ ...s, name: e.target.value }))}
              sx={{ minWidth: 220 }}
            />
            <CustomTextField
              label='Start'
              type='time'
              InputLabelProps={{ shrink: true }}
              value={shiftForm.startTime}
              onChange={e => setShiftForm(s => ({ ...s, startTime: e.target.value }))}
            />
            <CustomTextField
              label='End'
              type='time'
              InputLabelProps={{ shrink: true }}
              value={shiftForm.endTime}
              onChange={e => setShiftForm(s => ({ ...s, endTime: e.target.value }))}
            />
            <CustomTextField
              label='Grace (minutes)'
              type='number'
              value={shiftForm.graceMinutes}
              onChange={e => setShiftForm(s => ({ ...s, graceMinutes: Number(e.target.value) }))}
              sx={{ width: 140 }}
            />
            <CustomTextField
              label='Extra check-in minutes after end'
              type='number'
              value={shiftForm.postShiftCheckInCutoffMinutes}
              onChange={e =>
                setShiftForm(s => ({ ...s, postShiftCheckInCutoffMinutes: Number(e.target.value) }))
              }
              sx={{ width: 220 }}
              helperText='0 = stop check-in at shift end'
            />
            <FormControlLabel
              control={
                <Switch
                  checked={shiftForm.shiftEndsNextDay}
                  onChange={(_, v) => setShiftForm(s => ({ ...s, shiftEndsNextDay: v }))}
                />
              }
              label='Overnight'
            />
            <FormControlLabel
              control={<Switch checked={shiftForm.isDefault} onChange={(_, v) => setShiftForm(s => ({ ...s, isDefault: v }))} />}
              label='Mark as default (system flag)'
            />
            <Button variant='contained' disabled={busy} onClick={() => void createShiftFromForm()}>
              Save schedule
            </Button>
          </Stack>
          <Typography variant='caption' color='text.secondary' display='block' className='mts-2'>
            The “default” switch is stored on the schedule record. For what your people actually follow, use assignments and the primary
            company fallback above.
          </Typography>
        </CardContent>
      </Card>

      <Typography variant='subtitle1' fontWeight={700}>
        Saved schedules
      </Typography>

      <Grid container spacing={2}>
        {shiftGroups.map(({ sig, group }) => {
          const rep = group[0]
          const isDup = group.length > 1

          const uniqueDirect = new Set<string>()
          for (const g of group) {
            const set = directUsersByShift.get(String(g._id))
            if (set) for (const uid of set) uniqueDirect.add(uid)
          }
          const displayDirect = uniqueDirect.size

          let sumPerPersonRows = 0
          let sumCompanyWideRows = 0
          for (const g of group) {
            const c = assignmentRowCountsForShift(String(g._id), policies, assignments)
            sumPerPersonRows += c.perPersonRows
            sumCompanyWideRows += c.companyWideRows
          }

          let displayFallback = 0
          if (primaryShiftId && group.some((g: any) => String(g._id) === String(primaryShiftId)) && roster.length) {
            for (const u of roster) {
              if (!userDirectPolicyId.has(String(u._id))) displayFallback += 1
            }
          }

          const anyInUse = group.some((g: any) => {
            const m = shiftByIdMeta.get(String(g._id))
            return m && !m.unused
          })
          const isPrimaryCard =
            primaryShiftId && group.some((g: any) => String(g._id) === primaryShiftId)

          return (
            <Grid key={sig} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant='outlined' sx={{ height: '100%', borderColor: isDup ? 'warning.main' : undefined }}>
                <CardContent>
                  <Stack direction='row' flexWrap='wrap' gap={1} className='mbe-1' alignItems='center'>
                    {isDup ? <Chip size='small' color='warning' label='Duplicate schedule' variant='tonal' /> : null}
                    {anyInUse ? (
                      <Chip size='small' color='success' label='In use' variant='outlined' />
                    ) : (
                      <Chip size='small' label='Unused' variant='outlined' />
                    )}
                    {isPrimaryCard && companyWidePolicyIds.length > 0 ? (
                      <Chip size='small' color='primary' label='Primary company fallback' variant='tonal' />
                    ) : null}
                  </Stack>

                  {isDup ? (
                    <Alert severity='warning' sx={{ mb: 1 }} icon={false}>
                      <Typography variant='caption'>
                        Same name and times repeated {group.length} times. Consider keeping one and removing extra policies or assignments
                        that point at the others. There is no automatic merge — clean up in Assignments and policies.
                      </Typography>
                    </Alert>
                  ) : null}

                  {group.map((sh: any) => {
                    const canDelete = shiftHasNoAssignments(String(sh._id), policies, assignments)
                    const ac = assignmentRowCountsForShift(String(sh._id), policies, assignments)
                    const blockParts: string[] = []
                    if (ac.companyWideRows > 0) blockParts.push(`${ac.companyWideRows} company-wide`)
                    if (ac.perPersonRows > 0) blockParts.push(`${ac.perPersonRows} per-person`)
                    const blockHint =
                      !canDelete && blockParts.length > 0
                        ? `Remove ${blockParts.join(' and ')} assignment row(s) first`
                        : !canDelete
                          ? 'Remove policy assignments first'
                          : ''
                    return (
                      <Stack
                        key={sh._id}
                        direction='row'
                        justifyContent='space-between'
                        alignItems='flex-start'
                        gap={1}
                        className='mbe-2'
                      >
                        <Typography fontWeight={700}>{sh.name}</Typography>
                        {canDelete ? (
                          <Button
                            size='small'
                            color='error'
                            variant='text'
                            disabled={busy}
                            onClick={() => void deleteWorkShiftById(String(sh._id))}
                          >
                            Delete
                          </Button>
                        ) : (
                          <Typography variant='caption' color='text.secondary' sx={{ maxWidth: 200, textAlign: 'right' }}>
                            {blockHint}
                          </Typography>
                        )}
                      </Stack>
                    )
                  })}

                  <Typography variant='body2' color='text.secondary'>
                    {formatShiftRangeLabel(rep.startMinutes, rep.endMinutes, Boolean(rep.shiftEndsNextDay))}
                  </Typography>
                  <Typography variant='caption' display='block' className='mts-1'>
                    Grace {rep.graceMinutes ?? 0} min
                    {rep.shiftEndsNextDay ? ' · Overnight' : ''}
                  </Typography>

                  <Stack direction='row' flexWrap='wrap' gap={1} sx={{ mt: 1.5 }}>
                    <Chip
                      size='small'
                      variant='outlined'
                      label={`Per-person assignment rows: ${sumPerPersonRows} (${displayDirect} unique people)`}
                    />
                    <Chip size='small' variant='outlined' label={`Company-wide assignment rows: ${sumCompanyWideRows}`} />
                    {primaryShiftId && group.some((g: any) => String(g._id) === String(primaryShiftId)) ? (
                      <Chip
                        size='small'
                        variant='outlined'
                        color='secondary'
                        label={`People on primary fallback (estimate): ${displayFallback}${roster.length >= ASSIGNABLE_CAP ? '+' : ''}`}
                      />
                    ) : null}
                  </Stack>
                  <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                    Delete is blocked while any assignment row exists for a policy on this schedule — including company-wide rows (they
                    cover everyone without a direct assignment). Remove those rows in the sections above. The “primary” estimate only applies
                    when this card’s schedule matches your selected primary company fallback.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Stack>
  )
}
