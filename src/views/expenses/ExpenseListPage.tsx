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
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { expensesService } from '@/services/expenses.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
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

type Expense = { _id: string; category: string; amount: number; description: string; date: string }
const categories = ['LOGISTICS','OFFICE','OTHER']
const columnHelper = createColumnHelper<Expense>()

const ExpenseListPage = () => {
  const [data, setData] = useState<Expense[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: 'OTHER', amount: 0, description: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFormValid = form.category !== '' && form.amount > 0

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('expenses.create')
  const canDelete = hasPermission('expenses.delete')

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

  const handleSave = async () => {
    setSaving(true)
    try { await expensesService.create(form); showSuccess('Expense added'); setOpen(false); fetchData() }
    catch (e: any) { showApiError(e, 'Error saving expense') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await expensesService.remove(deleteId); showSuccess('Expense deleted'); setConfirmOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Error deleting expense') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Expense, any>[]>(() => [
    columnHelper.accessor('category', { header: 'Category', cell: ({ row }) => <Chip label={row.original.category} size='small' variant='tonal' /> }),
    columnHelper.accessor('amount', { header: 'Amount', cell: ({ row }) => <Typography fontWeight={500}>₨ {row.original.amount?.toFixed(2)}</Typography> }),
    columnHelper.accessor('description', { header: 'Description' }),
    columnHelper.display({ id: 'date', header: 'Date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() }),
    columnHelper.display({ id: 'actions', header: '', cell: ({ row }) => canDelete ? <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton> : null })
  ], [canDelete])

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

  return (
    <Card>
      <CardHeader title='Expenses' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search description, category…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setForm({ category: 'OTHER', amount: 0, description: '' }); setOpen(true) }}>Add Expense</Button>}
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
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No expenses</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add Expense</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select required fullWidth label='Category' value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{categories.map(c => <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Amount' type='number' value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Description' value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Expense?'
        description='This expense record and its linked transaction will be removed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}
export default ExpenseListPage
