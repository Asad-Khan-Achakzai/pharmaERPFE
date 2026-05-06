'use client'
import { useState, useEffect, useMemo, forwardRef, useCallback, useRef, type MouseEvent } from 'react'
import type { TextFieldProps } from '@mui/material/TextField'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { usersService } from '@/services/users.service'
import { filterMedicalReps } from '@/utils/userLookups'
import tableStyles from '@core/styles/table.module.css'
import {
  TableListSearchField,
  TableListFilterIconButton,
  ListFilterPopover,
  DateAndCreatedByFilterPanel,
  useDebouncedSearch,
  emptyDateUserFilters,
  countDateUserFilters,
  appendDateUserParams,
  type DateUserFilterState
} from '@/components/standard-list-toolbar'
import { TeamScopeToggle, type TeamScope } from '@/components/team-scope/TeamScopeToggle'

type Plan = {
  _id: string
  medicalRepId: any
  weekStartDate: string
  weekEndDate: string
  status: string
  notes?: string
  doctorVisits?: any[]
  distributorVisits?: any[]
  planItems?: any[]
  planItemsCount?: number
}

const columnHelper = createColumnHelper<Plan>()

function formatRangeDisplay(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

type WeekRangeInputProps = TextFieldProps & {
  label: string
  end: Date | null
  start: Date | null
}

const WeekRangeCustomInput = forwardRef<HTMLInputElement, WeekRangeInputProps>(
  function WeekRangeCustomInput({ label, start, end, slotProps, ...rest }, ref) {
    const value =
      !start
        ? ''
        : !end
          ? `${formatRangeDisplay(start)} – …`
          : `${formatRangeDisplay(start)} - ${formatRangeDisplay(end)}`
    return (
      <CustomTextField
        fullWidth
        inputRef={ref}
        required
        {...rest}
        label={label}
        value={value}
        slotProps={{ ...slotProps, htmlInput: { readOnly: true, ...slotProps?.htmlInput } }}
      />
    )
  }
)

const WeeklyPlansPage = () => {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('weeklyPlans.create')
  const canSeeTeam = hasPermission('team.viewAllReports') || hasPermission('admin.access')
  const [data, setData] = useState<Plan[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [scope, setScope] = useState<TeamScope>(canSeeTeam ? 'team' : 'self')
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    medicalRepId: '',
    weekStartDate: '',
    weekEndDate: '',
    notes: '',
    status: 'DRAFT'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isFormValid =
    form.weekStartDate !== '' &&
    form.weekEndDate !== '' &&
    (reps.length > 0 ? form.medicalRepId !== '' : Boolean(user?._id))

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      if (canSeeTeam && scope === 'team') params.scope = 'team'
      const [r, u] = await Promise.all([weeklyPlansService.list(params), usersService.assignable()])
      if (seq !== fetchSeq.current) return
      setData(r.data.data || [])
      setReps(filterMedicalReps(u.data.data || []))
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load weekly plans')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch, scope, canSeeTeam])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleSave = async () => {
    const medicalRepId = reps.length > 0 ? form.medicalRepId : user?._id
    if (!medicalRepId) {
      showApiError(null, 'Could not determine assignee')
      return
    }
    setSaving(true)
    try {
      await weeklyPlansService.create({
        medicalRepId,
        weekStartDate: form.weekStartDate,
        weekEndDate: form.weekEndDate,
        notes: form.notes || undefined,
        status: form.status
      })
      showSuccess('Plan created')
      setOpen(false)
      setForm({
        medicalRepId: '',
        weekStartDate: '',
        weekEndDate: '',
        notes: '',
        status: 'DRAFT'
      })
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to create plan')
    } finally {
      setSaving(false)
    }
  }

  const itemCount = (p: Plan) =>
    (p.planItemsCount ?? 0) > 0
      ? p.planItemsCount!
      : (p.doctorVisits?.length || 0) + (p.distributorVisits?.length || 0)

  const columns = useMemo<ColumnDef<Plan, any>[]>(
    () => [
      columnHelper.display({
        id: 'rep',
        header: 'Rep',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.medicalRepId?.name || '-'}</Typography>
      }),
      columnHelper.display({
        id: 'week',
        header: 'Week',
        cell: ({ row }) =>
          `${new Date(row.original.weekStartDate).toLocaleDateString()} - ${new Date(row.original.weekEndDate).toLocaleDateString()}`
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          const color =
            s === 'COMPLETED' || s === 'REVIEWED'
              ? 'success'
              : s === 'ACTIVE' || s === 'SUBMITTED'
                ? 'info'
                : 'default'
          return <Chip label={s} color={color as any} size='small' variant='tonal' />
        }
      }),
      columnHelper.display({
        id: 'visits',
        header: 'Items',
        cell: ({ row }) => {
          const n = itemCount(row.original)
          const legacy = (row.original.doctorVisits?.length || 0) + (row.original.distributorVisits?.length || 0)
          const hasNew = (row.original.planItemsCount ?? 0) > 0
          return !hasNew && legacy > 0 ? `${legacy} (legacy)` : `${n} scheduled`
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button size='small' variant='outlined' onClick={() => router.push(`/weekly-plans/${row.original._id}`)}>
            Open
          </Button>
        )
      })
    ],
    [router]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => setFilterAnchor(e.currentTarget)
  const closeFilterPopover = () => setFilterAnchor(null)

  return (
    <Card>
      <CardHeader
        title='Weekly Plans'
        action={
          canCreate && (
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => {
                setForm({
                  medicalRepId: reps.length > 0 ? '' : user?._id || '',
                  weekStartDate: '',
                  weekEndDate: '',
                  notes: '',
                  status: 'DRAFT'
                })
                setOpen(true)
              }}
            >
              New Plan
            </Button>
          )
        }
      />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search notes, rep…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
          {canSeeTeam && <TeamScopeToggle value={scope} onChange={setScope} />}
        </Stack>
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter weekly plans'
          description='Narrow plans by when they were created and who created them.'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the plan.'
          datePickerId='weekly-plans-date-range-picker-months'
          appliedFilters={appliedFilters}
          onAppliedChange={setAppliedFilters}
          filterAnchor={filterAnchor}
          open={filterOpen}
          onClose={closeFilterPopover}
        />
      </ListFilterPopover>

      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  No plans
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth='sm'
        fullWidth
        slotProps={{ paper: { sx: { overflow: 'visible' } } }}
      >
        <DialogTitle>Create Weekly Plan</DialogTitle>
        <DialogContent sx={{ overflow: 'visible' }}>
          <Grid container spacing={4} className='pbs-4'>
            {reps.length > 0 ? (
              <Grid size={{ xs: 12 }}>
                <CustomTextField
                  required
                  select
                  fullWidth
                  label='Medical rep'
                  value={form.medicalRepId}
                  onChange={e => setForm(p => ({ ...p, medicalRepId: e.target.value }))}
                >
                  {reps.map((u: any) => (
                    <MenuItem key={u._id} value={u._id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
            ) : (
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  This plan will be assigned to you ({user?.name || 'current user'}).
                </Typography>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <AppReactDatepicker
                selectsRange
                endDate={parseYyyyMmDd(form.weekEndDate) ?? null}
                startDate={parseYyyyMmDd(form.weekStartDate) ?? null}
                selected={parseYyyyMmDd(form.weekStartDate) ?? null}
                id='weekly-plan-week-range'
                onChange={dates => {
                  if (!dates) {
                    setForm(p => ({ ...p, weekStartDate: '', weekEndDate: '' }))
                    return
                  }
                  const [s, e] = dates
                  setForm(p => ({
                    ...p,
                    weekStartDate: s ? formatYyyyMmDd(s) : '',
                    weekEndDate: e ? formatYyyyMmDd(e) : ''
                  }))
                }}
                shouldCloseOnSelect={false}
                placeholderText='Week start – end'
                customInput={
                  <WeekRangeCustomInput
                    label='Week (start – end)'
                    start={parseYyyyMmDd(form.weekStartDate) ?? null}
                    end={parseYyyyMmDd(form.weekEndDate) ?? null}
                  />
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                select
                fullWidth
                label='Status'
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value='DRAFT'>Draft</MenuItem>
                <MenuItem value='ACTIVE'>Active</MenuItem>
                <MenuItem value='COMPLETED'>Completed</MenuItem>
                <MenuItem value='SUBMITTED'>Submitted (legacy)</MenuItem>
                <MenuItem value='REVIEWED'>Reviewed (legacy)</MenuItem>
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes'
                multiline
                rows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
export default WeeklyPlansPage
