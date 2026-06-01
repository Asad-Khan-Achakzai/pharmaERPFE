'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
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
import TablePaginationComponent from '@components/TablePaginationComponent'
import { expensesService } from '@/services/expenses.service'
import { accountService } from '@/services/account.service'
import { ExpenseAccountSelect } from '@/components/finance/ExpenseAccountSelect'
import { MoneyAccountSelect } from '@/components/finance/MoneyAccountSelect'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { ACCOUNTING_UX, friendlyAccountLabel } from '@/constants/accountingUx'
import type { Account } from '@/types/accounting'
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

const LAST_MONEY_ACCOUNT_KEY = 'pharmaerp:expense:lastMoneyAccountId'

type ExpenseRow = {
  _id: string
  amount: number
  description?: string
  date: string
  expenseAccountId?: { _id: string; code: string; name: string } | string
  moneyAccountId?: { _id: string; code: string; name: string } | string
  voucherId?: { _id: string; voucherNumber: string } | string
}

type ExpenseForm = {
  expenseAccountId: string
  moneyAccountId: string
  amount: number
  description: string
  date: string
}

type ExpenseShortcut = {
  label: string
  codes?: string[]
  nameMatch?: RegExp
}

const EXPENSE_SHORTCUTS: ExpenseShortcut[] = [
  { label: 'Salary', codes: ['6110'], nameMatch: /salary/i },
  { label: 'Rent', codes: ['6120'], nameMatch: /rent/i },
  { label: 'Fuel / Logistics', codes: ['6130'], nameMatch: /logistic|fuel|transport/i },
  { label: 'Utilities', nameMatch: /utilit|electric|gas|water/i },
  { label: 'Office', codes: ['6100'], nameMatch: /office|general operating/i }
]

const getLocalDateISO = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const emptyForm = (): ExpenseForm => ({
  expenseAccountId: '',
  moneyAccountId: typeof window !== 'undefined' ? localStorage.getItem(LAST_MONEY_ACCOUNT_KEY) || '' : '',
  amount: 0,
  description: '',
  date: getLocalDateISO()
})

const accountLabel = (acc?: { code: string; name: string } | string | null) => {
  if (!acc || typeof acc === 'string') return '—'
  return friendlyAccountLabel(acc.code, acc.name, false)
}

const resolveShortcutAccount = (accounts: Account[], shortcut: ExpenseShortcut): Account | undefined =>
  accounts.find(
    a =>
      (shortcut.codes?.includes(a.code) ?? false) ||
      (shortcut.nameMatch?.test(a.name) ?? false) ||
      (shortcut.nameMatch?.test(`${a.code} ${a.name}`) ?? false)
  )

const columnHelper = createColumnHelper<ExpenseRow>()

const ExpenseListPage = () => {
  const [data, setData] = useState<ExpenseRow[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ExpenseForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFormValid = form.expenseAccountId !== '' && form.moneyAccountId !== '' && form.amount > 0

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('expenses.create')
  const canDelete = hasPermission('expenses.delete')

  useEffect(() => {
    void accountService
      .businessView()
      .then(({ data: r }) => setExpenseAccounts(r.data?.expenseCategories || []))
      .catch(() => setExpenseAccounts([]))
  }, [])

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const { data: r } = await expensesService.list(params)
      if (seq !== fetchSeq.current) return
      setData(r.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load expenses')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openCreateDialog = () => {
    setForm(emptyForm())
    setOpen(true)
  }

  const handleSave = async () => {
    if (!isFormValid) return
    setSaving(true)
    try {
      await expensesService.create({
        expenseAccountId: form.expenseAccountId,
        moneyAccountId: form.moneyAccountId,
        amount: form.amount,
        description: form.description || undefined,
        date: form.date
      })
      localStorage.setItem(LAST_MONEY_ACCOUNT_KEY, form.moneyAccountId)
      showSuccess('Expense recorded')
      setOpen(false)
      void fetchData()
    } catch (e: unknown) {
      showApiError(e, 'Failed to record expense')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = (id: string) => {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await expensesService.remove(deleteId)
      showSuccess('Expense deleted')
      setConfirmOpen(false)
      void fetchData()
    } catch (err) {
      showApiError(err, 'Failed to delete expense')
    } finally {
      setDeleting(false)
    }
  }, [deleteId, fetchData])

  const columns = useMemo<ColumnDef<ExpenseRow, any>[]>(
    () => [
      columnHelper.display({
        id: 'expenseType',
        header: 'Expense',
        cell: ({ row }) => (
          <Typography fontWeight={500}>{accountLabel(row.original.expenseAccountId as ExpenseRow['expenseAccountId'])}</Typography>
        )
      }),
      columnHelper.display({
        id: 'paidFrom',
        header: 'Paid from',
        cell: ({ row }) => accountLabel(row.original.moneyAccountId as ExpenseRow['moneyAccountId'])
      }),
      columnHelper.accessor('amount', {
        header: 'Amount',
        cell: ({ row }) => <Typography fontWeight={600}>₨ {row.original.amount?.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</Typography>
      }),
      columnHelper.accessor('description', {
        header: 'Narration',
        cell: ({ row }) => row.original.description || '—'
      }),
      columnHelper.display({
        id: 'voucher',
        header: 'Voucher',
        cell: ({ row }) => {
          const v = row.original.voucherId
          if (!v || typeof v === 'string') return '—'
          return <Chip label={v.voucherNumber} size='small' variant='outlined' />
        }
      }),
      columnHelper.display({
        id: 'date',
        header: 'Date',
        cell: ({ row }) => new Date(row.original.date).toLocaleDateString()
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canDelete ? (
            <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}>
              <i className='tabler-trash text-textSecondary' />
            </IconButton>
          ) : null
      })
    ],
    [canDelete]
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

  const applyShortcut = (shortcut: ExpenseShortcut) => {
    const match = resolveShortcutAccount(expenseAccounts, shortcut)
    if (match) setForm(p => ({ ...p, expenseAccountId: match._id }))
  }

  return (
    <Card>
      <CardHeader
        title={ACCOUNTING_UX.allExpenses}
        subheader='Record what you spent, where the money came from — accounting entries are created automatically'
      />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search narration…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreateDialog}>
            {ACCOUNTING_UX.recordExpense}
          </Button>
        )}
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter expenses'
          description='Filter by the expense posting date (business date) and who recorded it.'
          dateSectionLabel='Expense date'
          createdByHelperText='Matches the teammate who entered the expense.'
          datePickerId='expense-list-date-range-picker-months'
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
                  No expenses recorded yet
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
      <TablePaginationComponent table={table as never} />

      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{ACCOUNTING_UX.recordExpense}</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mbe-4'>
            {ACCOUNTING_UX.autoAccountingHint}
          </Typography>
          <Grid container spacing={4} className='pbs-2'>
            <Grid size={{ xs: 12 }}>
              <Typography variant='subtitle2' className='mbe-2'>
                What did you spend on?
              </Typography>
              <Stack direction='row' flexWrap='wrap' gap={1} className='mbe-3'>
                {EXPENSE_SHORTCUTS.map(s => {
                  const match = resolveShortcutAccount(expenseAccounts, s)
                  return (
                    <Chip
                      key={s.label}
                      label={s.label}
                      clickable
                      color={form.expenseAccountId === match?._id ? 'primary' : 'default'}
                      variant={form.expenseAccountId === match?._id ? 'filled' : 'outlined'}
                      disabled={!match}
                      onClick={() => match && applyShortcut(s)}
                    />
                  )
                })}
              </Stack>
              <ExpenseAccountSelect
                accounts={expenseAccounts}
                value={form.expenseAccountId}
                onChange={id => setForm(p => ({ ...p, expenseAccountId: id }))}
                label='Expense type'
                helperText='Choose from your expense accounts — or pick a shortcut above'
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <MoneyAccountSelect
                value={form.moneyAccountId}
                onChange={id => setForm(p => ({ ...p, moneyAccountId: id }))}
                label='Paid from'
                helperText='Where did the money come from?'
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Amount'
                type='number'
                inputProps={{ min: 0.01, step: 0.01 }}
                value={form.amount || ''}
                onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) || 0 }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='date'
                label='Date'
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Description / narration'
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder='Optional details for your records'
              />
            </Grid>
          </Grid>
          <Paper variant='outlined' className='mts-4 p-3'>
            <Typography variant='caption' color='text.secondary'>
              A payment voucher will be posted automatically: expense account (debit) and selected cash/bank account
              (credit). You do not need to enter debits or credits.
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={() => void handleSave()}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Posting…' : 'Record expense'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete expense?'
        description='This removes the expense record. The posted voucher remains in the ledger for audit — contact your accountant if a reversal is needed.'
        confirmText='Yes, delete'
        loading={deleting}
      />
    </Card>
  )
}

export default ExpenseListPage
