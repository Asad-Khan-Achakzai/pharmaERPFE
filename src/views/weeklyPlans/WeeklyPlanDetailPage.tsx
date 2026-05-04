'use client'

import { useState, useEffect, use, useMemo, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import type { TextFieldProps } from '@mui/material/TextField'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { doctorsService } from '@/services/doctors.service'
import { planItemsService } from '@/services/planItems.service'
import WeeklyPlanWeekBoard from '@/views/weeklyPlans/WeeklyPlanWeekBoard'
import tableStyles from '@core/styles/table.module.css'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'

type DoctorOption = { _id: string; name?: string }

type DayPlan = {
  date: string
  selectedDoctors: DoctorOption[]
  doctorNotes: string
  plannedTime: string
  otherTasks: { title: string; notes: string }[]
}

const emptyDayPlan = (): DayPlan => ({
  date: '',
  selectedDoctors: [],
  doctorNotes: '',
  plannedTime: '',
  otherTasks: []
})

/** Normalize plan item date to YYYY-MM-DD for grouping with date inputs */
function planItemToYmd(raw: unknown): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
  const d = raw instanceof Date ? raw : new Date(String(raw))
  if (Number.isNaN(d.getTime())) return ''
  return formatYyyyMmDd(d)
}

function enumerateWeekYmd(weekStart: string, weekEnd: string): string[] {
  const start = parseYyyyMmDd(formatYyyyMmDd(new Date(weekStart)))
  const end = parseYyyyMmDd(formatYyyyMmDd(new Date(weekEnd)))
  if (!start || !end) return []
  const days: string[] = []
  const cur = new Date(start)
  const endT = end.getTime()
  while (cur.getTime() <= endT) {
    days.push(formatYyyyMmDd(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function dedupeDoctors(docs: DoctorOption[]): DoctorOption[] {
  const seen = new Set<string>()
  const out: DoctorOption[] = []
  for (const d of docs) {
    const id = String(d._id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ ...d, _id: id })
  }
  return out
}

const DOCTOR_SEARCH_DEBOUNCE_MS = 350

function DoctorMultiSelectField({
  value,
  onChange,
  disabled,
  helperText,
  textFieldProps
}: {
  value: DoctorOption[]
  onChange: (next: DoctorOption[]) => void
  disabled?: boolean
  helperText?: string
  textFieldProps?: Partial<TextFieldProps>
}) {
  const [listOpen, setListOpen] = useState(false)
  const [options, setOptions] = useState<DoctorOption[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const fetchRef = useRef(doctorsService.lookup)

  fetchRef.current = doctorsService.lookup

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(inputValue.trim()),
      inputValue === '' ? 0 : DOCTOR_SEARCH_DEBOUNCE_MS
    )
    return () => window.clearTimeout(t)
  }, [inputValue])

  /**
   * Do not fetch on mount — avoids N parallel lookups when many days are added at once.
   * Fetch when the user opens the dropdown (or changes search while open).
   */
  useEffect(() => {
    if (!listOpen) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const rows = await fetchRef
          .current({ limit: 25, isActive: 'true', ...(debouncedSearch ? { search: debouncedSearch } : {}) })
          .then(r => r.data.data || [])
        if (!cancelled) setOptions(rows)
      } catch {
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [listOpen, debouncedSearch])

  const mergedOptions = useMemo(() => {
    const byId = new Map<string, DoctorOption>()
    for (const o of [...value, ...options]) {
      if (o?._id) byId.set(String(o._id), { _id: String(o._id), name: o.name })
    }
    return [...byId.values()]
  }, [value, options])

  return (
    <CustomAutocomplete<DoctorOption, true, false, false>
      multiple
      disabled={disabled}
      onOpen={() => setListOpen(true)}
      onClose={() => setListOpen(false)}
      options={mergedOptions}
      value={value}
      loading={loading}
      filterOptions={x => x}
      getOptionLabel={o => o?.name ?? ''}
      isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
      onChange={(_e, next) => onChange(dedupeDoctors(next))}
      inputValue={inputValue}
      onInputChange={(_e, v, reason) => {
        if (reason === 'reset') return
        setInputValue(v)
      }}
      renderInput={params => (
        <CustomTextField
          {...params}
          {...textFieldProps}
          label='Doctors (visits)'
          placeholder='Open to search doctors or add visits'
          helperText={helperText ?? 'Open the list to load doctors (avoids slowing the page when adding many days).'}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color='inherit' size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  )
}

const WeeklyPlanDetailPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('weeklyPlans.edit')
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [copySaving, setCopySaving] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([])
  const [isDayLayoutPending, startDayLayoutTransition] = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const planRes = await weeklyPlansService.getById(params.id)
      setPlan(planRes.data.data)
    } catch (e) {
      showApiError(e, 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [params.id])

  const groupedExistingItems = useMemo(() => {
    const items: any[] = plan?.planItems || []
    const map = new Map<string, any[]>()
    for (const it of items) {
      const ymd = planItemToYmd(it.date)
      if (!ymd) continue
      const list = map.get(ymd) || []
      list.push(it)
      map.set(ymd, list)
    }
    const keys = [...map.keys()].sort()
    return keys.map(date => ({ date, items: map.get(date)! }))
  }, [plan?.planItems])

  const weekYmds = useMemo(() => {
    if (!plan?.weekStartDate || !plan?.weekEndDate) return []
    return enumerateWeekYmd(plan.weekStartDate, plan.weekEndDate)
  }, [plan?.weekStartDate, plan?.weekEndDate])

  const itemsByYmd = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const row of groupedExistingItems) {
      m[row.date] = row.items
    }
    return m
  }, [groupedExistingItems])

  const updateDay = useCallback((index: number, patch: Partial<DayPlan>) => {
    setDayPlans(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }, [])

  const updateDayTask = useCallback((dayIndex: number, taskIndex: number, patch: Partial<{ title: string; notes: string }>) => {
    setDayPlans(prev =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d
        const otherTasks = d.otherTasks.map((t, j) => (j === taskIndex ? { ...t, ...patch } : t))
        return { ...d, otherTasks }
      })
    )
  }, [])

  const addDay = () => {
    startDayLayoutTransition(() => {
      setDayPlans(prev => [...prev, emptyDayPlan()])
    })
  }

  const fillWeekDates = () => {
    if (!plan?.weekStartDate || !plan?.weekEndDate) {
      showApiError(null, 'Plan week range is missing')
      return
    }
    const days = enumerateWeekYmd(plan.weekStartDate, plan.weekEndDate)
    if (days.length === 0) {
      showApiError(null, 'Could not build week dates')
      return
    }
    startDayLayoutTransition(() => {
      setDayPlans(days.map(date => ({ ...emptyDayPlan(), date })))
    })
  }

  const removeDay = (i: number) => setDayPlans(prev => prev.filter((_, idx) => idx !== i))

  const addOtherTask = (dayIndex: number) => {
    setDayPlans(prev =>
      prev.map((d, i) => (i === dayIndex ? { ...d, otherTasks: [...d.otherTasks, { title: '', notes: '' }] } : d))
    )
  }

  const removeOtherTask = (dayIndex: number, taskIndex: number) => {
    setDayPlans(prev =>
      prev.map((d, i) =>
        i !== dayIndex ? d : { ...d, otherTasks: d.otherTasks.filter((_, j) => j !== taskIndex) }
      )
    )
  }

  const handleSaveItems = async () => {
    if (!plan) return
    const weekStartYmd = formatYyyyMmDd(new Date(plan.weekStartDate))
    const weekEndYmd = formatYyyyMmDd(new Date(plan.weekEndDate))

    const filledDays = dayPlans.filter(d => d.date.trim() !== '')
    if (filledDays.length === 0) {
      showApiError(null, 'Add at least one day with a date')
      return
    }

    for (const day of filledDays) {
      const ds = dedupeDoctors(day.selectedDoctors)
      const tasksWithTitle = day.otherTasks.filter(t => t.title.trim() !== '')
      if (ds.length === 0 && tasksWithTitle.length === 0) {
        showApiError(null, `Add at least one doctor or other task for ${day.date}`)
        return
      }
      const dateObj = parseYyyyMmDd(day.date)
      if (!dateObj) {
        showApiError(null, `Invalid date: ${day.date}`)
        return
      }
      if (day.date < weekStartYmd || day.date > weekEndYmd) {
        showApiError(null, `Date ${day.date} must fall within the plan week`)
        return
      }
      for (const t of tasksWithTitle) {
        if (!t.title.trim()) {
          showApiError(null, 'Each other task must have a title')
          return
        }
      }
    }

    const items: Array<{
      date: string
      type: 'DOCTOR_VISIT' | 'OTHER_TASK'
      doctorId?: string
      title?: string
      notes?: string
      plannedTime?: string
    }> = []

    for (const day of filledDays) {
      const doctors = dedupeDoctors(day.selectedDoctors)
      const notesCommon = day.doctorNotes?.trim() || undefined
      const pt = day.plannedTime?.trim() || undefined

      for (const doc of doctors) {
        items.push({
          date: day.date,
          type: 'DOCTOR_VISIT',
          doctorId: String(doc._id),
          notes: notesCommon,
          plannedTime: pt
        })
      }

      for (const task of day.otherTasks) {
        const title = task.title.trim()
        if (!title) continue
        const tn = task.notes?.trim() || undefined
        items.push({
          date: day.date,
          type: 'OTHER_TASK',
          title,
          notes: tn
        })
      }
    }

    if (items.length === 0) {
      showApiError(null, 'Nothing to save')
      return
    }

    setSaving(true)
    try {
      await weeklyPlansService.bulkPlanItems(params.id, items)
      showSuccess('Plan items saved')
      setDayPlans([])
      load()
    } catch (e) {
      showApiError(e, 'Failed to save plan items')
    } finally {
      setSaving(false)
    }
  }

  const weekLabel = () => {
    if (!plan) return ''
    const a = new Date(plan.weekStartDate).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
    const b = new Date(plan.weekEndDate).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    return `${a} – ${b}`
  }

  const handleCopyPreviousWeek = async () => {
    setCopySaving(true)
    try {
      await weeklyPlansService.copyPreviousWeek(params.id)
      showSuccess('Previous week copied into this plan')
      await load()
    } catch (e) {
      showApiError(e, 'Could not copy previous week')
    } finally {
      setCopySaving(false)
    }
  }

  const handleStatusChange = async (planItemId: string, status: string) => {
    setStatusSavingId(planItemId)
    try {
      await planItemsService.update(planItemId, { status })
      showSuccess('Status updated')
      const planRes = await weeklyPlansService.getById(params.id)
      setPlan(planRes.data.data)
    } catch (e) {
      showApiError(e, 'Failed to update status')
    } finally {
      setStatusSavingId(null)
    }
  }

  const formatHeadingDate = (ymd: string) => {
    const p = parseYyyyMmDd(ymd)
    if (!p) return ymd
    return p.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  if (loading || !plan) {
    return (
      <Card>
        <CardContent className='flex justify-center p-12'>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={
              <div className='flex items-center gap-2'>
                <IconButton component={Link} href='/weekly-plans' size='small' aria-label='Back'>
                  <i className='tabler-arrow-left' />
                </IconButton>
                <Typography component='span' variant='h5'>
                  Weekly plan
                </Typography>
              </div>
            }
            subheaderTypographyProps={{ component: 'div' }}
            subheader={
              <div className='flex flex-wrap items-center gap-2'>
                <Typography component='span' variant='body2' color='text.secondary'>
                  {plan.medicalRepId?.name || 'Rep'} · {weekLabel()} ·
                </Typography>
                <Chip size='small' label={plan.status} variant='tonal' />
              </div>
            }
            action={
              canEdit ? (
                <Button
                  size='small'
                  variant='outlined'
                  disabled={copySaving}
                  onClick={() => void handleCopyPreviousWeek()}
                  sx={{ minHeight: 44, minWidth: 44 }}
                >
                  {copySaving ? 'Copying…' : 'Copy previous week'}
                </Button>
              ) : undefined
            }
          />
          <CardContent>
            {plan.notes && (
              <Typography variant='body2' className='mbe-4' color='text.secondary'>
                {plan.notes}
              </Typography>
            )}
            {plan.executionMetrics && (
              <Paper variant='outlined' className='mbe-4 p-4'>
                <Typography variant='subtitle2' className='mbe-2'>
                  Execution metrics
                </Typography>
                <Typography variant='body2' color='text.secondary' className='mbe-3'>
                  Coverage {plan.executionMetrics.coveragePercent}% · Missed{' '}
                  {plan.executionMetrics.missedPercent}% · Route adherence {plan.executionMetrics.adherencePercent}%
                </Typography>
                {plan.executionMetrics.daySummaries?.length ? (
                  <Stack direction='row' flexWrap='wrap' gap={1}>
                    {plan.executionMetrics.daySummaries.map((d: { date: string; state: string }) => (
                      <Chip key={d.date} size='small' variant='outlined' label={`${d.date} · ${d.state}`} />
                    ))}
                  </Stack>
                ) : null}
              </Paper>
            )}

            {weekYmds.length > 0 && (
              <div className='mbe-4'>
                <Typography variant='subtitle2' className='mbe-2'>
                  Week execution map
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                  Drag handles to reorder calls on open days (mobile: long‑press then drag).
                </Typography>
                <WeeklyPlanWeekBoard
                  weeklyPlanId={params.id}
                  weekYmds={weekYmds}
                  itemsByYmd={itemsByYmd}
                  beforePlanWeek={Boolean(plan.editLock?.beforePlanWeek)}
                  businessTodayYmd={String(plan.editLock?.businessTodayYmd || '')}
                  canEdit={canEdit}
                  onReload={() => void load()}
                />
              </div>
            )}

            <Typography variant='subtitle2' className='mbe-2'>
              Scheduled items
            </Typography>
            {groupedExistingItems.length === 0 ? (
              <Paper variant='outlined' className='p-6 text-center'>
                <Typography color='text.secondary'>No activities planned yet.</Typography>
              </Paper>
            ) : (
              <div className='flex flex-col gap-4'>
                {groupedExistingItems.map(({ date, items }) => {
                  const visitCount = items.filter((x: any) => x.type === 'DOCTOR_VISIT').length
                  const taskCount = items.filter((x: any) => x.type === 'OTHER_TASK').length
                  const summaryParts: string[] = []
                  if (visitCount) summaryParts.push(`${visitCount} visit${visitCount !== 1 ? 's' : ''}`)
                  if (taskCount) summaryParts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`)
                  const summary = summaryParts.length ? ` (${summaryParts.join(' · ')})` : ''

                  return (
                    <Paper key={date} variant='outlined' className='p-4'>
                      <Typography variant='subtitle1' fontWeight={600} className='mbe-2'>
                        {formatHeadingDate(date)}
                        <Typography component='span' variant='body2' color='text.secondary' fontWeight={400}>
                          {summary}
                        </Typography>
                      </Typography>
                      <Divider className='mbe-3' />
                      <div className='overflow-x-auto'>
                        <table className={tableStyles.table}>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Doctor / title</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it: any) => (
                              <tr key={it._id}>
                                <td>{it.type === 'DOCTOR_VISIT' ? 'Doctor visit' : 'Other task'}</td>
                                <td>
                                  {it.type === 'DOCTOR_VISIT' ? it.doctorId?.name || '—' : it.title || '—'}
                                  {it.notes ? (
                                    <Typography variant='caption' display='block' color='text.secondary'>
                                      {it.notes}
                                    </Typography>
                                  ) : null}
                                </td>
                                <td>
                                  {canEdit ? (
                                    <CustomTextField
                                      select
                                      size='small'
                                      value={it.status}
                                      onChange={e => handleStatusChange(it._id, e.target.value)}
                                      disabled={statusSavingId === it._id}
                                      sx={{ minWidth: 140 }}
                                    >
                                      <MenuItem value='PENDING'>Pending</MenuItem>
                                      <MenuItem value='VISITED'>Visited</MenuItem>
                                      <MenuItem value='MISSED'>Missed</MenuItem>
                                    </CustomTextField>
                                  ) : (
                                    <Chip size='small' label={it.status} variant='tonal' />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Paper>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {canEdit && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader
              title='Add plan items'
              subheader='Plan by day: select multiple doctors for the same date, add optional shared notes for those visits, and other tasks as needed. Dates must fall within the plan week.'
            />
            <CardContent>
              <div className='flex flex-wrap items-center gap-2 mbe-4'>
                <Button
                  variant='outlined'
                  onClick={addDay}
                  disabled={isDayLayoutPending}
                  startIcon={
                    isDayLayoutPending ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-plus' />
                  }
                >
                  Add day
                </Button>
                <Button
                  variant='outlined'
                  onClick={fillWeekDates}
                  disabled={isDayLayoutPending}
                  startIcon={
                    isDayLayoutPending ? (
                      <CircularProgress size={18} color='inherit' />
                    ) : (
                      <i className='tabler-calendar-week' />
                    )
                  }
                >
                  Fill all days in week
                </Button>
                {isDayLayoutPending ? (
                  <Typography variant='caption' color='text.secondary'>
                    Laying out days…
                  </Typography>
                ) : null}
              </div>

              {dayPlans.length === 0 ? (
                <Paper variant='outlined' className='p-6 text-center mbe-4'>
                  <Typography color='text.secondary' className='mbe-2'>
                    No draft days yet. Use &quot;Add day&quot; or &quot;Fill all days in week&quot;, then choose doctors
                    and tasks.
                  </Typography>
                </Paper>
              ) : (
                <div className='flex flex-col gap-4 mbe-4'>
                  {dayPlans.map((day, dayIndex) => {
                    const doctors = dedupeDoctors(day.selectedDoctors)
                    const tasksWithTitle = day.otherTasks.filter(t => t.title.trim() !== '')
                    const visitCount = doctors.length
                    const draftSummaryParts: string[] = []
                    if (visitCount) draftSummaryParts.push(`${visitCount} visit${visitCount !== 1 ? 's' : ''}`)
                    if (tasksWithTitle.length)
                      draftSummaryParts.push(
                        `${tasksWithTitle.length} task${tasksWithTitle.length !== 1 ? 's' : ''}`
                      )
                    const draftSummary =
                      draftSummaryParts.length > 0 ? ` — ${draftSummaryParts.join(' · ')}` : ''

                    return (
                      <Paper key={dayIndex} variant='outlined' className='p-4'>
                        <div className='flex flex-wrap items-start justify-between gap-2 mbe-3'>
                          <Typography variant='subtitle1' fontWeight={600}>
                            {day.date ? formatHeadingDate(day.date) : 'New day'}
                            {day.date ? (
                              <Typography component='span' variant='body2' color='text.secondary' fontWeight={400}>
                                {draftSummary}
                              </Typography>
                            ) : null}
                          </Typography>
                          <Button color='error' size='small' onClick={() => removeDay(dayIndex)}>
                            Remove day
                          </Button>
                        </div>

                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                            <CustomTextField
                              fullWidth
                              type='date'
                              label='Date'
                              value={day.date}
                              onChange={e => updateDay(dayIndex, { date: e.target.value })}
                              slotProps={{ inputLabel: { shrink: true } }}
                              helperText='Within plan week'
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                            <CustomTextField
                              fullWidth
                              label='Planned time (hint)'
                              placeholder='e.g. 10:30'
                              value={day.plannedTime}
                              onChange={e => updateDay(dayIndex, { plannedTime: e.target.value })}
                              helperText='Optional — shown to reps'
                            />
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <DoctorMultiSelectField
                              value={day.selectedDoctors}
                              onChange={next => updateDay(dayIndex, { selectedDoctors: next })}
                              helperText='Applied to each selected doctor for this day'
                            />
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <CustomTextField
                              fullWidth
                              label='Notes (all doctor visits this day)'
                              multiline
                              minRows={2}
                              value={day.doctorNotes}
                              onChange={e => updateDay(dayIndex, { doctorNotes: e.target.value })}
                            />
                          </Grid>

                          <Grid size={{ xs: 12 }}>
                            <Typography variant='subtitle2' color='text.secondary' className='mbe-1'>
                              Other tasks
                            </Typography>
                            {day.otherTasks.length === 0 ? (
                              <Typography variant='body2' color='text.secondary' className='mbe-2'>
                                No extra tasks. Add one if needed.
                              </Typography>
                            ) : (
                              day.otherTasks.map((task, taskIndex) => (
                                <Grid container spacing={2} key={taskIndex} className='mbe-2' alignItems='flex-start'>
                                  <Grid size={{ xs: 12, sm: 5 }}>
                                    <CustomTextField
                                      fullWidth
                                      label='Task title'
                                      value={task.title}
                                      onChange={e => updateDayTask(dayIndex, taskIndex, { title: e.target.value })}
                                    />
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 6 }}>
                                    <CustomTextField
                                      fullWidth
                                      label='Notes'
                                      value={task.notes}
                                      onChange={e => updateDayTask(dayIndex, taskIndex, { notes: e.target.value })}
                                    />
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 1 }} className='flex items-center'>
                                    <IconButton
                                      aria-label='Remove task'
                                      color='error'
                                      onClick={() => removeOtherTask(dayIndex, taskIndex)}
                                    >
                                      <i className='tabler-trash' />
                                    </IconButton>
                                  </Grid>
                                </Grid>
                              ))
                            )}
                            <Button
                              size='small'
                              variant='text'
                              onClick={() => addOtherTask(dayIndex)}
                              startIcon={<i className='tabler-plus' />}
                            >
                              Add task
                            </Button>
                          </Grid>
                        </Grid>
                      </Paper>
                    )
                  })}
                </div>
              )}

              <Button
                variant='contained'
                onClick={handleSaveItems}
                disabled={saving || dayPlans.length === 0}
                startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
              >
                {saving ? 'Saving...' : 'Save items'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default WeeklyPlanDetailPage
