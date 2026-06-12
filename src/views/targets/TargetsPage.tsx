'use client'
import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import { alpha, useTheme } from '@mui/material/styles'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import GlobalStyles from '@mui/material/GlobalStyles'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { targetsService } from '@/services/targets.service'
import { usersService } from '@/services/users.service'
import { productsService } from '@/services/products.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { filterMedicalReps } from '@/utils/userLookups'
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

type ProductPacksTarget = {
  productId: string | { _id: string; name?: string; composition?: string }
  packsTarget: number
}

type Target = {
  _id: string
  medicalRepId: any
  month: string
  salesTarget: number
  achievedSales: number
  packsTarget: number
  achievedPacks: number
  productPacksTargets?: ProductPacksTarget[]
}

type ProductPacksTargetFormRow = {
  productId: string
  productName: string
  composition?: string
  packsTarget: number
}

type TargetFormState = {
  medicalRepId: string
  month: string
  salesTarget: number
  packsTarget: number
  productPacksTargets: ProductPacksTargetFormRow[]
}

type PackBreakdownPayload = {
  month: string
  medicalRepId: string
  wholePacksTarget?: number
  totalNetPacks: number
  rows: Array<{
    productId: string
    productName: string
    composition?: string
    deliveredQuantity: number
    returnedQuantity: number
    netQuantity: number
    packsTarget?: number
    progressPercent?: number | null
  }>
}
const columnHelper = createColumnHelper<Target>()

const parseYyyyMm = (s: string): Date | null => {
  const t = s.trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const [y, m] = t.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

const formatYyyyMm = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const emptyTargetForm = (): TargetFormState => ({
  medicalRepId: '',
  month: formatYyyyMm(new Date()),
  salesTarget: 0,
  packsTarget: 0,
  productPacksTargets: []
})

const mapProductPacksTargetsFromRow = (row: Target): ProductPacksTargetFormRow[] =>
  (row.productPacksTargets || []).map(pt => {
    const p = pt.productId
    const isObj = p && typeof p === 'object'
    return {
      productId: isObj ? String(p._id) : String(p ?? ''),
      productName: isObj ? String(p.name || '') : '',
      composition: isObj && p.composition ? String(p.composition) : '',
      packsTarget: Number(pt.packsTarget) || 0
    }
  })

const sumProductTargets = (row: Pick<Target, 'productPacksTargets'>) =>
  (row.productPacksTargets || []).reduce((sum, pt) => sum + (Number(pt.packsTarget) || 0), 0)

const serializeProductPacksTargets = (rows: ProductPacksTargetFormRow[]) =>
  rows
    .filter(r => r.productId && r.packsTarget > 0)
    .map(r => ({ productId: r.productId, packsTarget: Math.floor(r.packsTarget) }))

const TargetsPage = () => {
  const theme = useTheme()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('targets.create')
  const canEdit = hasPermission('targets.edit')
  const [data, setData] = useState<Target[]>([])
  const [users, setUsers] = useState<any[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TargetFormState>(emptyTargetForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [packsDrawerOpen, setPacksDrawerOpen] = useState(false)
  const [packsDrawerRow, setPacksDrawerRow] = useState<Target | null>(null)
  const [packsBreakdown, setPacksBreakdown] = useState<PackBreakdownPayload | null>(null)
  const [packsBreakdownLoading, setPacksBreakdownLoading] = useState(false)
  const [packsPrintActive, setPacksPrintActive] = useState(false)

  const resolveRepId = useCallback((row: Target) => {
    return typeof row.medicalRepId === 'object' && row.medicalRepId?._id
      ? String(row.medicalRepId._id)
      : String(row.medicalRepId ?? '')
  }, [])

  const openPacksBreakdown = useCallback(
    async (row: Target) => {
      const medicalRepId = resolveRepId(row)
      if (!medicalRepId) return
      setPacksDrawerRow(row)
      setPacksBreakdown(null)
      setPacksDrawerOpen(true)
      setPacksBreakdownLoading(true)
      try {
        const res = await targetsService.packsBreakdown({ medicalRepId, month: row.month })
        setPacksBreakdown((res as any)?.data?.data ?? null)
      } catch (err) {
        showApiError(err, 'Could not load pack breakdown')
        setPacksDrawerOpen(false)
        setPacksDrawerRow(null)
      } finally {
        setPacksBreakdownLoading(false)
      }
    },
    [resolveRepId]
  )

  const closePacksDrawer = useCallback(() => {
    setPacksDrawerOpen(false)
    setPacksDrawerRow(null)
    setPacksBreakdown(null)
    setPacksPrintActive(false)
  }, [])

  const printPacksBreakdown = useCallback(() => {
    if (!packsBreakdown || !packsDrawerRow) return
    setPacksPrintActive(true)
  }, [packsBreakdown, packsDrawerRow])

  useEffect(() => {
    if (!packsPrintActive) return
    const onAfterPrint = () => setPacksPrintActive(false)
    window.addEventListener('afterprint', onAfterPrint)
    requestAnimationFrame(() => window.print())
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [packsPrintActive])

  const productPacksTargetSum = useMemo(
    () => form.productPacksTargets.reduce((sum, row) => sum + (row.packsTarget > 0 ? row.packsTarget : 0), 0),
    [form.productPacksTargets]
  )
  const hasAtLeastOneTarget = form.salesTarget > 0 || form.packsTarget > 0 || productPacksTargetSum > 0
  const isFormValid = form.medicalRepId !== '' && form.month.trim() !== '' && hasAtLeastOneTarget

  const usedProductIds = useMemo(
    () => new Set(form.productPacksTargets.map(r => r.productId).filter(Boolean)),
    [form.productPacksTargets]
  )

  const addProductTargetRow = () => {
    setForm(p => ({
      ...p,
      productPacksTargets: [...p.productPacksTargets, { productId: '', productName: '', packsTarget: 0 }]
    }))
  }

  const updateProductTargetRow = (index: number, patch: Partial<ProductPacksTargetFormRow>) => {
    setForm(p => ({
      ...p,
      productPacksTargets: p.productPacksTargets.map((row, i) => (i === index ? { ...row, ...patch } : row))
    }))
  }

  const removeProductTargetRow = (index: number) => {
    setForm(p => ({
      ...p,
      productPacksTargets: p.productPacksTargets.filter((_, i) => i !== index)
    }))
  }

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const [t, u] = await Promise.all([targetsService.list(params), usersService.assignable()])
      if (seq !== fetchSeq.current) return
      setData(t.data.data || [])
      setUsers(filterMedicalReps(u.data.data || []))
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load targets')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openCreate = () => {
    setDialogMode('create')
    setEditingId(null)
    setForm(emptyTargetForm())
    setOpen(true)
  }

  const openEdit = useCallback((row: Target) => {
    const repId =
      typeof row.medicalRepId === 'object' && row.medicalRepId?._id
        ? String(row.medicalRepId._id)
        : String(row.medicalRepId ?? '')
    setDialogMode('edit')
    setEditingId(row._id)
    setForm({
      medicalRepId: repId,
      month: row.month,
      salesTarget: row.salesTarget,
      packsTarget: row.packsTarget,
      productPacksTargets: mapProductPacksTargetsFromRow(row)
    })
    setOpen(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      medicalRepId: form.medicalRepId,
      month: form.month,
      salesTarget: form.salesTarget,
      packsTarget: form.packsTarget,
      productPacksTargets: serializeProductPacksTargets(form.productPacksTargets)
    }
    try {
      if (dialogMode === 'edit' && editingId) {
        await targetsService.update(editingId, {
          salesTarget: payload.salesTarget,
          packsTarget: payload.packsTarget,
          productPacksTargets: payload.productPacksTargets
        })
        showSuccess('Target updated')
      } else {
        await targetsService.create(payload)
        showSuccess('Target created')
      }
      setOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, dialogMode === 'edit' ? 'Failed to update target' : 'Failed to create target')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = useCallback((id: string) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }, [])

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      await targetsService.remove(deletingId)
      showSuccess('Target deleted')
      setDeleteOpen(false)
      setDeletingId(null)
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to delete target')
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<Target, any>[]>(() => {
    const defs: ColumnDef<Target, any>[] = [
      columnHelper.display({
        id: 'rep',
        header: 'Rep',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.medicalRepId?.name || '-'}</Typography>
      }),
      columnHelper.accessor('month', { header: 'Month' }),
      columnHelper.display({
        id: 'salesProgress',
        header: 'Sales Progress',
        cell: ({ row }) => {
          const pct =
            row.original.salesTarget > 0
              ? Math.min((row.original.achievedSales / row.original.salesTarget) * 100, 100)
              : 0
          return (
            <div>
              <LinearProgress variant='determinate' value={pct} />
              <Typography variant='caption'>
                {row.original.achievedSales?.toFixed(0)} / {row.original.salesTarget?.toFixed(0)}
              </Typography>
            </div>
          )
        }
      }),
      columnHelper.display({
        id: 'packsProgress',
        header: 'Packs Progress',
        cell: ({ row }) => {
          const wholeTarget = row.original.packsTarget > 0
          const productTargetSum = sumProductTargets(row.original)
          const hasProductTargets = productTargetSum > 0
          const wholePct = wholeTarget
            ? Math.min((row.original.achievedPacks / row.original.packsTarget) * 100, 100)
            : 0
          return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {wholeTarget ? (
                  <>
                    <LinearProgress variant='determinate' value={wholePct} color='secondary' />
                    <Typography variant='caption' component='div' sx={{ mt: 0.5, display: 'block' }}>
                      Whole: {row.original.achievedPacks} / {row.original.packsTarget}
                    </Typography>
                  </>
                ) : hasProductTargets ? (
                  <Typography variant='caption' color='text.secondary' component='div'>
                    By product · {row.original.productPacksTargets?.length ?? 0} products · {productTargetSum} packs
                    targeted
                  </Typography>
                ) : (
                  <Typography variant='caption' color='text.disabled' component='div'>
                    No packs target
                  </Typography>
                )}
                {wholeTarget && hasProductTargets ? (
                  <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.25 }}>
                    + {row.original.productPacksTargets?.length ?? 0} product-specific targets
                  </Typography>
                ) : null}
              </Box>
              <Tooltip title='Packs by product'>
                <IconButton
                  size='small'
                  color='secondary'
                  onClick={() => void openPacksBreakdown(row.original)}
                  aria-label='View packs by product'
                  sx={theme => ({
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    flexShrink: 0,
                    '&:hover': {
                      borderColor: 'secondary.main',
                      bgcolor: alpha(theme.palette.secondary.main, 0.08)
                    }
                  })}
                >
                  <i className='tabler-packages' style={{ fontSize: '1.15rem' }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )
        }
      })
    ]
    if (canEdit) {
      defs.push(
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
              <Tooltip title='Edit'>
                <IconButton size='small' color='primary' onClick={() => openEdit(row.original)} aria-label='Edit target'>
                  <i className='tabler-edit' />
                </IconButton>
              </Tooltip>
              <Tooltip title='Delete'>
                <IconButton size='small' color='error' onClick={() => confirmDelete(row.original._id)} aria-label='Delete target'>
                  <i className='tabler-trash' />
                </IconButton>
              </Tooltip>
            </Stack>
          )
        })
      )
    }
    return defs
  }, [canEdit, openEdit, confirmDelete, openPacksBreakdown])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() })

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => setFilterAnchor(e.currentTarget)
  const closeFilterPopover = () => setFilterAnchor(null)

  const packsPrintTotals = packsBreakdown
    ? {
        delivered: packsBreakdown.rows.reduce((s, x) => s + x.deliveredQuantity, 0),
        returned: packsBreakdown.rows.reduce((s, x) => s + x.returnedQuantity, 0)
      }
    : null

  return (
    <>
      {packsPrintActive && packsBreakdown && packsDrawerRow ? (
        <GlobalStyles
          styles={{
            '@media screen': {
              '#targets-packs-print-root': { display: 'none !important' }
            },
            '@media print': {
              body: { visibility: 'hidden' },
              '#targets-packs-print-root, #targets-packs-print-root *': { visibility: 'visible' },
              '#targets-packs-print-root': {
                display: 'block !important',
                visibility: 'visible',
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                padding: '24px',
                color: '#111',
                background: '#fff'
              }
            }
          }}
        />
      ) : null}
    <Card>
      <CardHeader
        title='Targets'
        action={
          canCreate && (
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
              Add Target
            </Button>
          )
        }
      />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search rep, month (YYYY-MM)…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter targets'
          description='Narrow sales targets by when the row was created and who added it.'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the target.'
          datePickerId='targets-list-date-range-picker-months'
          appliedFilters={appliedFilters}
          onAppliedChange={setAppliedFilters}
          filterAnchor={filterAnchor}
          open={filterOpen}
          onClose={closeFilterPopover}
        />
      </ListFilterPopover>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No targets</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>{dialogMode === 'edit' ? 'Edit Target' : 'Add Target'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                required
                fullWidth
                label='Medical Rep'
                value={form.medicalRepId}
                disabled={dialogMode === 'edit'}
                onChange={e => setForm(p => ({ ...p, medicalRepId: e.target.value }))}
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
                id='targets-month-picker'
                dateFormat='yyyy-MM'
                disabled={dialogMode === 'edit'}
                onChange={(date: Date | null) => {
                  setForm(p => ({ ...p, month: date ? formatYyyyMm(date) : '' }))
                }}
                customInput={
                  <CustomTextField
                    fullWidth
                    required
                    disabled={dialogMode === 'edit'}
                    label='Month (YYYY-MM)'
                    helperText={dialogMode === 'edit' ? 'Rep and month cannot be changed. Delete and create a new target if needed.' : 'YYYY-MM'}
                  />
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='caption' color='text.secondary' className='block mbe-2'>
                Set at least one: sales target (PKR), whole packs target, product pack target(s), or any combination.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Sales target (PKR)'
                type='number'
                inputProps={{ min: 0, step: 0.01 }}
                value={form.salesTarget || ''}
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({ ...p, salesTarget: v === '' ? 0 : +v }))
                }}
                helperText='Optional if a packs target is set'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Whole packs target'
                type='number'
                inputProps={{ min: 0, step: 1 }}
                value={form.packsTarget || ''}
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({ ...p, packsTarget: v === '' ? 0 : +v }))
                }}
                helperText='Optional total across all products'
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant='subtitle2' fontWeight={600}>
                    Product pack targets
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Optional per-product goals, e.g. Airoflox 5 packs, Panadol 20 packs.
                  </Typography>
                </Box>
                <Button size='small' variant='outlined' startIcon={<i className='tabler-plus' />} onClick={addProductTargetRow}>
                  Add product
                </Button>
              </Stack>

              {form.productPacksTargets.length === 0 ? (
                <Paper
                  variant='outlined'
                  sx={{
                    p: 2.5,
                    borderStyle: 'dashed',
                    bgcolor: theme => alpha(theme.palette.action.hover, 0.35)
                  }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    No product-specific pack targets yet. Use whole packs target above, or add products here.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {form.productPacksTargets.map((row, index) => {
                    const selectedProduct =
                      row.productId && row.productName
                        ? { _id: row.productId, name: row.productName, composition: row.composition }
                        : null
                    return (
                      <Grid container spacing={2} key={`product-target-${index}`} alignItems='flex-start'>
                        <Grid size={{ xs: 12, sm: 7 }}>
                          <LookupAutocomplete<{ _id: string; name: string; composition?: string }>
                            value={selectedProduct}
                            onChange={v => {
                              if (!v) {
                                updateProductTargetRow(index, { productId: '', productName: '', composition: '' })
                                return
                              }
                              if (usedProductIds.has(String(v._id)) && String(v._id) !== row.productId) return
                              updateProductTargetRow(index, {
                                productId: String(v._id),
                                productName: v.name || '',
                                composition: v.composition || ''
                              })
                            }}
                            fetchOptions={search =>
                              productsService
                                .lookup({ limit: 25, ...(search ? { search } : {}) })
                                .then(r => r.data.data || [])
                            }
                            label='Product'
                            placeholder='Type to search'
                            required
                            fetchErrorMessage='Failed to load products'
                            getOptionLabel={o => (o.composition ? `${o.name} · ${o.composition}` : o.name)}
                          />
                        </Grid>
                        <Grid size={{ xs: 8, sm: 3 }}>
                          <CustomTextField
                            fullWidth
                            label='Packs target'
                            type='number'
                            inputProps={{ min: 1, step: 1 }}
                            value={row.packsTarget || ''}
                            onChange={e => {
                              const v = e.target.value
                              updateProductTargetRow(index, { packsTarget: v === '' ? 0 : +v })
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 4, sm: 2 }} sx={{ display: 'flex', alignItems: 'center', pt: { sm: 1 } }}>
                          <Tooltip title='Remove product target'>
                            <IconButton
                              size='small'
                              color='error'
                              onClick={() => removeProductTargetRow(index)}
                              aria-label='Remove product target'
                            >
                              <i className='tabler-trash' />
                            </IconButton>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    )
                  })}
                </Stack>
              )}

              {productPacksTargetSum > 0 ? (
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1.5 }}>
                  Product targets total: {productPacksTargetSum} packs
                  {form.packsTarget > 0 ? ' (in addition to whole packs target)' : ''}
                </Typography>
              ) : null}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : dialogMode === 'edit' ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Delete target?</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            This removes the target for this rep and month. Progress figures are no longer tracked against it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={handleDelete} disabled={deleting} startIcon={deleting ? <CircularProgress size={20} color='inherit' /> : undefined}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor='right'
        open={packsDrawerOpen}
        onClose={closePacksDrawer}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 520, md: 560 },
            maxWidth: '100vw',
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
          }
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            px: 3,
            py: 2.5,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            boxShadow: 1
          }}
        >
          <Stack direction='row' alignItems='flex-start' justifyContent='space-between' spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='h6' fontWeight={600} sx={{ lineHeight: 1.25 }}>
                Pack breakdown
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
                {packsDrawerRow?.medicalRepId?.name ?? 'Rep'} · {packsDrawerRow?.month ?? ''}
              </Typography>
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1, maxWidth: 440 }}>
                Physical packs from deliveries in this month minus returns in this month (aligned with progress totals).
              </Typography>
            </Box>
            <Stack direction='row' spacing={0.5} sx={{ flexShrink: 0 }}>
              <Tooltip title='Print full list'>
                <span>
                  <IconButton
                    size='small'
                    onClick={printPacksBreakdown}
                    disabled={packsBreakdownLoading || !packsBreakdown || !packsDrawerRow}
                    aria-label='Print pack breakdown'
                  >
                    <i className='tabler-printer' />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton size='small' onClick={closePacksDrawer} aria-label='Close'>
                <i className='tabler-x' />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            p: 3,
            pt: 2,
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {packsBreakdownLoading && (
            <Stack spacing={1}>
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} variant='rounded' height={40} sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          )}

          {!packsBreakdownLoading && packsBreakdown && packsDrawerRow && (
            <>
              <Stack direction='row' flexWrap='wrap' gap={1} sx={{ mb: 2 }}>
                {packsBreakdown.wholePacksTarget ? (
                  <Chip
                    label={`Whole target: ${packsBreakdown.wholePacksTarget}`}
                    color='secondary'
                    variant='outlined'
                    size='small'
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                ) : null}
                <Chip
                  label={`Net from breakdown: ${packsBreakdown.totalNetPacks}`}
                  color='secondary'
                  variant='outlined'
                  size='small'
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                />
                <Chip
                  label={`On target row: ${packsDrawerRow.achievedPacks}`}
                  variant='outlined'
                  size='small'
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                />
                {packsBreakdown.totalNetPacks !== packsDrawerRow.achievedPacks && (
                  <Chip label='Differs from stored total — re-save or sync may be needed' color='warning' size='small' variant='outlined' />
                )}
              </Stack>

              {packsBreakdown.rows.length === 0 ? (
                <Paper
                  variant='outlined'
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: theme => alpha(theme.palette.action.hover, 0.5),
                    borderStyle: 'dashed'
                  }}
                >
                  <i className='tabler-package-off' style={{ fontSize: '2.5rem', opacity: 0.35 }} />
                  <Typography color='text.secondary' sx={{ mt: 2 }}>
                    No delivery or return lines in this month for this rep.
                  </Typography>
                </Paper>
              ) : (
                <TableContainer
                  component={Paper}
                  variant='outlined'
                  sx={{
                    borderRadius: 2,
                    boxShadow: 'none',
                    '& .MuiTableCell-head': {
                      bgcolor: 'background.paper',
                      fontWeight: 600,
                      backgroundImage: 'none',
                      boxShadow: t => `inset 0 -1px 0 ${t.palette.divider}`
                    }
                  }}
                >
                  <Table size='small' stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell align='right'>Target</TableCell>
                        <TableCell align='right'>Delivered</TableCell>
                        <TableCell align='right'>Returned</TableCell>
                        <TableCell align='right'>Net</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>Progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {packsBreakdown.rows.map(r => {
                        const targetQty = Number(r.packsTarget) || 0
                        const progress =
                          r.progressPercent != null
                            ? r.progressPercent
                            : targetQty > 0
                              ? Math.min(100, (r.netQuantity / targetQty) * 100)
                              : 0
                        return (
                        <TableRow key={r.productId} hover sx={{ '& td': { fontVariantNumeric: 'tabular-nums' } }}>
                          <TableCell>
                            <Typography fontWeight={500} variant='body2'>
                              {r.productName}
                            </Typography>
                            {r.composition ? (
                              <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.25 }}>
                                {r.composition}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell align='right'>{targetQty > 0 ? targetQty : '—'}</TableCell>
                          <TableCell align='right'>{r.deliveredQuantity}</TableCell>
                          <TableCell align='right'>{r.returnedQuantity}</TableCell>
                          <TableCell align='right'>
                            <Typography fontWeight={600} color={r.netQuantity >= 0 ? 'text.primary' : 'error.main'}>
                              {r.netQuantity}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {targetQty > 0 ? (
                              <Box sx={{ minWidth: 96 }}>
                                <LinearProgress variant='determinate' value={progress} color='secondary' sx={{ mb: 0.5 }} />
                                <Typography variant='caption' color='text.secondary'>
                                  {r.netQuantity} / {targetQty}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant='caption' color='text.disabled'>
                                No target
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      )})}
                      <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: alpha(theme.palette.secondary.main, 0.06), fontVariantNumeric: 'tabular-nums' } }}>
                        <TableCell>Total</TableCell>
                        <TableCell align='right'>
                          {packsBreakdown.rows.reduce((s, x) => s + (Number(x.packsTarget) || 0), 0) || '—'}
                        </TableCell>
                        <TableCell align='right'>
                          {packsBreakdown.rows.reduce((s, x) => s + x.deliveredQuantity, 0)}
                        </TableCell>
                        <TableCell align='right'>
                          {packsBreakdown.rows.reduce((s, x) => s + x.returnedQuantity, 0)}
                        </TableCell>
                        <TableCell align='right'>{packsBreakdown.totalNetPacks}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Box>

        {!packsBreakdownLoading && packsBreakdown && packsDrawerRow ? (
          <Box
            sx={{
              flexShrink: 0,
              px: 3,
              py: 2,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper'
            }}
          >
            <Button
              variant='outlined'
              size='small'
              startIcon={<i className='tabler-printer' />}
              onClick={printPacksBreakdown}
            >
              Print full list
            </Button>
          </Box>
        ) : null}
      </Drawer>

      {packsPrintActive && packsBreakdown && packsDrawerRow ? (
        <Box id='targets-packs-print-root' component='article'>
          <Typography variant='h5' fontWeight={700} sx={{ mb: 0.5 }}>
            Pack breakdown
          </Typography>
          <Typography variant='body2' sx={{ mb: 0.25 }}>
            {packsDrawerRow.medicalRepId?.name ?? 'Rep'} · {packsDrawerRow.month}
          </Typography>
          <Typography variant='caption' display='block' sx={{ mb: 2, color: 'text.secondary' }}>
            Physical packs from deliveries in this month minus returns in this month.
          </Typography>
          <Typography variant='body2' sx={{ mb: 2 }}>
            {packsBreakdown.wholePacksTarget ? (
              <>
                Whole target: <strong>{packsBreakdown.wholePacksTarget}</strong>
                {' · '}
              </>
            ) : null}
            Net from breakdown: <strong>{packsBreakdown.totalNetPacks}</strong>
            {' · '}
            On target row: <strong>{packsDrawerRow.achievedPacks}</strong>
            {packsBreakdown.totalNetPacks !== packsDrawerRow.achievedPacks ? (
              <> · <strong>Note:</strong> differs from stored total</>
            ) : null}
          </Typography>

          {packsBreakdown.rows.length === 0 ? (
            <Typography variant='body2'>No delivery or return lines in this month for this rep.</Typography>
          ) : (
            <Box
              component='table'
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
                '& th, & td': {
                  border: '1px solid #ccc',
                  padding: '8px 10px',
                  textAlign: 'left'
                },
                '& th': { fontWeight: 600, background: '#f5f5f5' },
                '& td.num': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
                '& tfoot td': { fontWeight: 700, background: '#fafafa' }
              }}
            >
              <Box component='thead'>
                <Box component='tr'>
                  <Box component='th'>Product</Box>
                  <Box component='th' sx={{ textAlign: 'right' }}>
                    Target
                  </Box>
                  <Box component='th' sx={{ textAlign: 'right' }}>
                    Delivered
                  </Box>
                  <Box component='th' sx={{ textAlign: 'right' }}>
                    Returned
                  </Box>
                  <Box component='th' sx={{ textAlign: 'right' }}>
                    Net
                  </Box>
                </Box>
              </Box>
              <Box component='tbody'>
                {packsBreakdown.rows.map(r => (
                  <Box component='tr' key={r.productId}>
                    <Box component='td'>
                      {r.productName}
                      {r.composition ? (
                        <Box component='span' sx={{ display: 'block', fontSize: '0.75rem', color: '#666' }}>
                          {r.composition}
                        </Box>
                      ) : null}
                    </Box>
                    <Box component='td' className='num'>
                      {(Number(r.packsTarget) || 0) > 0 ? r.packsTarget : '—'}
                    </Box>
                    <Box component='td' className='num'>
                      {r.deliveredQuantity}
                    </Box>
                    <Box component='td' className='num'>
                      {r.returnedQuantity}
                    </Box>
                    <Box component='td' className='num'>
                      {r.netQuantity}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box component='tfoot'>
                <Box component='tr'>
                  <Box component='td'>Total</Box>
                  <Box component='td' className='num'>
                    {packsBreakdown.rows.reduce((s, x) => s + (Number(x.packsTarget) || 0), 0) || '—'}
                  </Box>
                  <Box component='td' className='num'>
                    {packsPrintTotals?.delivered ?? 0}
                  </Box>
                  <Box component='td' className='num'>
                    {packsPrintTotals?.returned ?? 0}
                  </Box>
                  <Box component='td' className='num'>
                    {packsBreakdown.totalNetPacks}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          <Typography variant='caption' display='block' sx={{ mt: 3, color: '#666' }}>
            Printed {new Date().toLocaleString()}
          </Typography>
        </Box>
      ) : null}
    </Card>
    </>
  )
}
export default TargetsPage
