'use client'

import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import CircularProgress from '@mui/material/CircularProgress'
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

import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { showApiError } from '@/utils/apiErrors'
import { inventoryService } from '@/services/inventory.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'

import tableStyles from '@core/styles/table.module.css'

const LOW_STOCK_THRESHOLD = 50

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Catalog factory rate per unit (product casting); does not include receipt shipping baked into average cost. */
const TOOLTIP_FACTORY_VALUE =
  'Quantity × product factory rate (casting from the product master). This is the catalog cost price, not the weighted average stock cost. Stock “Avg cost / unit” can be higher when shipping was included on goods receipt or transfer.'

/** Cost-based stock value: includes landed cost; transfer shipping is spread across products on the same transfer. */
const TOOLTIP_TOTAL_COST_VALUE =
  'This is the total at cost: quantity × average cost per unit. That cost can include a share of shipping when stock was added through a stock transfer—shipping is split (shared) across all products in that transfer, so each line gets a fair per-unit cost. It is the amount the distributor is carrying the stock at, not list price.'

const TOOLTIP_INVENTORY_VALUE_KPI =
  'Total inventory at cost (sum of quantity × average cost) across the company, including the same shipping allocation rules when items came in on transfers. Not the same as sum of trade (TP) values.'

const TOOLTIP_TRADE_PRICE_NO_SHIPPING =
  'Trade price (TP) is taken from the product. It does not add shipping. Shipping is only reflected in the cost / average cost side when you receive stock on a transfer (shipping is shared across products in that move).'

type InventoryRow = {
  _id: string
  productId: any
  distributorId: any
  quantity: number
  avgCostPerUnit: number
}

type SummaryRow = {
  productId: string
  productName: string
  composition: string
  mrp: number
  tp: number
  casting: number
  totalQuantity: number
  totalValue: number
  distributorCount: number
  avgCostPerUnit: number
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const detailHelper = createColumnHelper<InventoryRow>()
const summaryHelper = createColumnHelper<SummaryRow>()

function TableHeaderWithHelp({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip title={tooltip} arrow leaveTouchDelay={4000} placement='top-start'>
      <span className='inline-flex items-center gap-0.5 cursor-help align-middle'>
        {label}
        <i className='tabler-info-circle size-3.5 text-textSecondary' aria-hidden />
      </span>
    </Tooltip>
  )
}

const InventoryPage = () => {
  const [tab, setTab] = useState('detail')
  const [detailData, setDetailData] = useState<InventoryRow[]>([])
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([])
  const [totals, setTotals] = useState({ totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [filterDistributor, setFilterDistributor] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewDetail, setViewDetail] = useState<InventoryRow | null>(null)
  const [viewSummary, setViewSummary] = useState<SummaryRow | null>(null)

  const fetchLookups = async () => {
    try {
      const [d, p] = await Promise.all([
        distributorsService.lookup({ limit: 200 }),
        productsService.lookup({ limit: 200 })
      ])
      setDistributors(d.data.data || [])
      setProducts(p.data.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load filters')
    }
  }

  const fetchData = async (distId?: string, prodId?: string) => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }
      if (distId) params.distributorId = distId
      if (prodId) params.productId = prodId

      const [detailRes, summaryRes] = await Promise.all([
        inventoryService.getAll(params),
        inventoryService.getSummary()
      ])

      setDetailData(detailRes.data.data || [])
      const sData = summaryRes.data.data
      setSummaryData(sData.byProduct || [])
      setTotals(sData.totals || { totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
    } catch (err) {
      showApiError(err, 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLookups()
  }, [])

  useEffect(() => {
    fetchData(filterDistributor, filterProduct)
  }, [filterDistributor, filterProduct])

  const detailTotals = useMemo(() => {
    return detailData.reduce(
      (acc, row) => {
        acc.units += row.quantity
        acc.value += row.quantity * row.avgCostPerUnit
        acc.factoryValue += row.quantity * Number(row.productId?.casting ?? 0)
        acc.tpValue += row.quantity * Number(row.productId?.tp ?? 0)
        return acc
      },
      { units: 0, value: 0, factoryValue: 0, tpValue: 0 }
    )
  }, [detailData])

  const summaryTotalTp = useMemo(
    () =>
      summaryData.reduce((sum, row) => sum + row.totalQuantity * Number(row.tp ?? 0), 0),
    [summaryData]
  )

  const detailColumns = useMemo<ColumnDef<InventoryRow, any>[]>(
    () => [
      detailHelper.accessor((r) => r.productId?.name, {
        id: 'productName',
        header: 'Product',
        cell: ({ getValue }) => <Typography fontWeight={500}>{getValue() || '-'}</Typography>
      }),
      detailHelper.accessor((r) => r.distributorId?.name, {
        id: 'distributorName',
        header: 'Distributor',
        cell: ({ getValue }) => getValue() || '-'
      }),
      detailHelper.accessor('quantity', {
        header: 'Quantity',
        cell: ({ row }) => {
          const qty = row.original.quantity
          return qty <= LOW_STOCK_THRESHOLD ? (
            <Chip label={qty} color='warning' size='small' variant='tonal' />
          ) : (
            <Typography>{qty}</Typography>
          )
        }
      }),
      detailHelper.display({
        id: 'factoryValue',
        header: () => <TableHeaderWithHelp label='Total at factory' tooltip={TOOLTIP_FACTORY_VALUE} />,
        cell: ({ row }) => {
          const fac = Number(row.original.productId?.casting ?? 0)
          const total = row.original.quantity * fac
          return (
            <Tooltip title={TOOLTIP_FACTORY_VALUE} arrow>
              <span className='cursor-help'>{formatPKR(total)}</span>
            </Tooltip>
          )
        }
      }),
      detailHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <IconButton size='small' onClick={() => setViewDetail(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
      })
    ],
    []
  )

  const summaryColumns = useMemo<ColumnDef<SummaryRow, any>[]>(
    () => [
      summaryHelper.accessor('productName', {
        header: 'Product',
        cell: ({ getValue }) => <Typography fontWeight={500}>{getValue()}</Typography>
      }),
      summaryHelper.accessor('totalQuantity', {
        header: 'Total Qty',
        cell: ({ row }) => {
          const qty = row.original.totalQuantity
          return qty <= LOW_STOCK_THRESHOLD ? (
            <Chip label={qty} color='warning' size='small' variant='tonal' />
          ) : (
            <Typography>{qty}</Typography>
          )
        }
      }),
      summaryHelper.accessor('totalValue', {
        header: () => <TableHeaderWithHelp label='Total at cost' tooltip={TOOLTIP_TOTAL_COST_VALUE} />,
        cell: ({ row }) => (
          <Tooltip title={TOOLTIP_TOTAL_COST_VALUE} arrow>
            <span className='cursor-help'>{formatPKR(row.original.totalValue)}</span>
          </Tooltip>
        )
      }),
      summaryHelper.accessor('distributorCount', {
        header: 'Distributors',
        cell: ({ getValue }) => getValue()
      }),
      summaryHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <IconButton size='small' onClick={() => setViewSummary(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
      })
    ],
    []
  )

  const detailTable = useReactTable({
    data: detailData,
    columns: detailColumns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const summaryTable = useReactTable({
    data: summaryData,
    columns: summaryColumns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const kpiData: { title: string; value: string; icon: string; color: string; tooltip?: string }[] = [
    { title: 'Unique Products', value: totals.uniqueProducts.toString(), icon: 'tabler-packages', color: 'primary' },
    { title: 'Total Units', value: totals.totalUnits.toLocaleString(), icon: 'tabler-box', color: 'info' },
    { title: 'Inventory at cost', value: formatPKR(totals.totalValue), icon: 'tabler-coin', color: 'success', tooltip: TOOLTIP_INVENTORY_VALUE_KPI }
  ]
  // TODO: Low stock KPI

  const renderTable = (table: any, cols: any[]) => (
    <>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map((hg: any) => (
              <tr key={hg.id}>
                {hg.headers.map((h: any) => (
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
                <td colSpan={cols.length} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className='text-center p-6'>
                  No data found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row: any) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell: any) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePaginationComponent table={table} />
    </>
  )

  return (
    <Grid container spacing={6}>
      {kpiData.map((kpi, i) => (
        <Grid key={i} size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent className='flex flex-col items-center gap-2 p-6'>
              {kpi.tooltip ? (
                <Tooltip title={kpi.tooltip} arrow leaveTouchDelay={5000}>
                  <span className='inline-flex w-full flex-col items-center gap-2 cursor-help'>
                    <i className={`${kpi.icon} text-3xl text-${kpi.color}`} />
                    <Typography variant='h5'>{loading ? '-' : kpi.value}</Typography>
                    <Typography variant='body2' color='text.secondary' className='inline-flex items-center gap-0.5'>
                      {kpi.title}
                      <i className='tabler-info-circle size-3.5 opacity-70' aria-hidden />
                    </Typography>
                  </span>
                </Tooltip>
              ) : (
                <>
                  <i className={`${kpi.icon} text-3xl text-${kpi.color}`} />
                  <Typography variant='h5'>{loading ? '-' : kpi.value}</Typography>
                  <Typography variant='body2' color='text.secondary'>{kpi.title}</Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Inventory' />
          <CardContent>
            <Grid container spacing={4} className='mbe-4'>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  select
                  fullWidth
                  label='Distributor'
                  value={filterDistributor}
                  onChange={(e) => setFilterDistributor(e.target.value)}
                  size='small'
                >
                  <MenuItem value=''>All Distributors</MenuItem>
                  {distributors.map((d) => (
                    <MenuItem key={d._id} value={d._id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  select
                  fullWidth
                  label='Product'
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  size='small'
                >
                  <MenuItem value=''>All Products</MenuItem>
                  {products.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  fullWidth
                  label='Search'
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder='Search...'
                  size='small'
                />
              </Grid>
            </Grid>
          </CardContent>
          <CardContent className='p-0'>
            <TabContext value={tab}>
              <TabList onChange={(_, v) => setTab(v)} className='pli-6'>
                <Tab label='Detailed View' value='detail' />
                <Tab label='Product Summary' value='summary' />
              </TabList>
              <TabPanel value='detail' className='p-0'>
                {renderTable(detailTable, detailColumns)}
                {!loading && detailData.length > 0 && (
                  <div className='flex flex-col items-end gap-1 p-4 border-bs'>
                    <div className='flex flex-wrap justify-end gap-6'>
                      <Typography variant='body2'>
                        <strong>Total units (filtered):</strong> {detailTotals.units.toLocaleString()}
                      </Typography>
                      <Tooltip title={TOOLTIP_FACTORY_VALUE} arrow>
                        <Typography variant='body2' className='cursor-help inline-flex items-center gap-0.5'>
                          <strong>Total at factory:</strong> {formatPKR(detailTotals.factoryValue)}
                          <i className='tabler-info-circle size-3.5 text-textSecondary' aria-hidden />
                        </Typography>
                      </Tooltip>
                      <Tooltip title={TOOLTIP_TOTAL_COST_VALUE} arrow>
                        <Typography variant='body2' className='cursor-help inline-flex items-center gap-0.5'>
                          <strong>Total at cost (landed):</strong> {formatPKR(detailTotals.value)}
                          <i className='tabler-info-circle size-3.5 text-textSecondary' aria-hidden />
                        </Typography>
                      </Tooltip>
                      <Tooltip title={TOOLTIP_TRADE_PRICE_NO_SHIPPING} arrow>
                        <Typography variant='body2' className='cursor-help inline-flex items-center gap-0.5'>
                          <strong>Total at TP:</strong> {formatPKR(detailTotals.tpValue)}
                          <i className='tabler-info-circle size-3.5 text-textSecondary' aria-hidden />
                        </Typography>
                      </Tooltip>
                    </div>
                    <Typography variant='caption' color='text.secondary' className='max-w-[min(100%,42rem)] text-end'>
                      Factory total uses product casting × qty. Landed cost includes shipping from receipts/transfers where applicable. TP is quantity × product TP (no shipping in TP).
                    </Typography>
                  </div>
                )}
              </TabPanel>
              <TabPanel value='summary' className='p-0'>
                {renderTable(summaryTable, summaryColumns)}
                {!loading && summaryData.length > 0 && (
                  <div className='flex flex-col items-end gap-1 p-4 border-bs'>
                    <div className='flex flex-wrap justify-end gap-4'>
                      <Typography variant='body2'><strong>Total units:</strong> {totals.totalUnits.toLocaleString()}</Typography>
                      <Tooltip title={TOOLTIP_INVENTORY_VALUE_KPI} arrow>
                        <Typography variant='body2' className='cursor-help inline-flex items-center gap-0.5'>
                          <strong>Total at cost (all products):</strong> {formatPKR(totals.totalValue)}
                          <i className='tabler-info-circle size-3.5 text-textSecondary' aria-hidden />
                        </Typography>
                      </Tooltip>
                      <Tooltip title={TOOLTIP_TRADE_PRICE_NO_SHIPPING} arrow>
                        <Typography variant='body2' className='cursor-help inline-flex items-center gap-0.5'>
                          <strong>Total at TP (all products):</strong> {formatPKR(summaryTotalTp)}
                          <i className='tabler-info-circle size-3.5 text-textSecondary' aria-hidden />
                        </Typography>
                      </Tooltip>
                    </div>
                    <Typography variant='caption' color='text.secondary' className='max-w-[min(100%,42rem)] text-end'>
                      Cost includes transfer-shipping share when applicable. TP is sum of (qty × TP) per product—shipping is not in TP.
                    </Typography>
                  </div>
                )}
              </TabPanel>
            </TabContext>
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={!!viewDetail} onClose={() => setViewDetail(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Inventory Details</DialogTitle>
        <DialogContent>
          {viewDetail && (() => {
            const unitTp = Number(viewDetail.productId?.tp ?? 0)
            const factoryRate = Number(viewDetail.productId?.casting ?? 0)
            const totalAtFactory = viewDetail.quantity * factoryRate
            const totalAtCost = viewDetail.quantity * viewDetail.avgCostPerUnit
            const totalTpLine = viewDetail.quantity * unitTp
            return (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Product</Typography><Typography fontWeight={500}>{viewDetail.productId?.name || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Composition</Typography><Typography>{viewDetail.productId?.composition || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Distributor</Typography><Typography>{viewDetail.distributorId?.name || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Quantity</Typography><Typography>{viewDetail.quantity}</Typography></Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>Factory rate (per unit)</Typography>
                <Typography>{formatPKR(factoryRate)}</Typography>
                <Tooltip title={TOOLTIP_FACTORY_VALUE} arrow>
                  <Typography variant='caption' color='text.secondary' className='cursor-help inline-flex items-center gap-0.5 mbs-0.5'>
                    Product casting — catalog cost; excludes receipt shipping
                    <i className='tabler-info-circle size-3' />
                  </Typography>
                </Tooltip>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>Total at factory</Typography>
                <Typography fontWeight={500}>{formatPKR(totalAtFactory)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Avg cost / unit (landed)</Typography><Typography>{formatPKR(viewDetail.avgCostPerUnit)}</Typography></Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>Total at cost (inventory, landed)</Typography>
                <Typography fontWeight={500}>{formatPKR(totalAtCost)}</Typography>
                <Typography variant='caption' color='text.secondary' display='block' className='mbs-1'>
                  Quantity × average cost per unit (weighted average, can include shipping from GRN or transfer).
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>MRP (per unit)</Typography><Typography>{formatPKR(viewDetail.productId?.mrp || 0)}</Typography></Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>TP (per unit)</Typography>
                <Typography>{formatPKR(unitTp)}</Typography>
                <Tooltip title={TOOLTIP_TRADE_PRICE_NO_SHIPPING} arrow>
                  <Typography variant='caption' color='text.secondary' className='cursor-help inline-flex items-center gap-0.5'>
                    List price only — no shipping
                    <i className='tabler-info-circle size-3' />
                  </Typography>
                </Tooltip>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>Total at TP (this line)</Typography>
                <Typography fontWeight={600}>{formatPKR(totalTpLine)}</Typography>
                <Typography variant='caption' color='text.secondary' display='block' className='mbs-1'>
                  Quantity × TP per unit. Shipping is <strong>not</strong> included in TP; shipping is reflected in average cost when stock is received on a GRN or transfer.
                </Typography>
              </Grid>
            </Grid>
            )
          })()}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewDetail(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={!!viewSummary} onClose={() => setViewSummary(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Product Inventory Summary</DialogTitle>
        <DialogContent>
          {viewSummary && (() => {
            const unitTp = Number(viewSummary.tp ?? 0)
            const totalTpAllUnits = viewSummary.totalQuantity * unitTp
            return (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Product</Typography><Typography fontWeight={500}>{viewSummary.productName}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Composition</Typography><Typography>{viewSummary.composition || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Total quantity</Typography><Typography>{viewSummary.totalQuantity}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Distributors</Typography><Typography>{viewSummary.distributorCount}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Avg cost / unit</Typography><Typography>{formatPKR(viewSummary.avgCostPerUnit)}</Typography></Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>Total at cost (this product, all distributors)</Typography>
                <Typography fontWeight={500}>{formatPKR(viewSummary.totalValue)}</Typography>
                <Typography variant='caption' color='text.secondary' display='block' className='mbs-1'>
                  {TOOLTIP_TOTAL_COST_VALUE}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>MRP (per unit)</Typography><Typography>{formatPKR(viewSummary.mrp)}</Typography></Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>TP (per unit)</Typography>
                <Typography>{formatPKR(unitTp)}</Typography>
                <Tooltip title={TOOLTIP_TRADE_PRICE_NO_SHIPPING} arrow>
                  <Typography variant='caption' color='text.secondary' className='cursor-help inline-flex items-center gap-0.5'>
                    List price only — no shipping
                    <i className='tabler-info-circle size-3' />
                  </Typography>
                </Tooltip>
              </Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Casting (per unit)</Typography><Typography>{formatPKR(viewSummary.casting)}</Typography></Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>Total at TP (all units, this product)</Typography>
                <Typography fontWeight={600}>{formatPKR(totalTpAllUnits)}</Typography>
                <Typography variant='caption' color='text.secondary' display='block' className='mbs-1'>
                  Total quantity × TP per unit. <strong>Shipping is not</strong> part of this figure. Cost (above) is where transfer shipping is spread across products when stock came in on a transfer.
                </Typography>
              </Grid>
            </Grid>
            )
          })()}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewSummary(null)}>Close</Button></DialogActions>
      </Dialog>
    </Grid>
  )
}

export default InventoryPage
