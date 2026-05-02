'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import CustomTextField from '@core/components/mui/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
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
import TablePaginationComponent from '@components/TablePaginationComponent'
import { ordersService } from '@/services/orders.service'
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

type Order = {
  _id: string
  orderNumber: string
  pharmacyId: any
  distributorId: any
  medicalRepId: any
  status: string
  totalOrderedAmount: number
  createdAt: string
}

const statusColors: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
  PENDING: 'warning',
  PARTIALLY_DELIVERED: 'info',
  DELIVERED: 'success',
  PARTIALLY_RETURNED: 'warning',
  RETURNED: 'error',
  CANCELLED: 'default'
}

const columnHelper = createColumnHelper<Order>()

/** '' = default (API omits status → backend excludes CANCELLED). ALL = every status. */
const ORDER_LIST_STATUS_FILTER = [
  { value: '', label: 'Active (hide cancelled)' },
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_DELIVERED', label: 'Partially delivered' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'PARTIALLY_RETURNED', label: 'Partially returned' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' }
] as const

const OrderListPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('orders.create')
  const canEdit = hasPermission('orders.edit')
  const [data, setData] = useState<Order[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [loading, setLoading] = useState(true)
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount =
    countDateUserFilters(appliedFilters) + (statusFilter !== '' ? 1 : 0)

  const fetchOrders = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      if (statusFilter === 'ALL') params.status = 'ALL'
      else if (statusFilter !== '') params.status = statusFilter
      const { data: res } = await ordersService.list(params)
      if (seq !== fetchSeq.current) return
      setData(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load orders')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch, statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => {
    setFilterAnchor(e.currentTarget)
  }
  const closeFilterPopover = () => setFilterAnchor(null)

  const handleCancelOrder = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await ordersService.cancel(cancelTarget._id)
      showSuccess('Order cancelled')
      setCancelTarget(null)
      fetchOrders()
    } catch (err) {
      showApiError(err, 'Failed to cancel order')
    } finally {
      setCancelling(false)
    }
  }

  const columns = useMemo<ColumnDef<Order, any>[]>(
    () => [
      columnHelper.accessor(
        r => {
          const name = typeof r.pharmacyId === 'object' && r.pharmacyId?.name ? String(r.pharmacyId.name) : ''
          return `${name} ${r.orderNumber}`.trim()
        },
        {
          id: 'pharmacy',
          header: 'Pharmacy',
          cell: ({ row }) => {
            const name =
              typeof row.original.pharmacyId === 'object' && row.original.pharmacyId?.name
                ? row.original.pharmacyId.name
                : null
            return (
              <Typography
                fontWeight={500}
                color='primary'
                className='cursor-pointer'
                onClick={() => router.push(`/orders/${row.original._id}`)}
              >
                {name ?? '—'}
              </Typography>
            )
          }
        }
      ),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            label={row.original.status}
            color={statusColors[row.original.status] || 'default'}
            size='small'
            variant='tonal'
          />
        )
      }),
      columnHelper.accessor('totalOrderedAmount', {
        header: 'Amount',
        cell: ({ row }) => `₨ ${row.original.totalOrderedAmount?.toFixed(2)}`
      }),
      columnHelper.display({
        id: 'date',
        header: 'Date',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString()
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex items-center'>
            {canEdit && row.original.status === 'PENDING' && (
              <>
                <Tooltip title='Edit'>
                  <IconButton
                    size='small'
                    aria-label='Edit order'
                    onClick={() => router.push(`/orders/${row.original._id}/edit`)}
                  >
                    <i className='tabler-edit text-textSecondary' />
                  </IconButton>
                </Tooltip>
                <Tooltip title='Cancel order'>
                  <IconButton
                    size='small'
                    color='error'
                    aria-label='Cancel order'
                    onClick={() => setCancelTarget(row.original)}
                  >
                    <i className='tabler-trash text-textSecondary' />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Tooltip title='View'>
              <IconButton
                size='small'
                aria-label='View order'
                onClick={() => router.push(`/orders/${row.original._id}`)}
              >
                <i className='tabler-eye text-textSecondary' />
              </IconButton>
            </Tooltip>
          </div>
        )
      })
    ],
    [router, canEdit]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Orders' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search pharmacy, order #…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push('/orders/add')}>
            Create Order
          </Button>
        )}
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 0 }}>
          <Typography
            variant='overline'
            sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', display: 'block', mb: 1 }}
          >
            Status
          </Typography>
          <CustomTextField
            select
            fullWidth
            size='small'
            label='Order status'
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {ORDER_LIST_STATUS_FILTER.map(opt => (
              <MenuItem key={opt.value || 'default'} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </CustomTextField>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1, lineHeight: 1.5 }}>
            Default hides cancelled orders. Choose &quot;All statuses&quot; or &quot;Cancelled&quot; to include them.
          </Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <DateAndCreatedByFilterPanel
          title='More filters'
          description='Narrow the list by date and who created the order.'
          dateSectionLabel='Order date'
          createdByHelperText='Matches the teammate who saved the order. Older rows may not have this set.'
          datePickerId='date-range-picker-months'
          appliedFilters={appliedFilters}
          onAppliedChange={setAppliedFilters}
          filterAnchor={filterAnchor}
          open={filterOpen}
          onClose={closeFilterPopover}
          onClearAllExtras={() => setStatusFilter('')}
        />
      </ListFilterPopover>

      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>
                    {h.isPlaceholder ? null : (
                      <div
                        className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
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
                  No orders found
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

      <Dialog open={Boolean(cancelTarget)} onClose={() => !cancelling && setCancelTarget(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Cancel order?</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            {cancelTarget
              ? `This will cancel ${cancelTarget.orderNumber}. This action cannot be undone from the list.`
              : null}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling}>
            No, keep it
          </Button>
          <Button color='error' variant='contained' onClick={handleCancelOrder} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Yes, cancel order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default OrderListPage
