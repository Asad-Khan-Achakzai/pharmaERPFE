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
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { targetsService } from '@/services/targets.service'
import { usersService } from '@/services/users.service'
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

type Target = { _id: string; medicalRepId: any; month: string; salesTarget: number; achievedSales: number; packsTarget: number; achievedPacks: number }

type PackBreakdownPayload = {
  month: string
  medicalRepId: string
  totalNetPacks: number
  rows: Array<{
    productId: string
    productName: string
    composition?: string
    deliveredQuantity: number
    returnedQuantity: number
    netQuantity: number
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
  const [form, setForm] = useState({ medicalRepId: '', month: '', salesTarget: 0, packsTarget: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [packsDrawerOpen, setPacksDrawerOpen] = useState(false)
  const [packsDrawerRow, setPacksDrawerRow] = useState<Target | null>(null)
  const [packsBreakdown, setPacksBreakdown] = useState<PackBreakdownPayload | null>(null)
  const [packsBreakdownLoading, setPacksBreakdownLoading] = useState(false)

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
  }, [])

  const hasAtLeastOneTarget = form.salesTarget > 0 || form.packsTarget > 0
  const isFormValid = form.medicalRepId !== '' && form.month.trim() !== '' && hasAtLeastOneTarget

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
    setForm({
      medicalRepId: '',
      month: formatYyyyMm(new Date()),
      salesTarget: 0,
      packsTarget: 0
    })
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
      packsTarget: row.packsTarget
    })
    setOpen(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (dialogMode === 'edit' && editingId) {
        await targetsService.update(editingId, { salesTarget: form.salesTarget, packsTarget: form.packsTarget })
        showSuccess('Target updated')
      } else {
        await targetsService.create(form)
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
          const pct =
            row.original.packsTarget > 0
              ? Math.min((row.original.achievedPacks / row.original.packsTarget) * 100, 100)
              : 0
          return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <LinearProgress variant='determinate' value={pct} color='secondary' />
                <Typography variant='caption' component='div' sx={{ mt: 0.5, display: 'block' }}>
                  {row.original.achievedPacks} / {row.original.packsTarget}
                </Typography>
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

  return (
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
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
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
                Set at least one: sales target (PKR), packs target, or both.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
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
                helperText='Optional if packs target is set'
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <CustomTextField
                fullWidth
                label='Packs target'
                type='number'
                inputProps={{ min: 0, step: 1 }}
                value={form.packsTarget || ''}
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({ ...p, packsTarget: v === '' ? 0 : +v }))
                }}
                helperText='Optional if sales target is set'
              />
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
            <IconButton size='small' onClick={closePacksDrawer} aria-label='Close'>
              <i className='tabler-x' />
            </IconButton>
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
                        <TableCell align='right'>Delivered</TableCell>
                        <TableCell align='right'>Returned</TableCell>
                        <TableCell align='right'>Net</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {packsBreakdown.rows.map(r => (
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
                          <TableCell align='right'>{r.deliveredQuantity}</TableCell>
                          <TableCell align='right'>{r.returnedQuantity}</TableCell>
                          <TableCell align='right'>
                            <Typography fontWeight={600} color={r.netQuantity >= 0 ? 'text.primary' : 'error.main'}>
                              {r.netQuantity}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: alpha(theme.palette.secondary.main, 0.06), fontVariantNumeric: 'tabular-nums' } }}>
                        <TableCell>Total</TableCell>
                        <TableCell align='right'>
                          {packsBreakdown.rows.reduce((s, x) => s + x.deliveredQuantity, 0)}
                        </TableCell>
                        <TableCell align='right'>
                          {packsBreakdown.rows.reduce((s, x) => s + x.returnedQuantity, 0)}
                        </TableCell>
                        <TableCell align='right'>{packsBreakdown.totalNetPacks}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Box>
      </Drawer>
    </Card>
  )
}
export default TargetsPage
