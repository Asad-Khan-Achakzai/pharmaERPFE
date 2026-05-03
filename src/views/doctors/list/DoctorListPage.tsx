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
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { doctorsService } from '@/services/doctors.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
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
import tableStyles from '@core/styles/table.module.css'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

type Doctor = { _id: string; name: string; specialization: string; phone: string; pharmacyId: any; isActive: boolean }

const columnHelper = createColumnHelper<Doctor>()

const DoctorListPage = () => {
  const [data, setData] = useState<Doctor[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<{ _id: string; name?: string } | null>(null)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Doctor | null>(null)
  const [form, setForm] = useState({ pharmacyId: '', name: '', specialization: '', phone: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFormValid = form.pharmacyId !== '' && form.name.trim() !== ''

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('doctors.create')
  const canEdit = hasPermission('doctors.edit')
  const canDelete = hasPermission('doctors.delete')

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const docsRes = await doctorsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(docsRes.data.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load data')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleOpen = (item?: Doctor) => {
    if (item) {
      setEditItem(item)
      const ph = item.pharmacyId
      const pid = ph && typeof ph === 'object' && ph !== null ? String(ph._id ?? '') : ph ? String(ph) : ''
      const pname =
        ph && typeof ph === 'object' && ph !== null && 'name' in ph ? String((ph as { name?: string }).name ?? '') : ''
      setSelectedPharmacy(pid ? { _id: pid, name: pname } : null)
      setForm({
        pharmacyId: pid,
        name: item.name,
        specialization: item.specialization || '',
        phone: item.phone || '',
        email: ''
      })
    } else {
      setEditItem(null)
      setSelectedPharmacy(null)
      setForm({ pharmacyId: '', name: '', specialization: '', phone: '', email: '' })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editItem) { await doctorsService.update(editItem._id, form); showSuccess('Doctor updated') }
      else { await doctorsService.create(form); showSuccess('Doctor created') }
      setOpen(false); fetchData()
    } catch (err: any) { showApiError(err, 'Error saving doctor') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await doctorsService.remove(deleteId); showSuccess('Doctor deleted successfully'); setConfirmOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Error deleting doctor') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Doctor, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('specialization', { header: 'Specialization' }),
    columnHelper.display({ id: 'pharmacy', header: 'Pharmacy', cell: ({ row }) => row.original.pharmacyId?.name || '-' }),
    columnHelper.accessor('phone', { header: 'Phone' }),
    columnHelper.display({ id: 'actions', header: 'Actions', cell: ({ row }) => (
      <div className='flex gap-1'>
        {canEdit && <IconButton size='small' onClick={() => handleOpen(row.original)}><i className='tabler-edit text-textSecondary' /></IconButton>}
        {canDelete && <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton>}
      </div>
    ) })
  ], [canEdit, canDelete])

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
      <CardHeader title='Doctors' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search name, specialization, pharmacy…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>Add Doctor</Button>}
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter doctors'
          description='Narrow the list by when the doctor was added and who created the record.'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the doctor record.'
          datePickerId='doctor-list-date-range-picker-months'
          appliedFilters={appliedFilters}
          onAppliedChange={setAppliedFilters}
          filterAnchor={filterAnchor}
          open={filterOpen}
          onClose={closeFilterPopover}
        />
      </ListFilterPopover>

      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : <div className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''} onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}</div>}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No doctors found</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editItem ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <LookupAutocomplete
                value={selectedPharmacy}
                onChange={v => {
                  setSelectedPharmacy(v)
                  setForm(p => ({ ...p, pharmacyId: v ? String(v._id) : '' }))
                }}
                fetchOptions={search =>
                  pharmaciesService.lookup({ limit: 25, ...(search ? { search } : {}) }).then(r => r.data.data || [])
                }
                label='Pharmacy'
                placeholder='Type to search'
                helperText='Search by pharmacy name'
                required
                fetchErrorMessage='Failed to load pharmacies'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Specialization' value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Doctor?'
        description='This doctor will be removed. You can contact support to restore it if needed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default DoctorListPage
