'use client'

import { useCallback, useEffect, useMemo, useState, useRef, type MouseEvent } from 'react'

import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { alpha, useTheme } from '@mui/material/styles'

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
import { salaryStructureService } from '@/services/salaryStructure.service'
import { productsService } from '@/services/products.service'
import { usersService } from '@/services/users.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import {
  calcFlatSlabIncentive,
  serializeProductPackIncentives,
  type ProductPackIncentiveForm,
  type ProductPackSlab
} from '@/utils/productIncentiveUtils'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

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

type LineIn = { name: string; type: 'fixed' | 'percentage'; value: number }

type StructureRow = {
  _id: string
  name: string
  description?: string
  basicSalary: number
  dailyAllowance?: number
  isActive: boolean
  assignedEmployeeCount?: number
  allowances: LineIn[]
  deductions: LineIn[]
  commission?: { type?: string; value?: number }
  productPackIncentives?: Array<{
    productId: string | { _id: string; name?: string; composition?: string }
    includeBonusQty?: boolean
    slabs?: ProductPackSlab[]
  }>
}

const roundPKR = (n: number) => Math.round(n * 100) / 100

const lineAmount = (basic: number, item: LineIn) => {
  if (item.type === 'fixed') return roundPKR(item.value)
  return roundPKR((basic * item.value) / 100)
}

const columnHelper = createColumnHelper<StructureRow>()

const SalaryStructurePage = () => {
  const theme = useTheme()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payroll.create')
  const canEdit = hasPermission('payroll.edit')

  const [rows, setRows] = useState<StructureRow[]>([])
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<StructureRow | null>(null)
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [assignSaving, setAssignSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    basicSalary: 0,
    dailyAllowance: 0,
    allowances: [] as LineIn[],
    deductions: [] as LineIn[],
    commissionPct: 0,
    productPackIncentives: [] as ProductPackIncentiveForm[]
  })
  const [previewSales, setPreviewSales] = useState(0)

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const fetchRows = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const [s] = await Promise.all([salaryStructureService.list(params)])
      if (seq !== fetchSeq.current) return
      setRows(s.data.data || [])
    } catch (e) {
      if (seq === fetchSeq.current) showApiError(e, 'Failed to load salary structures')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const preview = useMemo(() => {
    const basic = form.basicSalary
    let allowSum = 0
    for (const a of form.allowances) allowSum += lineAmount(basic, a)
    allowSum = roundPKR(allowSum)
    let dedSum = 0
    for (const d of form.deductions) dedSum += lineAmount(basic, d)
    dedSum = roundPKR(dedSum)
    const comm = roundPKR((previewSales * (form.commissionPct || 0)) / 100)
    let productIncentivePreview = 0
    for (const rule of form.productPackIncentives) {
      const qty = rule.sampleDeliveredQty ?? 0
      if (qty > 0 && rule.slabs.length) {
        productIncentivePreview += calcFlatSlabIncentive(rule.slabs, qty).amount
      }
    }
    productIncentivePreview = roundPKR(productIncentivePreview)
    const gross = roundPKR(basic + allowSum + comm + productIncentivePreview)
    const net = roundPKR(gross - dedSum)
    return { allowSum, dedSum, comm, productIncentivePreview, gross, net }
  }, [form, previewSales])

  const usedProductIds = useMemo(
    () => new Set(form.productPackIncentives.map(r => r.productId).filter(Boolean)),
    [form.productPackIncentives]
  )

  const addProductIncentive = () => {
    setForm(f => ({
      ...f,
      productPackIncentives: [
        ...f.productPackIncentives,
        {
          productId: '',
          productName: '',
          includeBonusQty: true,
          slabs: [{ fromPacks: 1, toPacks: 100, ratePerPack: 0 }],
          sampleDeliveredQty: 0
        }
      ]
    }))
  }

  const updateProductIncentive = (index: number, patch: Partial<ProductPackIncentiveForm>) => {
    setForm(f => ({
      ...f,
      productPackIncentives: f.productPackIncentives.map((row, i) => (i === index ? { ...row, ...patch } : row))
    }))
  }

  const removeProductIncentive = (index: number) => {
    setForm(f => ({
      ...f,
      productPackIncentives: f.productPackIncentives.filter((_, i) => i !== index)
    }))
  }

  const addProductSlab = (productIndex: number) => {
    setForm(f => ({
      ...f,
      productPackIncentives: f.productPackIncentives.map((row, i) => {
        if (i !== productIndex) return row
        const last = row.slabs[row.slabs.length - 1]
        const nextFrom = last?.toPacks != null ? last.toPacks + 1 : (last?.fromPacks ?? 0) + 1
        return {
          ...row,
          slabs: [...row.slabs, { fromPacks: nextFrom, toPacks: null, ratePerPack: 0 }]
        }
      })
    }))
  }

  const updateProductSlab = (productIndex: number, slabIndex: number, patch: Partial<ProductPackSlab>) => {
    setForm(f => ({
      ...f,
      productPackIncentives: f.productPackIncentives.map((row, i) => {
        if (i !== productIndex) return row
        return {
          ...row,
          slabs: row.slabs.map((s, j) => (j === slabIndex ? { ...s, ...patch } : s))
        }
      })
    }))
  }

  const removeProductSlab = (productIndex: number, slabIndex: number) => {
    setForm(f => ({
      ...f,
      productPackIncentives: f.productPackIncentives.map((row, i) => {
        if (i !== productIndex) return row
        return { ...row, slabs: row.slabs.filter((_, j) => j !== slabIndex) }
      })
    }))
  }

  const addLine = (kind: 'allowances' | 'deductions') => {
    setForm(f => ({
      ...f,
      [kind]: [...f[kind], { name: '', type: 'fixed', value: 0 }]
    }))
  }

  const updateLine = (kind: 'allowances' | 'deductions', index: number, patch: Partial<LineIn>) => {
    setForm(f => ({
      ...f,
      [kind]: f[kind].map((row, i) => (i === index ? { ...row, ...patch } : row))
    }))
  }

  const removeLine = (kind: 'allowances' | 'deductions', index: number) => {
    setForm(f => ({ ...f, [kind]: f[kind].filter((_, i) => i !== index) }))
  }

  const emptyForm = () => ({
    name: '',
    description: '',
    basicSalary: 0,
    dailyAllowance: 0,
    allowances: [] as LineIn[],
    deductions: [] as LineIn[],
    commissionPct: 0,
    productPackIncentives: [] as ProductPackIncentiveForm[]
  })

  const rowToForm = (row: StructureRow) => ({
    name: row.name || '',
    description: row.description || '',
    basicSalary: row.basicSalary,
    dailyAllowance: row.dailyAllowance ?? 0,
    allowances: row.allowances ?? [],
    deductions: row.deductions ?? [],
    commissionPct: row.commission?.value ?? 0,
    productPackIncentives: (row.productPackIncentives ?? []).map(r => {
      const pid = typeof r.productId === 'object' ? r.productId?._id : r.productId
      const pname = typeof r.productId === 'object' ? r.productId?.name : ''
      const composition = typeof r.productId === 'object' ? r.productId?.composition : ''
      return {
        productId: String(pid || ''),
        productName: pname || '',
        composition: composition || '',
        includeBonusQty: r.includeBonusQty !== false,
        slabs: r.slabs?.length ? r.slabs : [{ fromPacks: 1, toPacks: 100, ratePerPack: 0 }],
        sampleDeliveredQty: 0
      }
    })
  })

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm())
    setPreviewSales(0)
    setOpen(true)
  }

  const openEditDialog = (row: StructureRow) => {
    setEditingId(row._id)
    setForm(rowToForm(row))
    setPreviewSales(0)
    setOpen(true)
  }

  const openAssignDialog = async (row: StructureRow) => {
    setAssignTarget(row)
    setAssignOpen(true)
    try {
      const [u, assigned] = await Promise.all([
        usersService.assignable(),
        salaryStructureService.listAssignedEmployees(row._id)
      ])
      setUsers(u.data.data || [])
      const ids = new Set<string>((assigned.data.data || []).map((e: { _id: string }) => String(e._id)))
      setAssignedIds(ids)
    } catch (e) {
      showApiError(e, 'Failed to load employees')
      setAssignOpen(false)
    }
  }

  const toggleAssignEmployee = (id: string) => {
    setAssignedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssignSave = async () => {
    if (!assignTarget) return
    setAssignSaving(true)
    try {
      const current = await salaryStructureService.listAssignedEmployees(assignTarget._id)
      const currentIds = new Set<string>((current.data.data || []).map((e: { _id: string }) => String(e._id)))
      const toAssign = [...assignedIds].filter(id => !currentIds.has(id))
      const toUnassign = [...currentIds].filter(id => !assignedIds.has(id))
      if (toAssign.length) await salaryStructureService.assignEmployees(assignTarget._id, toAssign)
      if (toUnassign.length) await salaryStructureService.unassignEmployees(assignTarget._id, toUnassign)
      showSuccess('Employee assignments updated')
      setAssignOpen(false)
      fetchRows()
    } catch (e) {
      showApiError(e, 'Assignment failed')
    } finally {
      setAssignSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || form.basicSalary <= 0) {
      showApiError(new Error('Template name and basic salary are required'), 'Validation')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        basicSalary: form.basicSalary,
        dailyAllowance: form.dailyAllowance,
        allowances: form.allowances.filter(a => a.name.trim()),
        deductions: form.deductions.filter(d => d.name.trim()),
        commission: { type: 'percentage' as const, value: form.commissionPct },
        productPackIncentives: serializeProductPackIncentives(form.productPackIncentives)
      }
      if (editingId) {
        await salaryStructureService.update(editingId, payload)
        showSuccess('Salary structure updated')
      } else {
        await salaryStructureService.create(payload)
        showSuccess('Salary structure template created')
      }
      setOpen(false)
      fetchRows()
    } catch (e) {
      showApiError(e, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<StructureRow, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Template',
        cell: ({ row }) => (
          <Stack spacing={0.25}>
            <Typography fontWeight={500}>{row.original.name}</Typography>
            {row.original.description ? (
              <Typography variant='caption' color='text.secondary'>
                {row.original.description}
              </Typography>
            ) : null}
          </Stack>
        )
      }),
      columnHelper.accessor('basicSalary', {
        header: 'Basic',
        cell: ({ row }) => <>₨ {row.original.basicSalary?.toFixed(2)}</>
      }),
      columnHelper.accessor('dailyAllowance', {
        header: 'Daily allow.',
        cell: ({ row }) => <>₨ {(row.original.dailyAllowance ?? 0).toFixed(2)}</>
      }),
      columnHelper.display({
        id: 'assigned',
        header: 'Assigned',
        cell: ({ row }) => {
          const n = row.original.assignedEmployeeCount ?? 0
          return (
            <Chip
              size='small'
              variant='outlined'
              label={`${n} employee${n === 1 ? '' : 's'}`}
              color={n > 0 ? 'primary' : 'default'}
            />
          )
        }
      }),
      columnHelper.display({
        id: 'productIncentives',
        header: 'Product incentives',
        cell: ({ row }) => {
          const n = row.original.productPackIncentives?.length ?? 0
          return n > 0 ? (
            <Chip size='small' variant='outlined' label={`${n} product${n === 1 ? '' : 's'}`} />
          ) : (
            <Typography variant='caption' color='text.disabled'>
              —
            </Typography>
          )
        }
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            size='small'
            variant='tonal'
            label={row.original.isActive ? 'Active' : 'Archived'}
            color={row.original.isActive ? 'success' : 'default'}
          />
        )
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canEdit ? (
            <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
              <IconButton size='small' aria-label='Edit template' onClick={() => openEditDialog(row.original)}>
                <i className='tabler-pencil' />
              </IconButton>
              <IconButton size='small' aria-label='Assign employees' onClick={() => openAssignDialog(row.original)}>
                <i className='tabler-users' />
              </IconButton>
            </Stack>
          ) : null
      })
    ],
    [canEdit]
  )

  const table = useReactTable({
    data: rows,
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
      <CardHeader title='Salary structure templates' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search template name…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreateDialog}>
            New template
          </Button>
        )}
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter salary structures'
          description='Narrow structures by when they were created and who created them.'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the structure.'
          datePickerId='salary-structure-date-range-picker-months'
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
                  No structures
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>{editingId ? 'Edit salary template' : 'New salary template'}</DialogTitle>
        <DialogContent>
          <Typography variant='caption' color='text.secondary' display='block' className='mbe-4'>
            Templates define pay rules once. Assign employees to apply the template in payroll.
          </Typography>
          <Grid container spacing={4} className='pbs-2'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Template name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder='e.g. Medical Rep – Standard'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Description (optional)'
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Basic salary'
                value={form.basicSalary}
                onChange={e => setForm(p => ({ ...p, basicSalary: +e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Daily allowance (per day)'
                value={form.dailyAllowance}
                onChange={e => setForm(p => ({ ...p, dailyAllowance: +e.target.value }))}
                helperText='Paid only when present (half day = 50%)'
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex items-center justify-between mbe-2'>
                <Typography variant='subtitle2'>Allowances</Typography>
                <Button size='small' onClick={() => addLine('allowances')}>
                  Add
                </Button>
              </div>
              {form.allowances.map((line, i) => (
                <Grid container spacing={2} key={`a-${i}`} className='mbe-2'>
                  <Grid size={{ xs: 5 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      label='Name'
                      value={line.name}
                      onChange={e => updateLine('allowances', i, { name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      select
                      fullWidth
                      size='small'
                      label='Type'
                      value={line.type}
                      onChange={e => updateLine('allowances', i, { type: e.target.value as LineIn['type'] })}
                    >
                      <MenuItem value='fixed'>Fixed</MenuItem>
                      <MenuItem value='percentage'>% of basic</MenuItem>
                    </CustomTextField>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      type='number'
                      label='Value'
                      value={line.value}
                      onChange={e => updateLine('allowances', i, { value: +e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 1 }} className='flex items-center'>
                    <IconButton size='small' onClick={() => removeLine('allowances', i)}>
                      <i className='tabler-trash' />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex items-center justify-between mbe-2'>
                <Typography variant='subtitle2'>Deductions</Typography>
                <Button size='small' onClick={() => addLine('deductions')}>
                  Add
                </Button>
              </div>
              {form.deductions.map((line, i) => (
                <Grid container spacing={2} key={`d-${i}`} className='mbe-2'>
                  <Grid size={{ xs: 5 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      label='Name'
                      value={line.name}
                      onChange={e => updateLine('deductions', i, { name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      select
                      fullWidth
                      size='small'
                      label='Type'
                      value={line.type}
                      onChange={e => updateLine('deductions', i, { type: e.target.value as LineIn['type'] })}
                    >
                      <MenuItem value='fixed'>Fixed</MenuItem>
                      <MenuItem value='percentage'>% of basic</MenuItem>
                    </CustomTextField>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      type='number'
                      label='Value'
                      value={line.value}
                      onChange={e => updateLine('deductions', i, { value: +e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 1 }} className='flex items-center'>
                    <IconButton size='small' onClick={() => removeLine('deductions', i)}>
                      <i className='tabler-trash' />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Commission % (of monthly sales)'
                value={form.commissionPct}
                onChange={e => setForm(p => ({ ...p, commissionPct: +e.target.value }))}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Preview monthly sales (estimate)'
                value={previewSales}
                onChange={e => setPreviewSales(+e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider className='mbe-2 mts-2' />
              <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant='subtitle2'>Product pack incentives</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Flat slab: total delivered packs pick one tier; rate applies to all packs in that tier.
                  </Typography>
                </Box>
                <Button size='small' variant='outlined' startIcon={<i className='tabler-plus' />} onClick={addProductIncentive}>
                  Add product
                </Button>
              </Stack>

              {form.productPackIncentives.length === 0 ? (
                <Paper
                  variant='outlined'
                  sx={{
                    p: 2.5,
                    borderStyle: 'dashed',
                    bgcolor: alpha(theme.palette.action.hover, 0.35)
                  }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    No product incentives configured. Add products with pack slabs (e.g. Airoflox 1–100 @ Rs 2/pack).
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2.5}>
                  {form.productPackIncentives.map((rule, pi) => {
                    const selectedProduct =
                      rule.productId && rule.productName
                        ? { _id: rule.productId, name: rule.productName, composition: rule.composition }
                        : null
                    const sampleQty = rule.sampleDeliveredQty ?? 0
                    const sampleResult =
                      sampleQty > 0 && rule.slabs.length ? calcFlatSlabIncentive(rule.slabs, sampleQty) : null
                    return (
                      <Paper key={`prod-inc-${pi}`} variant='outlined' sx={{ p: 2 }}>
                        <Grid container spacing={2} alignItems='flex-start'>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <LookupAutocomplete<{ _id: string; name: string; composition?: string }>
                              value={selectedProduct}
                              onChange={v => {
                                if (!v) {
                                  updateProductIncentive(pi, { productId: '', productName: '', composition: '' })
                                  return
                                }
                                if (usedProductIds.has(String(v._id)) && String(v._id) !== rule.productId) return
                                updateProductIncentive(pi, {
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
                              fetchErrorMessage='Failed to load products'
                              getOptionLabel={o => (o.composition ? `${o.name} · ${o.composition}` : o.name)}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={rule.includeBonusQty}
                                  onChange={e => updateProductIncentive(pi, { includeBonusQty: e.target.checked })}
                                />
                              }
                              label='Include bonus/free packs'
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', justifyContent: { md: 'flex-end' } }}>
                            <IconButton color='error' size='small' onClick={() => removeProductIncentive(pi)} aria-label='Remove product'>
                              <i className='tabler-trash' />
                            </IconButton>
                          </Grid>
                        </Grid>

                        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1.5, mb: 1 }}>
                          Slabs (from / to packs inclusive; leave to empty for open-ended top tier)
                        </Typography>
                        {rule.slabs.map((slab, si) => (
                          <Grid container spacing={1.5} key={`slab-${pi}-${si}`} alignItems='center' sx={{ mb: 1 }}>
                            <Grid size={{ xs: 3, sm: 2 }}>
                              <CustomTextField
                                fullWidth
                                size='small'
                                type='number'
                                label='From'
                                inputProps={{ min: 1, step: 1 }}
                                value={slab.fromPacks}
                                onChange={e =>
                                  updateProductSlab(pi, si, { fromPacks: e.target.value === '' ? 1 : +e.target.value })
                                }
                              />
                            </Grid>
                            <Grid size={{ xs: 3, sm: 2 }}>
                              <CustomTextField
                                fullWidth
                                size='small'
                                type='number'
                                label='To'
                                placeholder='∞'
                                inputProps={{ min: 1, step: 1 }}
                                value={slab.toPacks ?? ''}
                                onChange={e => {
                                  const v = e.target.value
                                  updateProductSlab(pi, si, { toPacks: v === '' ? null : +v })
                                }}
                              />
                            </Grid>
                            <Grid size={{ xs: 4, sm: 3 }}>
                              <CustomTextField
                                fullWidth
                                size='small'
                                type='number'
                                label='Rs / pack'
                                inputProps={{ min: 0, step: 0.01 }}
                                value={slab.ratePerPack}
                                onChange={e =>
                                  updateProductSlab(pi, si, { ratePerPack: e.target.value === '' ? 0 : +e.target.value })
                                }
                              />
                            </Grid>
                            <Grid size={{ xs: 2, sm: 1 }}>
                              <IconButton
                                size='small'
                                color='error'
                                disabled={rule.slabs.length <= 1}
                                onClick={() => removeProductSlab(pi, si)}
                                aria-label='Remove slab'
                              >
                                <i className='tabler-trash' />
                              </IconButton>
                            </Grid>
                          </Grid>
                        ))}
                        <Button size='small' onClick={() => addProductSlab(pi)} sx={{ mt: 0.5 }}>
                          Add slab
                        </Button>

                        <Grid container spacing={2} sx={{ mt: 1.5 }}>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <CustomTextField
                              fullWidth
                              size='small'
                              type='number'
                              label='Preview delivered qty (sample)'
                              inputProps={{ min: 0, step: 1 }}
                              value={rule.sampleDeliveredQty ?? ''}
                              onChange={e =>
                                updateProductIncentive(pi, {
                                  sampleDeliveredQty: e.target.value === '' ? 0 : +e.target.value
                                })
                              }
                              helperText='Estimate only — payroll uses real deliveries'
                            />
                          </Grid>
                          {sampleResult && sampleQty > 0 ? (
                            <Grid size={{ xs: 12, sm: 8 }} sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant='body2' color='text.secondary'>
                                Sample: {sampleQty} packs → ₨ {sampleResult.amount.toFixed(2)}
                                {sampleResult.slab
                                  ? ` (slab ${sampleResult.slab.fromPacks}–${sampleResult.slab.toPacks ?? '∞'} @ ₨ ${sampleResult.slab.ratePerPack}/pack)`
                                  : ' (no matching slab)'}
                              </Typography>
                            </Grid>
                          ) : null}
                        </Grid>
                      </Paper>
                    )
                  })}
                </Stack>
              )}
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider className='mbe-2' />
              <Typography variant='subtitle2' className='mbe-1'>
                Live preview (payroll run uses real order totals for commission and delivered packs for incentives)
              </Typography>
              <Typography variant='body2'>Gross: ₨ {preview.gross.toFixed(2)}</Typography>
              <Typography variant='body2'>Net: ₨ {preview.net.toFixed(2)}</Typography>
              {preview.productIncentivePreview > 0 ? (
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                  Product incentives (sample): ₨ {preview.productIncentivePreview.toFixed(2)}
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
            disabled={saving || !form.name.trim() || form.basicSalary <= 0}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Assign employees</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mbe-4'>
            {assignTarget ? `Template: ${assignTarget.name}` : ''}
          </Typography>
          <Stack spacing={0.5} sx={{ maxHeight: 360, overflow: 'auto' }}>
            {users.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No assignable employees
              </Typography>
            ) : (
              users.map(u => (
                <FormControlLabel
                  key={u._id}
                  control={
                    <Checkbox checked={assignedIds.has(u._id)} onChange={() => toggleAssignEmployee(u._id)} />
                  }
                  label={u.name}
                />
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)} disabled={assignSaving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleAssignSave}
            disabled={assignSaving}
            startIcon={assignSaving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {assignSaving ? 'Saving...' : 'Save assignments'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default SalaryStructurePage
