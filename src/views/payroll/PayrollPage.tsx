'use client'

import { useCallback, useEffect, useMemo, useState, useRef, type MouseEvent } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { payrollService } from '@/services/payroll.service'
import { usersService } from '@/services/users.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { MoneyAccountSelect } from '@/components/finance/MoneyAccountSelect'
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

type Line = { name: string; amount: number }
type CommissionSnap = { type?: string; value?: number; salesTotal?: number; amount?: number }
type ProductIncentiveLine = {
  productId?: string
  productName?: string
  deliveredQty?: number
  includeBonusQty?: boolean
  matchedSlab?: { fromPacks?: number; toPacks?: number | null; ratePerPack?: number } | null
  amount?: number
  calculationType?: string
}

export type PayrollEntry = {
  _id: string
  employeeId: { _id?: string; name?: string } | string
  month: string
  periodFrom?: string
  periodTo?: string
  baseSalary: number
  bonus: number
  deductions: number
  netSalary: number
  grossSalary?: number
  status: string
  calculationMode?: string
  allowanceLines?: Line[]
  deductionLines?: Line[]
  commission?: CommissionSnap
  productIncentiveTotal?: number
  productIncentiveLines?: ProductIncentiveLine[]
  dailyAllowance?: number
  dailyAllowanceTotal?: number
  attendanceDeduction?: number
  presentDays?: number
  absentDays?: number
  halfDays?: number
  leaveDays?: number
  totalDaysInMonth?: number
  paidOn?: string
}

const columnHelper = createColumnHelper<PayrollEntry>()

const employeeName = (e: PayrollEntry['employeeId']) =>
  typeof e === 'object' && e && 'name' in e ? e.name ?? '-' : '-'

const employeeIdFromEntry = (e: PayrollEntry['employeeId']) =>
  typeof e === 'object' && e && '_id' in e && e._id
    ? String(e._id)
    : typeof e === 'string'
      ? e
      : ''

const parseYyyyMm = (s: string): Date | null => {
  const t = s.trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const [y, m] = t.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

const formatYyyyMm = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const defaultMonthYyyyMm = () => {
  const d = new Date()
  return formatYyyyMm(d)
}

const formatMonthLabel = (yyyyMm: string) => {
  const d = parseYyyyMm(yyyyMm)
  if (!d) return yyyyMm
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

type PendingPayrollRow = {
  payrollId: string
  employeeId: string
  name: string
  netSalary: number
  status: string
}

type MissingPayrollRow = {
  employeeId: string
  name: string
  salaryStructureName?: string | null
}

type PendingSummary = {
  month: string
  summary: {
    readyToPayCount: number
    unpaidTotal: number
    missingPayrollCount: number
    paidCount: number
  }
  readyToPay: PendingPayrollRow[]
  missingPayroll: MissingPayrollRow[]
}

const PayrollPage = () => {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payroll.create')
  const canEdit = hasPermission('payroll.edit')
  const canPay = hasPermission('payroll.pay')

  const [data, setData] = useState<PayrollEntry[]>([])
  const [users, setUsers] = useState<any[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [form, setForm] = useState({
    employeeId: '',
    month: '',
    baseSalary: 0,
    bonus: 0,
    deductions: 0
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [viewItem, setViewItem] = useState<PayrollEntry | null>(null)
  const [breakdownItem, setBreakdownItem] = useState<PayrollEntry | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [payTargetId, setPayTargetId] = useState<string | null>(null)
  const [payMoneyAccountId, setPayMoneyAccountId] = useState('')
  const [paying, setPaying] = useState(false)
  const [filterEmployeeId, setFilterEmployeeId] = useState('')
  const [filterMonth, setFilterMonth] = useState(() => defaultMonthYyyyMm())
  const [filterMonthFrom, setFilterMonthFrom] = useState('')
  const [filterMonthTo, setFilterMonthTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [pendingSummary, setPendingSummary] = useState<PendingSummary | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingWasStructure, setEditingWasStructure] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '200' }
      if (filterEmployeeId) params.employeeId = filterEmployeeId
      if (filterStatus) params.status = filterStatus
      if (filterMonth.trim()) params.month = filterMonth.trim()
      else {
        if (filterMonthFrom.trim()) params.monthFrom = filterMonthFrom.trim()
        if (filterMonthTo.trim()) params.monthTo = filterMonthTo.trim()
      }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const monthForPending = filterMonth.trim()
      const pendingPromise =
        /^\d{4}-\d{2}$/.test(monthForPending) ? payrollService.pendingSummary(monthForPending) : null
      const [p, u, pendingRes] = await Promise.all([
        payrollService.list(params),
        usersService.assignable(),
        pendingPromise ?? Promise.resolve(null)
      ])
      if (seq !== fetchSeq.current) return
      setData(p.data.data || [])
      setUsers(u.data.data || [])
      setPendingSummary(pendingRes ? (pendingRes.data.data as PendingSummary) : null)
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load payroll')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [
    filterEmployeeId,
    filterMonth,
    filterMonthFrom,
    filterMonthTo,
    filterStatus,
    appliedFilters,
    debouncedSearch
  ])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleDownloadPayslip = useCallback(async (id: string) => {
    setDownloadingId(id)
    try {
      const res = await payrollService.downloadPayslip(id)
      const blob = res.data as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip-${id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      showSuccess('Download started')
    } catch (err) {
      showApiError(err, 'Could not download payslip')
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const runPreview = async () => {
    if (!form.employeeId || !form.month.trim()) {
      showApiError(new Error('Employee and month are required'), 'Validation')
      return
    }
    setPreviewLoading(true)
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        month: form.month.trim()
      }
      if (manualMode) {
        body.manual = true
        body.baseSalary = form.baseSalary
        body.bonus = form.bonus
        body.deductions = form.deductions
      }
      const r = await payrollService.preview(body)
      setPreview(r.data.data)
    } catch (err) {
      showApiError(err, 'Preview failed')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePayrollDialog = () => {
    setOpen(false)
    setEditingId(null)
    setEditingWasStructure(false)
  }

  const openEditRow = useCallback((row: PayrollEntry) => {
    setEditingId(row._id)
    setEditingWasStructure(row.calculationMode === 'structure')
    setForm({
      employeeId: employeeIdFromEntry(row.employeeId),
      month: row.month,
      baseSalary: row.baseSalary,
      bonus: row.bonus,
      deductions: row.deductions
    })
    setManualMode(true)
    setPreview(null)
    setOpen(true)
  }, [])

  const openAddForEmployee = useCallback((employeeId: string, month: string) => {
    setEditingId(null)
    setEditingWasStructure(false)
    setForm({
      employeeId,
      month,
      baseSalary: 0,
      bonus: 0,
      deductions: 0
    })
    setManualMode(false)
    setPreview(null)
    setOpen(true)
  }, [])

  const handleSave = async () => {
    if (!form.employeeId || !form.month.trim()) {
      showApiError(new Error('Employee and month are required'), 'Validation')
      return
    }
    if (manualMode && form.baseSalary <= 0) {
      showApiError(new Error('Base salary must be greater than 0'), 'Validation')
      return
    }
    if (!editingId && !manualMode && !preview) {
      showApiError(new Error('Run preview before saving (structure-based payroll)'), 'Validation')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          baseSalary: form.baseSalary,
          bonus: form.bonus,
          deductions: form.deductions
        }
        if (editingWasStructure) body.manualOverride = true
        await payrollService.update(editingId, body)
        showSuccess('Payroll updated')
      } else {
        const body: Record<string, unknown> = {
          employeeId: form.employeeId,
          month: form.month.trim()
        }
        if (manualMode) {
          body.baseSalary = form.baseSalary
          body.bonus = form.bonus
          body.deductions = form.deductions
        }
        await payrollService.create(body)
        showSuccess('Payroll created')
      }
      closePayrollDialog()
      setPreview(null)
      setManualMode(false)
      fetchData()
    } catch (err) {
      showApiError(err, editingId ? 'Failed to update payroll' : 'Failed to create payroll')
    } finally {
      setSaving(false)
    }
  }

  const openPayConfirm = (id: string) => {
    setPayTargetId(id)
    setPayMoneyAccountId('')
    setConfirmPayOpen(true)
  }

  const closePayConfirm = () => {
    if (paying) return
    setConfirmPayOpen(false)
    setPayMoneyAccountId('')
  }

  const handlePay = useCallback(async () => {
    if (!payTargetId || !payMoneyAccountId) return
    setPaying(true)
    setPayingId(payTargetId)
    try {
      await payrollService.pay(payTargetId, { moneyAccountId: payMoneyAccountId })
      showSuccess('Marked as paid')
      setConfirmPayOpen(false)
      setPayMoneyAccountId('')
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to mark payroll as paid')
    } finally {
      setPaying(false)
      setPayingId(null)
    }
  }, [payTargetId, payMoneyAccountId])

  const openDeleteConfirm = useCallback((id: string) => {
    setDeleteTargetId(id)
    setConfirmDeleteOpen(true)
  }, [])

  const handleDeletePayroll = useCallback(async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      await payrollService.remove(deleteTargetId)
      showSuccess('Payroll deleted')
      setConfirmDeleteOpen(false)
      setDeleteTargetId(null)
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to delete payroll')
    } finally {
      setDeleting(false)
    }
  }, [deleteTargetId, fetchData])

  const fmt = (n: number | undefined) => (typeof n === 'number' ? n.toFixed(2) : '—')

  const columns = useMemo<ColumnDef<PayrollEntry, any>[]>(
    () => [
      columnHelper.display({
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => <Typography fontWeight={500}>{employeeName(row.original.employeeId)}</Typography>
      }),
      columnHelper.accessor('month', { header: 'Month' }),
      columnHelper.display({
        id: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <Chip
            size='small'
            variant='tonal'
            label={(row.original.calculationMode || 'manual') === 'structure' ? 'Structure' : 'Manual'}
          />
        )
      }),
      columnHelper.accessor('netSalary', {
        header: 'Net Salary',
        cell: ({ row }) => (
          <Typography fontWeight={500}>₨ {row.original.netSalary?.toFixed(2)}</Typography>
        )
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            label={row.original.status}
            color={row.original.status === 'PAID' ? 'success' : 'warning'}
            size='small'
            variant='tonal'
          />
        )
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex gap-1 items-center'>
            <IconButton size='small' onClick={() => setViewItem(row.original)}>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
            <IconButton size='small' onClick={() => setBreakdownItem(row.original)}>
              <i className='tabler-list-details text-textSecondary' />
            </IconButton>
            <IconButton
              size='small'
              title='Download payslip'
              onClick={() => handleDownloadPayslip(row.original._id)}
              disabled={downloadingId === row.original._id}
            >
              {downloadingId === row.original._id ? (
                <CircularProgress size={18} />
              ) : (
                <i className='tabler-file-download text-textSecondary' />
              )}
            </IconButton>
            {row.original.status !== 'PAID' && canEdit && (
              <>
                <IconButton size='small' title='Edit' onClick={() => openEditRow(row.original)}>
                  <i className='tabler-edit text-textSecondary' />
                </IconButton>
                <IconButton size='small' title='Delete' onClick={() => openDeleteConfirm(row.original._id)}>
                  <i className='tabler-trash text-textSecondary' />
                </IconButton>
              </>
            )}
            {row.original.status === 'PENDING' && canPay && (
              <Button
                size='small'
                variant='tonal'
                color='success'
                onClick={() => openPayConfirm(row.original._id)}
                disabled={payingId !== null}
                startIcon={payingId === row.original._id ? <CircularProgress size={20} color='inherit' /> : undefined}
              >
                {payingId === row.original._id ? 'Paying...' : 'Pay'}
              </Button>
            )}
          </div>
        )
      })
    ],
    [canPay, canEdit, payingId, downloadingId, handleDownloadPayslip, openEditRow, openDeleteConfirm]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => setFilterAnchor(e.currentTarget)
  const closeFilterPopover = () => setFilterAnchor(null)

  const pendingMonthLabel = filterMonth.trim() ? formatMonthLabel(filterMonth.trim()) : ''
  const hasPendingMonth = /^\d{4}-\d{2}$/.test(filterMonth.trim())
  const pendingSummaryData = hasPendingMonth ? pendingSummary : null

  return (
    <Card>
      <CardHeader
        title='Payroll'
        subheader='Review pending salaries for a month, then pay employees once payroll is created.'
      />
      {hasPendingMonth && (
        <CardContent className='pbs-0'>
          <Card variant='outlined'>
            <CardHeader
              title={`Pending salaries — ${pendingMonthLabel}`}
              subheader='Employees with unpaid payroll for this month, plus those on a salary structure who still need payroll created.'
              action={
                <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
                  <AppReactDatepicker
                    showMonthYearPicker
                    selected={parseYyyyMm(filterMonth) ?? new Date()}
                    dateFormat='yyyy-MM'
                    onChange={(date: Date | null) => {
                      if (!date) return
                      setFilterMonth(formatYyyyMm(date))
                      setFilterMonthFrom('')
                      setFilterMonthTo('')
                    }}
                    customInput={
                      <CustomTextField size='small' label='Payroll month' helperText='YYYY-MM' sx={{ minWidth: 160 }} />
                    }
                  />
                  {filterStatus === 'PENDING' ? (
                    <Button size='small' variant='tonal' onClick={() => setFilterStatus('')}>
                      Show all statuses
                    </Button>
                  ) : (
                    <Button
                      size='small'
                      variant='tonal'
                      onClick={() => setFilterStatus('PENDING')}
                      disabled={(pendingSummaryData?.summary.readyToPayCount ?? 0) === 0}
                    >
                      Filter table: pending only
                    </Button>
                  )}
                </Stack>
              }
            />
            <CardContent>
              {loading && !pendingSummaryData ? (
                <div className='flex justify-center p-4'>
                  <CircularProgress size={28} />
                </div>
              ) : pendingSummaryData ? (
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Ready to pay
                    </Typography>
                    <Typography variant='h5' color='warning.main'>
                      {pendingSummaryData.summary.readyToPayCount}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      ₨{' '}
                      {pendingSummaryData.summary.unpaidTotal.toLocaleString('en-PK', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}
                      total
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Payroll not created
                    </Typography>
                    <Typography variant='h5'>{pendingSummaryData.summary.missingPayrollCount}</Typography>
                    <Typography variant='caption' color='text.secondary'>
                      On salary structure, no row yet
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Already paid
                    </Typography>
                    <Typography variant='h5' color='success.main'>
                      {pendingSummaryData.summary.paidCount}
                    </Typography>
                  </Grid>

                  {pendingSummaryData.readyToPay.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant='subtitle2' className='mbe-2'>
                        Ready to pay
                      </Typography>
                      <div className='overflow-x-auto'>
                        <table className={tableStyles.table}>
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Net salary</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingSummaryData.readyToPay.map(row => (
                              <tr key={row.payrollId}>
                                <td>{row.name}</td>
                                <td>
                                  ₨{' '}
                                  {row.netSalary.toLocaleString('en-PK', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </td>
                                <td>
                                  {canPay && (
                                    <Button
                                      size='small'
                                      variant='contained'
                                      color='success'
                                      onClick={() => openPayConfirm(row.payrollId)}
                                      disabled={payingId !== null}
                                    >
                                      Pay
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Grid>
                  )}

                  {pendingSummaryData.missingPayroll.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant='subtitle2' className='mbe-2'>
                        Payroll not created yet
                      </Typography>
                      <div className='overflow-x-auto'>
                        <table className={tableStyles.table}>
                          <thead>
                            <tr>
                              <th>Employee</th>
                              <th>Salary structure</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingSummaryData.missingPayroll.map(row => (
                              <tr key={row.employeeId}>
                                <td>{row.name}</td>
                                <td>{row.salaryStructureName || '—'}</td>
                                <td>
                                  {canCreate && (
                                    <Button
                                      size='small'
                                      variant='tonal'
                                      onClick={() => openAddForEmployee(row.employeeId, filterMonth.trim())}
                                    >
                                      Create payroll
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Grid>
                  )}

                  {pendingSummaryData.summary.readyToPayCount === 0 &&
                    pendingSummaryData.summary.missingPayrollCount === 0 && (
                      <Grid size={{ xs: 12 }}>
                        <Alert severity='success' variant='outlined'>
                          All employees on a salary structure have payroll for {pendingMonthLabel}, and every payroll
                          row is paid.
                        </Alert>
                      </Grid>
                    )}
                </Grid>
              ) : null}
            </CardContent>
          </Card>
        </CardContent>
      )}

      <div className='flex flex-col gap-4 pli-6 pbe-4'>
        <div className='flex flex-wrap items-end gap-4'>
          <CustomTextField
            select
            sx={{ minWidth: 200 }}
            label='Filter employee'
            value={filterEmployeeId}
            onChange={e => setFilterEmployeeId(e.target.value)}
          >
            <MenuItem value=''>All</MenuItem>
            {users.map((u: any) => (
              <MenuItem key={u._id} value={u._id}>
                {u.name}
              </MenuItem>
            ))}
          </CustomTextField>
          <CustomTextField
            label='Month (YYYY-MM)'
            value={filterMonth}
            onChange={e => {
              setFilterMonth(e.target.value)
              if (e.target.value.trim()) {
                setFilterMonthFrom('')
                setFilterMonthTo('')
              }
            }}
            placeholder='Exact month'
            sx={{ minWidth: 140 }}
          />
          <CustomTextField
            select
            sx={{ minWidth: 140 }}
            label='Status'
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <MenuItem value=''>All</MenuItem>
            <MenuItem value='PENDING'>Pending</MenuItem>
            <MenuItem value='PAID'>Paid</MenuItem>
          </CustomTextField>
          <CustomTextField
            label='Month from'
            value={filterMonthFrom}
            onChange={e => setFilterMonthFrom(e.target.value)}
            placeholder='2026-01'
            sx={{ minWidth: 120 }}
          />
          <CustomTextField
            label='Month to'
            value={filterMonthTo}
            onChange={e => setFilterMonthTo(e.target.value)}
            placeholder='2026-03'
            sx={{ minWidth: 120 }}
          />
        </div>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
            <TableListSearchField
              value={searchInput}
              onChange={setSearchInput}
              onClear={clearSearch}
              placeholder='Search month, employee…'
            />
            <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
          </Stack>
        {canCreate && (
          <Button
            variant='contained'
            startIcon={<i className='tabler-plus' />}
            onClick={() => {
              setEditingId(null)
              setEditingWasStructure(false)
              setForm({
                employeeId: '',
                month: defaultMonthYyyyMm(),
                baseSalary: 0,
                bonus: 0,
                deductions: 0
              })
              setManualMode(false)
              setPreview(null)
              setOpen(true)
            }}
          >
            Add Payroll
          </Button>
        )}
        </div>
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter payroll'
          description='Narrow payroll runs by when the row was created and who created it.'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the payroll entry.'
          datePickerId='payroll-list-date-range-picker-months'
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
                  <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>
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
                  No payroll
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

      <Dialog open={open} onClose={closePayrollDialog} maxWidth='sm' fullWidth>
        <DialogTitle>{editingId ? 'Edit Payroll' : 'Add Payroll'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            {!editingId && (
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={manualMode}
                      onChange={(_, c) => {
                        setManualMode(c)
                        setPreview(null)
                      }}
                    />
                  }
                  label='Manual entry (base, bonus, deductions). If off, active salary structure is used.'
                />
              </Grid>
            )}
            {editingId && (
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Adjust base, bonus, and deductions.{' '}
                  {editingWasStructure
                    ? 'This row was built from a structure; saving converts it to manual totals.'
                    : null}
                </Typography>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                fullWidth
                label='Employee'
                value={form.employeeId}
                onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                disabled={!!editingId}
              >
                {users.map((u: any) => (
                  <MenuItem key={u._id} value={u._id}>
                    {u.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AppReactDatepicker
                showMonthYearPicker
                selected={parseYyyyMm(form.month) ?? new Date()}
                id='payroll-month-picker'
                dateFormat='yyyy-MM'
                onChange={(date: Date | null) => {
                  setForm(p => ({ ...p, month: date ? formatYyyyMm(date) : '' }))
                  setPreview(null)
                }}
                customInput={
                  <CustomTextField fullWidth label='Payroll month' helperText='YYYY-MM' disabled={!!editingId} />
                }
              />
            </Grid>
            {manualMode && (
              <>
                <Grid size={{ xs: 4 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Base Salary'
                    value={form.baseSalary}
                    onChange={e => setForm(p => ({ ...p, baseSalary: +e.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Bonus'
                    value={form.bonus}
                    onChange={e => setForm(p => ({ ...p, bonus: +e.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Deductions'
                    value={form.deductions}
                    onChange={e => setForm(p => ({ ...p, deductions: +e.target.value }))}
                  />
                </Grid>
              </>
            )}
            <Grid size={{ xs: 12 }} className='flex gap-2 flex-wrap'>
              <Button variant='tonal' onClick={runPreview} disabled={previewLoading}>
                {previewLoading ? 'Calculating...' : 'Preview'}
              </Button>
            </Grid>
            {preview && (
              <Grid size={{ xs: 12 }}>
                <Typography variant='subtitle2' className='mbe-2'>
                  Preview
                </Typography>
                <Typography variant='body2'>Gross: ₨ {fmt(preview.grossSalary as number)}</Typography>
                <Typography variant='body2'>Net: ₨ {fmt(preview.netSalary as number)}</Typography>
                {(preview.allowanceLines as Line[] | undefined)?.length ? (
                  <Typography variant='caption' display='block' className='mts-2'>
                    Allowances:{' '}
                    {(preview.allowanceLines as Line[]).map(l => `${l.name} (${l.amount})`).join(', ')}
                  </Typography>
                ) : null}
                {(preview.deductionLines as Line[] | undefined)?.length ? (
                  <Typography variant='caption' display='block'>
                    Deductions:{' '}
                    {(preview.deductionLines as Line[]).map(l => `${l.name} (${l.amount})`).join(', ')}
                  </Typography>
                ) : null}
                {preview.commission && (preview.commission as CommissionSnap).amount != null ? (
                  <Typography variant='caption' display='block'>
                    Commission (sales ₨ {fmt((preview.commission as CommissionSnap).salesTotal)}): ₨{' '}
                    {fmt((preview.commission as CommissionSnap).amount)}
                  </Typography>
                ) : null}
                {(preview.periodFrom != null || preview.periodTo != null) && (
                  <Typography variant='caption' display='block' className='mts-2'>
                    Incentive period:{' '}
                    {preview.periodFrom ? new Date(String(preview.periodFrom)).toLocaleDateString() : '—'} →{' '}
                    {preview.periodTo ? new Date(String(preview.periodTo)).toLocaleDateString() : '—'}
                  </Typography>
                )}
                {(preview.productIncentiveTotal as number | undefined) != null &&
                Number(preview.productIncentiveTotal) > 0 ? (
                  <>
                    <Typography variant='caption' display='block' className='mts-2'>
                      Product incentives (total): ₨ {fmt(preview.productIncentiveTotal as number)}
                    </Typography>
                    {((preview.productIncentiveLines as ProductIncentiveLine[]) || []).map((line, i) => (
                      <Typography key={`pi-${i}`} variant='caption' display='block' sx={{ pl: 1 }}>
                        · {line.productName}: {line.deliveredQty} packs → ₨ {fmt(line.amount)}
                        {line.matchedSlab
                          ? ` (slab ${line.matchedSlab.fromPacks}–${line.matchedSlab.toPacks ?? '∞'} @ ₨ ${line.matchedSlab.ratePerPack}/pack)`
                          : ''}
                      </Typography>
                    ))}
                  </>
                ) : null}
                {(preview.presentDays != null || preview.dailyAllowanceTotal != null) && (
                  <>
                    <Typography variant='caption' display='block' className='mts-2'>
                      Attendance: present {String(preview.presentDays ?? '—')}, absent {String(preview.absentDays ?? '—')}
                      , half {String(preview.halfDays ?? '—')}, leave {String(preview.leaveDays ?? '—')}
                    </Typography>
                    <Typography variant='caption' display='block'>
                      Daily allowance (earned): ₨ {fmt(preview.dailyAllowanceTotal as number)} (rate ₨{' '}
                      {fmt(preview.dailyAllowance as number)})
                    </Typography>
                    <Typography variant='caption' display='block'>
                      Attendance deduction: ₨ {fmt(preview.attendanceDeduction as number)}
                    </Typography>
                  </>
                )}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePayrollDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={
              saving ||
              (!editingId && !manualMode && !preview) ||
              (manualMode && form.baseSalary <= 0) ||
              !form.employeeId ||
              !form.month.trim()
            }
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Payroll Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Employee
                </Typography>
                <Typography fontWeight={500}>{employeeName(viewItem.employeeId)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Month
                </Typography>
                <Typography>{viewItem.month}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Mode
                </Typography>
                <Chip
                  size='small'
                  label={(viewItem.calculationMode || 'manual') === 'structure' ? 'Structure' : 'Manual'}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Net Salary
                </Typography>
                <Typography fontWeight={500}>₨ {fmt(viewItem.netSalary)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Status
                </Typography>
                <Chip
                  label={viewItem.status}
                  color={viewItem.status === 'PAID' ? 'success' : 'warning'}
                  size='small'
                  variant='tonal'
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewItem(null)}>Close</Button>
          <Button variant='tonal' onClick={() => viewItem && setBreakdownItem(viewItem)}>
            View breakdown
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!breakdownItem} onClose={() => setBreakdownItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Salary breakdown</DialogTitle>
        <DialogContent>
          {breakdownItem && (
            <Grid container spacing={2} className='pbs-4'>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Basic
                </Typography>
                <Typography>₨ {fmt(breakdownItem.baseSalary)}</Typography>
              </Grid>
              {breakdownItem.grossSalary != null && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Gross
                  </Typography>
                  <Typography fontWeight={600}>₨ {fmt(breakdownItem.grossSalary)}</Typography>
                </Grid>
              )}
              {(breakdownItem.allowanceLines ?? []).map((line, i) => (
                <Grid size={{ xs: 12 }} key={`a-${i}`}>
                  <Typography variant='body2' color='text.secondary'>
                    Allowance: {line.name}
                  </Typography>
                  <Typography>₨ {fmt(line.amount)}</Typography>
                </Grid>
              ))}
              {breakdownItem.commission && breakdownItem.commission.amount != null && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Commission ({breakdownItem.commission.value}% of sales ₨ {fmt(breakdownItem.commission.salesTotal)})
                  </Typography>
                  <Typography>₨ {fmt(breakdownItem.commission.amount)}</Typography>
                </Grid>
              )}
              {(breakdownItem.productIncentiveLines ?? []).length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                    Product incentives (total ₨ {fmt(breakdownItem.productIncentiveTotal)})
                  </Typography>
                  {(breakdownItem.productIncentiveLines ?? []).map((line, i) => (
                    <Typography key={`bpi-${i}`} variant='body2' sx={{ pl: 1 }}>
                      · {line.productName}: {line.deliveredQty} packs → ₨ {fmt(line.amount)}
                      {line.matchedSlab
                        ? ` (slab ${line.matchedSlab.fromPacks}–${line.matchedSlab.toPacks ?? '∞'} @ ₨ ${line.matchedSlab.ratePerPack}/pack)`
                        : ''}
                    </Typography>
                  ))}
                </Grid>
              )}
              {(breakdownItem.deductionLines ?? []).map((line, i) => (
                <Grid size={{ xs: 12 }} key={`d-${i}`}>
                  <Typography variant='body2' color='text.secondary'>
                    Deduction: {line.name}
                  </Typography>
                  <Typography>₨ {fmt(line.amount)}</Typography>
                </Grid>
              ))}
              {breakdownItem.calculationMode === 'structure' && (
                <>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Days (present / absent / half / leave)
                    </Typography>
                    <Typography>
                      {breakdownItem.presentDays ?? 0} / {breakdownItem.absentDays ?? 0} /{' '}
                      {breakdownItem.halfDays ?? 0} / {breakdownItem.leaveDays ?? 0} (month total{' '}
                      {breakdownItem.totalDaysInMonth ?? '—'})
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Daily allowance earned
                    </Typography>
                    <Typography>₨ {fmt(breakdownItem.dailyAllowanceTotal)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Attendance deduction (from basic)
                    </Typography>
                    <Typography color='error.main'>₨ {fmt(breakdownItem.attendanceDeduction)}</Typography>
                  </Grid>
                </>
              )}
              {!breakdownItem.deductionLines?.length && breakdownItem.calculationMode === 'manual' && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Deductions (legacy total)
                  </Typography>
                  <Typography>₨ {fmt(breakdownItem.deductions)}</Typography>
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Net
                </Typography>
                <Typography fontWeight={700}>₨ {fmt(breakdownItem.netSalary)}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant='tonal'
            startIcon={<i className='tabler-file-download' />}
            onClick={() => breakdownItem && handleDownloadPayslip(breakdownItem._id)}
            disabled={!breakdownItem || downloadingId === breakdownItem._id}
          >
            {downloadingId === breakdownItem?._id ? 'Downloading...' : 'Download payslip'}
          </Button>
          <Button onClick={() => setBreakdownItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmPayOpen} onClose={closePayConfirm} maxWidth='sm' fullWidth>
        <DialogTitle>Mark as paid?</DialogTitle>
        <DialogContent>
          <Typography color='text.secondary' className='mbe-4'>
            This marks the payroll as paid and creates a salary expense with GL posting.
            {payTargetId ? (
              <>
                {' '}
                Net salary:{' '}
                <strong>
                  ₨{' '}
                  {(
                    data.find(r => r._id === payTargetId)?.netSalary ?? 0
                  ).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </>
            ) : null}
          </Typography>
          <MoneyAccountSelect
            required
            label='Paid from (Cash/Bank account)'
            helperText='Which account this salary payment is paid from'
            value={payMoneyAccountId}
            onChange={id => setPayMoneyAccountId(id)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closePayConfirm} disabled={paying}>
            Cancel
          </Button>
          <Button
            variant='contained'
            color='success'
            onClick={handlePay}
            disabled={paying || !payMoneyAccountId}
            startIcon={paying ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {paying ? 'Processing...' : 'Yes, mark paid'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeletePayroll}
        title='Delete payroll?'
        description='This removes the unpaid payroll entry. Paid payroll cannot be deleted.'
        confirmText='Delete'
        confirmColor='error'
        icon='tabler-trash'
        loading={deleting}
      />
    </Card>
  )
}

export default PayrollPage
