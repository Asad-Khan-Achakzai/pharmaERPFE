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
import { showApiError } from '@/utils/apiErrors'
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

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchOrders = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const { data: res } = await ordersService.list(params)
      if (seq !== fetchSeq.current) return
      setData(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load orders')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => {
    setFilterAnchor(e.currentTarget)
  }
  const closeFilterPopover = () => setFilterAnchor(null)

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
              <IconButton
                size='small'
                aria-label='Edit order'
                onClick={() => router.push(`/orders/${row.original._id}/edit`)}
              >
                <i className='tabler-edit text-textSecondary' />
              </IconButton>
            )}
            <IconButton size='small' aria-label='View order' onClick={() => router.push(`/orders/${row.original._id}`)}>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
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
        <DateAndCreatedByFilterPanel
          title='Filter orders'
          description='Narrow the list by date and who created the order.'
          dateSectionLabel='Order date'
          createdByHelperText='Matches the teammate who saved the order. Older rows may not have this set.'
          datePickerId='date-range-picker-months'
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
    </Card>
  )
}

export default OrderListPage
