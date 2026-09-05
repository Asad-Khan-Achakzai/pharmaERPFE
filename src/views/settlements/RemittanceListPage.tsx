'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { useRouter } from 'next/navigation'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { remittancesService } from '@/services/remittances.service'
import tableStyles from '@core/styles/table.module.css'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'

const formatPKR = (v: number) =>
  `PKR ${Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

type Row = {
  _id: string
  distributorId: any
  collectedAmount: number
  expectedAmount: number
  receivedAmount: number
  differenceAmount: number
  date: string
  postedBy: any
  status?: string
}

const columnHelper = createColumnHelper<Row>()

const RemittanceListPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payments.create')
  const [data, setData] = useState<Row[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<any | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [reversing, setReversing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await remittancesService.list({
        page: page + 1,
        limit: pageSize,
        ...(debouncedSearch ? { search: debouncedSearch } : {})
      })
      setData(r.data.data || [])
      setTotal(r.data.pagination?.total || 0)
    } catch (err) {
      showApiError(err, 'Failed to load remittances')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  const openView = useCallback(async (row: Row) => {
    setView(row)
    setDetail(null)
    try {
      const r = await remittancesService.getById(row._id)
      setDetail(r.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load remittance')
    }
  }, [])

  const handleReverse = async () => {
    if (!view) return
    setReversing(true)
    try {
      await remittancesService.reverse(view._id)
      showSuccess('Remittance reversed')
      setView(null)
      await load()
    } catch (err) {
      showApiError(err, 'Failed to reverse remittance')
    } finally {
      setReversing(false)
    }
  }

  const columns = useMemo<ColumnDef<Row, any>[]>(
    () => [
      columnHelper.accessor(r => r.distributorId?.name || '—', {
        id: 'distributor',
        header: 'Distributor',
        cell: info => info.getValue()
      }),
      columnHelper.accessor('collectedAmount', {
        header: 'Collected',
        cell: info => formatPKR(info.getValue())
      }),
      columnHelper.accessor('expectedAmount', {
        header: 'Expected',
        cell: info => formatPKR(info.getValue())
      }),
      columnHelper.accessor('receivedAmount', {
        header: 'Received',
        cell: info => formatPKR(info.getValue())
      }),
      columnHelper.accessor('differenceAmount', {
        header: 'Difference',
        cell: info => {
          const v = Number(info.getValue()) || 0
          return (
            <Chip
              size='small'
              variant='outlined'
              color={v < -0.001 ? 'warning' : v > 0.001 ? 'error' : 'success'}
              label={formatPKR(v)}
            />
          )
        }
      }),
      columnHelper.accessor('date', {
        header: 'Date',
        cell: info => (info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-PK') : '—')
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <IconButton size='small' onClick={() => void openView(row.original)}>
            <i className='tabler-eye' />
          </IconButton>
        )
      })
    ],
    [openView]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize) || 1,
    state: { pagination: { pageIndex: page, pageSize } },
    onPaginationChange: updater => {
      const next = typeof updater === 'function' ? updater({ pageIndex: page, pageSize }) : updater
      setPage(next.pageIndex)
      setPageSize(next.pageSize)
    }
  })

  return (
    <Card>
      <CardHeader
        title='Remittances'
        subheader='Distributor handovers of company share. Expected remittance is company share, not total collected from pharmacies.'
        action={
          canCreate ? (
            <Button variant='contained' onClick={() => router.push('/settlements/remittance')}>
              Receive remittance
            </Button>
          ) : undefined
        }
      />
      <div className='flex flex-wrap items-center gap-3 p-4'>
        <TableListSearchField value={searchInput} onChange={setSearchInput} onClear={clearSearch} />
        {loading && <CircularProgress size={20} />}
      </div>
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='text-center'>
                  No remittances
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
      <TablePaginationComponent table={table as any} serverPagination={{ total }} />

      <Dialog open={!!view} onClose={() => setView(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Remittance</DialogTitle>
        <DialogContent>
          {detail ? (
            <Stack spacing={1} className='p-1'>
              <Typography>{detail.distributorId?.name}</Typography>
              <Typography variant='body2'>Total collected {formatPKR(detail.collectedAmount)}</Typography>
              <Typography variant='body2'>Expected (company share) {formatPKR(detail.expectedAmount)}</Typography>
              <Typography variant='body2'>Received {formatPKR(detail.receivedAmount)}</Typography>
              <Typography variant='body2'>Difference {formatPKR(detail.differenceAmount)}</Typography>
              {detail.differenceReason ? (
                <Typography variant='body2'>Shortage reason {String(detail.differenceReason).replace(/_/g, ' ').toLowerCase()}</Typography>
              ) : null}
              <Typography variant='subtitle2' className='mbs-2'>
                Collections
              </Typography>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Pharmacy</TableCell>
                    <TableCell align='right'>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detail.collections || []).map((c: any) => (
                    <TableRow key={c._id}>
                      <TableCell>{c.pharmacyId?.name || '—'}</TableCell>
                      <TableCell align='right'>{formatPKR(c.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          ) : (
            <CircularProgress size={22} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setView(null)}>Close</Button>
          {canCreate && detail?.status !== 'REVERSED' && (
            <Button color='warning' onClick={() => void handleReverse()} disabled={reversing}>
              Reverse
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default RemittanceListPage
