'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
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
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { inventoryService } from '@/services/inventory.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'

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

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (d: string) => {
  if (!d) return '-'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Transfer = {
  _id: string
  supplierId?: any
  fromDistributorId?: any
  distributorId: any
  items: { productId: any; quantity: number; castingAtTime: number; shippingCostPerUnit: number }[]
  totalShippingCost: number
  notes: string
  createdBy: any
  createdAt: string
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const columnHelper = createColumnHelper<Transfer>()

const StockTransferPage = () => {
  const { hasPermission } = useAuth()
  const canTransfer = hasPermission('inventory.transfer')
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [fromDistributorId, setFromDistributorId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: 1 }])
  const [totalShippingCost, setTotalShippingCost] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [viewItem, setViewItem] = useState<Transfer | null>(null)
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({})
  const [loadingStock, setLoadingStock] = useState(false)

  const isFormValid =
    items.length > 0 &&
    items.every(i => i.productId !== '' && i.quantity > 0) &&
    fromDistributorId !== '' &&
    distributorId !== '' &&
    fromDistributorId !== distributorId

  const fetchLookups = async () => {
    setLoadingData(true)
    try {
      const [d, p] = await Promise.all([
        distributorsService.lookup({ limit: 100 }),
        productsService.lookup({ limit: 100 })
      ])
      setDistributors(d.data.data || [])
      setProducts(p.data.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchHistory = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoadingHistory(true)
    try {
      const params: Record<string, string> = { limit: '200', sort: '-createdAt' }
      appendDateUserParams(params, appliedFilters, '')
      if (params.from) {
        params.createdAtFrom = params.from
        delete params.from
      }
      if (params.to) {
        params.createdAtTo = params.to
        delete params.to
      }
      const { data: res } = await inventoryService.getTransfers(params)
      if (seq !== fetchSeq.current) return
      setTransfers(res.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load transfer history')
    } finally {
      if (seq === fetchSeq.current) setLoadingHistory(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    fetchLookups()
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    if (!fromDistributorId) {
      setStockByProductId({})
      return
    }
    let cancelled = false
    const load = async () => {
      setLoadingStock(true)
      try {
        const { data: body } = await inventoryService.getByDistributor(fromDistributorId)
        const rows: any[] = Array.isArray(body?.data) ? body.data : []
        const map: Record<string, number> = {}
        for (const row of rows) {
          const pid = typeof row.productId === 'object' ? row.productId?._id : row.productId
          if (pid) map[String(pid)] = row.quantity ?? 0
        }
        if (!cancelled) setStockByProductId(map)
      } catch {
        if (!cancelled) setStockByProductId({})
      } finally {
        if (!cancelled) setLoadingStock(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fromDistributorId])

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1 }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: string, value: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleSubmit = async () => {
    if (!fromDistributorId || !distributorId) {
      showApiError(null, 'Select source and destination distributors')
      return
    }
    if (fromDistributorId === distributorId) {
      showApiError(null, 'Source and destination must be different')
      return
    }
    if (items.some(i => !i.productId || i.quantity < 1)) { showApiError(null, 'Fill all item fields'); return }
    setSaving(true)
    try {
      await inventoryService.transfer({ distributorId, fromDistributorId, items, totalShippingCost })
      showSuccess('Stock transferred successfully')
      setItems([{ productId: '', quantity: 1 }])
      setTotalShippingCost(0)
      setFromDistributorId('')
      fetchHistory()
    } catch (err) { showApiError(err, 'Transfer failed') }
    finally { setSaving(false) }
  }

  const columns = useMemo<ColumnDef<Transfer, any>[]>(() => [
    columnHelper.accessor('createdAt', {
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.createdAt)
    }),
    columnHelper.display({
      id: 'route',
      header: 'From → To',
      cell: ({ row }) => {
        const from = row.original.fromDistributorId
        const to = row.original.distributorId
        const fromName = typeof from === 'object' ? from?.name : null
        const toName = typeof to === 'object' ? to?.name : null
        const left = fromName ? fromName : 'Company'
        return (
          <Typography fontWeight={500}>
            {left} <Typography component='span' color='text.secondary'>→</Typography> {toName || '-'}
          </Typography>
        )
      }
    }),
    columnHelper.display({
      id: 'products',
      header: 'Products',
      cell: ({ row }) => {
        const count = row.original.items?.length || 0
        const totalQty = row.original.items?.reduce((s, i) => s + i.quantity, 0) || 0
        return <Chip label={`${count} product${count !== 1 ? 's' : ''} · ${totalQty} units`} size='small' variant='tonal' color='primary' />
      }
    }),
    columnHelper.accessor('totalShippingCost', {
      header: 'Shipping',
      cell: ({ row }) => formatPKR(row.original.totalShippingCost)
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => <IconButton size='small' onClick={() => setViewItem(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
    })
  ], [])

  const table = useReactTable({
    data: transfers,
    columns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter: debouncedSearch },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === 'function' ? updater(debouncedSearch) : updater
      setSearchInput(String(next ?? ''))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => setFilterAnchor(e.currentTarget)
  const closeFilterPopover = () => setFilterAnchor(null)

  return (
    <Grid container spacing={6}>
      {/* Transfer Form */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Stock Transfer' />
          <CardContent>
            {loadingData ? (
              <div className='flex justify-center p-12'><CircularProgress /></div>
            ) : (
              <Grid container spacing={4}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary' className='mbe-2'>
                    Transfer type
                  </Typography>
                  {/*
                    From company → distributor (tab) hidden for now — only between-distributors transfers.
                  <ToggleButtonGroup exclusive ...>
                    <ToggleButton value='company'>From company to distributor</ToggleButton>
                    <ToggleButton value='between'>Between distributors</ToggleButton>
                  </ToggleButtonGroup>
                  */}
                  <Typography variant='body1' fontWeight={600}>
                    Between distributors
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <CustomTextField
                      required
                      select
                      fullWidth
                      label='From distributor'
                      value={fromDistributorId}
                      onChange={e => setFromDistributorId(e.target.value)}
                      helperText={
                        loadingStock
                          ? 'Loading stock…'
                          : fromDistributorId
                            ? 'Available quantities appear next to each product'
                            : undefined
                      }
                    >
                      {distributors.map(d => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
                    </CustomTextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <CustomTextField
                    required
                    select
                    fullWidth
                    label='To distributor'
                    value={distributorId}
                    onChange={e => setDistributorId(e.target.value)}
                  >
                    {distributors.filter(d => d._id !== fromDistributorId).map(d => (
                      <MenuItem key={d._id} value={d._id}>
                        {d.name}
                      </MenuItem>
                    ))}
                  </CustomTextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <CustomTextField
                    fullWidth
                    label='Total Shipping Cost (PKR)'
                    type='number'
                    value={totalShippingCost}
                    onChange={e => setTotalShippingCost(+e.target.value)}
                    helperText={items.reduce((s, i) => s + i.quantity, 0) > 0
                      ? `≈ ₨ ${(totalShippingCost / items.reduce((s, i) => s + i.quantity, 0)).toFixed(2)} per unit across ${items.reduce((s, i) => s + i.quantity, 0)} units`
                      : undefined}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  {items.map((item, i) => (
                    <Grid container spacing={3} key={i} className='mbe-3'>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <CustomTextField required select fullWidth label='Product' value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                          {products.map(p => {
                            const avail = stockByProductId[p._id]
                            const label =
                              fromDistributorId && !loadingStock ? `${p.name} (available: ${avail ?? 0})` : p.name
                            return <MenuItem key={p._id} value={p._id}>{label}</MenuItem>
                          })}
                        </CustomTextField>
                      </Grid>
                      <Grid size={{ xs: 10, sm: 5 }}>
                        <CustomTextField
                          required
                          fullWidth
                          label='Quantity'
                          type='number'
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', +e.target.value)}
                          helperText={
                            item.productId && stockByProductId[item.productId] !== undefined
                              ? `Max available: ${stockByProductId[item.productId]}`
                              : undefined
                          }
                        />
                      </Grid>
                      <Grid size={{ xs: 2, sm: 2 }} className='flex items-center'>
                        {items.length > 1 && <IconButton onClick={() => removeItem(i)}><i className='tabler-trash text-error' /></IconButton>}
                      </Grid>
                    </Grid>
                  ))}
                  <Button variant='outlined' onClick={addItem} startIcon={<i className='tabler-plus' />}>Add Item</Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant='contained' onClick={handleSubmit} disabled={saving || !canTransfer || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>
                    {saving ? 'Transferring...' : 'Transfer Stock'}
                  </Button>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Transfer History */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Transfer History'
            action={
              <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap>
                <TableListSearchField
                  value={searchInput}
                  onChange={setSearchInput}
                  onClear={clearSearch}
                  placeholder='Search route, notes, products…'
                />
                <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
              </Stack>
            }
          />
          <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
            <DateAndCreatedByFilterPanel
              title='Filter transfers'
              description='Filter transfer history by when the move was recorded and who recorded it.'
              dateSectionLabel='Transfer date'
              createdByHelperText='Matches the teammate who saved the transfer.'
              datePickerId='stock-transfer-history-date-range-picker-months'
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
                {loadingHistory ? (
                  <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className='text-center p-6'>
                      {debouncedSearch
                        ? 'No matching transfers'
                        : activeFilterCount > 0
                          ? 'No transfers in this filter'
                          : 'No transfers found'}
                    </td>
                  </tr>
                ) : table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePaginationComponent table={table as any} />
        </Card>
      </Grid>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='md' fullWidth>
        <DialogTitle>Transfer Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>Route</Typography>
                <Typography fontWeight={500}>
                  {viewItem.fromDistributorId?.name ? `${viewItem.fromDistributorId.name} → ` : 'Company → '}
                  {viewItem.distributorId?.name || '-'}
                </Typography>
              </Grid>
              {viewItem.supplierId && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>Supplier (purchase recorded)</Typography>
                  <Typography fontWeight={500}>
                    {typeof viewItem.supplierId === 'object' ? viewItem.supplierId?.name : viewItem.supplierId}
                  </Typography>
                </Grid>
              )}
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Date</Typography><Typography>{formatDate(viewItem.createdAt)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Total Shipping</Typography><Typography>{formatPKR(viewItem.totalShippingCost)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Created By</Typography><Typography>{viewItem.createdBy?.name || '-'}</Typography></Grid>
              {viewItem.notes && (
                <Grid size={{ xs: 12 }}><Typography variant='body2' color='text.secondary'>Notes</Typography><Typography>{viewItem.notes}</Typography></Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Typography variant='subtitle2' className='mbe-2'>Items</Typography>
                <div className='overflow-x-auto'>
                  <table className={tableStyles.table}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>{viewItem.fromDistributorId ? 'Source avg/unit' : 'Casting at Time'}</th>
                        <th>Shipping/Unit</th>
                        <th>Cost/Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewItem.items?.map((itm: any, idx: number) => (
                        <tr key={idx}>
                          <td><Typography fontWeight={500}>{itm.productId?.name || '-'}</Typography></td>
                          <td>{itm.quantity}</td>
                          <td>{formatPKR(itm.castingAtTime)}</td>
                          <td>{formatPKR(itm.shippingCostPerUnit)}</td>
                          <td>{formatPKR(itm.castingAtTime + itm.shippingCostPerUnit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewItem(null)}>Close</Button></DialogActions>
      </Dialog>
    </Grid>
  )
}

export default StockTransferPage
