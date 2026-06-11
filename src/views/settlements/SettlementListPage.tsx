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
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import { useRouter } from 'next/navigation'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
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
import TablePaginationComponent from '@components/TablePaginationComponent'
import { settlementsService } from '@/services/settlements.service'
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

type SettlementRow = {
  _id: string
  distributorId: any
  direction: string
  amount: number
  paymentMethod: string
  settledBy: any
  date: string
  notes?: string
  referenceNumber?: string
  isNetSettlement?: boolean
}

const columnHelper = createColumnHelper<SettlementRow>()

const directionLabel = (d: string) =>
  d === 'DISTRIBUTOR_TO_COMPANY' ? 'Distributor → company' : d === 'COMPANY_TO_DISTRIBUTOR' ? 'Company → distributor' : d

const toInputDate = (d: string | Date | undefined) => {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

const SettlementListPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payments.create')
  const canManage = canCreate
  const [data, setData] = useState<SettlementRow[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [loading, setLoading] = useState(true)
  const [viewItem, setViewItem] = useState<SettlementRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ date: '', notes: '', referenceNumber: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseId, setReverseId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseSaving, setReverseSaving] = useState(false)

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '200' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const { data: r } = await settlementsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(r.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load settlements')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openEdit = (row: SettlementRow) => {
    setEditingId(row._id)
    setEditForm({
      date: toInputDate(row.date),
      notes: row.notes || '',
      referenceNumber: row.referenceNumber || ''
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setEditSaving(true)
    try {
      await settlementsService.update(editingId, {
        date: editForm.date || undefined,
        notes: editForm.notes || undefined,
        referenceNumber: editForm.referenceNumber || undefined
      })
      showSuccess('Settlement updated')
      setEditOpen(false)
      setEditingId(null)
      setViewItem(null)
      await fetchData()
    } catch (err) {
      showApiError(err, 'Could not update settlement')
    } finally {
      setEditSaving(false)
    }
  }

  const openReverse = (row: SettlementRow) => {
    setReverseId(row._id)
    setReverseReason('')
    setReverseOpen(true)
  }

  const confirmReverse = async () => {
    if (!reverseId) return
    setReverseSaving(true)
    try {
      await settlementsService.reverse(reverseId, {
        reversalReason: reverseReason.trim() || undefined
      })
      showSuccess('Settlement reversed. Open remittance/commission balances were restored.')
      setReverseOpen(false)
      setReverseId(null)
      setViewItem(null)
      await fetchData()
    } catch (err) {
      showApiError(err, 'Could not reverse settlement')
    } finally {
      setReverseSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<SettlementRow, any>[]>(
    () => [
      columnHelper.display({
        id: 'distributor',
        header: 'Distributor',
        cell: ({ row }) => (
          <Typography fontWeight={500}>{row.original.distributorId?.name || '-'}</Typography>
        )
      }),
      columnHelper.accessor('direction', {
        header: 'Direction',
        cell: ({ row }) => (
          <Chip size='small' label={directionLabel(row.original.direction)} color='secondary' variant='outlined' />
        )
      }),
      columnHelper.accessor('amount', {
        header: 'Amount',
        cell: ({ row }) => `₨ ${row.original.amount?.toFixed(2)}`
      }),
      columnHelper.accessor('paymentMethod', { header: 'Method' }),
      columnHelper.display({
        id: 'date',
        header: 'Date',
        cell: ({ row }) => new Date(row.original.date).toLocaleDateString()
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <>
            <IconButton size='small' title='View' onClick={() => setViewItem(row.original)}>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
            {canManage && (
              <>
                <IconButton size='small' title='Edit' onClick={() => openEdit(row.original)}>
                  <i className='tabler-edit text-textSecondary' />
                </IconButton>
                <IconButton
                  size='small'
                  title='Reverse settlement'
                  color='warning'
                  onClick={() => openReverse(row.original)}
                >
                  <i className='tabler-arrow-back-up' />
                </IconButton>
              </>
            )}
          </>
        )
      })
    ],
    [canManage]
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

  return (
    <Card>
      <CardHeader title='Settlements' subheader='Distributor clearing (FIFO on server)' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search reference, notes, distributor…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push('/settlements/add')}>
            Record settlement
          </Button>
        )}
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter settlements'
          description='Filter by settlement date and who recorded it.'
          dateSectionLabel='Settlement date'
          createdByHelperText='Matches the teammate who saved the settlement.'
          datePickerId='settlements-list-date-range-picker-months'
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
                  No settlements
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

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Settlement details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Distributor
                </Typography>
                <Typography fontWeight={500}>{viewItem.distributorId?.name || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Direction
                </Typography>
                <Typography>{directionLabel(viewItem.direction)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Amount
                </Typography>
                <Typography>₨ {viewItem.amount?.toFixed(2)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Method
                </Typography>
                <Typography>{viewItem.paymentMethod}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Settled by
                </Typography>
                <Typography>{viewItem.settledBy?.name || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Date
                </Typography>
                <Typography>{new Date(viewItem.date).toLocaleDateString()}</Typography>
              </Grid>
              {viewItem.referenceNumber ? (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Reference
                  </Typography>
                  <Typography>{viewItem.referenceNumber}</Typography>
                </Grid>
              ) : null}
              {viewItem.notes ? (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Notes
                  </Typography>
                  <Typography>{viewItem.notes}</Typography>
                </Grid>
              ) : null}
            </Grid>
          )}
        </DialogContent>
        <DialogActions className='flex-wrap gap-2'>
          <Button onClick={() => setViewItem(null)}>Close</Button>
          {viewItem && canManage && (
            <>
              <Button
                variant='tonal'
                color='secondary'
                onClick={() => {
                  openEdit(viewItem)
                  setViewItem(null)
                }}
              >
                Edit
              </Button>
              <Button
                variant='tonal'
                color='warning'
                onClick={() => {
                  openReverse(viewItem)
                  setViewItem(null)
                }}
              >
                Reverse
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !editSaving && setEditOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Edit settlement</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <Typography variant='body2' color='text.secondary'>
            You can update date, reference, and notes. To change amount, distributor, or direction, reverse this entry
            and record a new settlement.
          </Typography>
          <CustomTextField
            fullWidth
            type='date'
            label='Settlement date'
            slotProps={{ inputLabel: { shrink: true } }}
            value={editForm.date}
            onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
          />
          <CustomTextField
            fullWidth
            label='Reference'
            value={editForm.referenceNumber}
            onChange={e => setEditForm(f => ({ ...f, referenceNumber: e.target.value }))}
          />
          <CustomTextField
            fullWidth
            label='Notes'
            multiline
            minRows={2}
            value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void saveEdit()} disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reverseOpen} onClose={() => !reverseSaving && setReverseOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Reverse settlement?</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <Typography variant='body2' color='text.secondary'>
            This undoes the distributor clearing payment: FIFO allocation links are removed, the settlement ledger entry
            is reversed, and the settlement disappears from active lists. Open remittance or commission balances will
            increase again.
          </Typography>
          <CustomTextField
            fullWidth
            label='Reason (optional)'
            multiline
            minRows={2}
            value={reverseReason}
            onChange={e => setReverseReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReverseOpen(false)} disabled={reverseSaving}>
            Cancel
          </Button>
          <Button variant='contained' color='warning' onClick={() => void confirmReverse()} disabled={reverseSaving}>
            {reverseSaving ? 'Reversing...' : 'Reverse settlement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
export default SettlementListPage
