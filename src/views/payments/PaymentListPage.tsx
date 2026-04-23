'use client'
import { useState, useEffect, useMemo } from 'react'
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
import CircularProgress from '@mui/material/CircularProgress'
import { useRouter } from 'next/navigation'
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
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { collectionsService } from '@/services/collections.service'
import tableStyles from '@core/styles/table.module.css'

type CollectionRow = {
  _id: string
  pharmacyId: any
  collectorType: string
  amount: number
  paymentMethod: string
  collectedBy: any
  date: string
  notes?: string
  referenceNumber?: string
}
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const r = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank: r })
  return r.passed
}
const columnHelper = createColumnHelper<CollectionRow>()

const collectorLabel = (t: string) =>
  t === 'COMPANY' ? 'Company' : t === 'DISTRIBUTOR' ? 'Distributor' : t

const PaymentListPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payments.create')
  const [data, setData] = useState<CollectionRow[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewItem, setViewItem] = useState<CollectionRow | null>(null)

  useEffect(() => {
    const f = async () => {
      setLoading(true)
      try {
        const { data: r } = await collectionsService.list({ limit: 200 })
        setData(r.data || [])
      } catch (err) {
        showApiError(err, 'Failed to load collections')
      } finally {
        setLoading(false)
      }
    }
    f()
  }, [])

  const columns = useMemo<ColumnDef<CollectionRow, any>[]>(
    () => [
      columnHelper.display({
        id: 'pharmacy',
        header: 'Pharmacy',
        cell: ({ row }) => (
          <Typography fontWeight={500}>{row.original.pharmacyId?.name || '-'}</Typography>
        )
      }),
      columnHelper.accessor('collectorType', {
        header: 'Collector',
        cell: ({ row }) => (
          <Chip size='small' label={collectorLabel(row.original.collectorType)} variant='outlined' color='primary' />
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
          <IconButton size='small' onClick={() => setViewItem(row.original)}>
            <i className='tabler-eye text-textSecondary' />
          </IconButton>
        )
      })
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Collections' subheader='Pharmacy receipts (company or distributor collector)' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder='Search...'
        />
        {canCreate && (
          <Button
            variant='contained'
            startIcon={<i className='tabler-plus' />}
            onClick={() => router.push('/payments/add')}
          >
            Record collection
          </Button>
        )}
      </div>
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
                  No collections
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
        <DialogTitle>Collection details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Pharmacy
                </Typography>
                <Typography fontWeight={500}>{viewItem.pharmacyId?.name || '-'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Collector
                </Typography>
                <Typography>{collectorLabel(viewItem.collectorType)}</Typography>
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
                  Collected by
                </Typography>
                <Typography>{viewItem.collectedBy?.name || '-'}</Typography>
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
        <DialogActions>
          <Button onClick={() => setViewItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
export default PaymentListPage
