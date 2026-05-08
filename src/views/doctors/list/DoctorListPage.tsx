'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { doctorsService } from '@/services/doctors.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import DoctorBulkImportDialog from './DoctorBulkImportDialog'
import DoctorAssignDialog from './DoctorAssignDialog'
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
import { TeamScopeToggle, type TeamScope } from '@/components/team-scope/TeamScopeToggle'
import tableStyles from '@core/styles/table.module.css'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { DoctorOwnershipPanel } from '@/components/doctors/DoctorMrepIntelligenceSection'

export type DoctorFormState = {
  pharmacyId: string
  name: string
  specialization: string
  phone: string
  email: string
  zone: string
  doctorBrick: string
  doctorCode: string
  qualification: string
  mobileNo: string
  gender: string
  frequency: string
  locationName: string
  address: string
  city: string
  grade: string
  pmdcRegistration: string
  designation: string
  patientCount: string
}

const emptyForm = (): DoctorFormState => ({
  pharmacyId: '',
  name: '',
  specialization: '',
  phone: '',
  email: '',
  zone: '',
  doctorBrick: '',
  doctorCode: '',
  qualification: '',
  mobileNo: '',
  gender: '',
  frequency: '',
  locationName: '',
  address: '',
  city: '',
  grade: '',
  pmdcRegistration: '',
  designation: '',
  patientCount: ''
})

type Doctor = {
  _id: string
  name: string
  specialization?: string
  phone?: string
  mobileNo?: string
  email?: string
  pharmacyId: any
  isActive: boolean
  zone?: string
  doctorBrick?: string
  doctorCode?: string
  qualification?: string
  gender?: string
  frequency?: string
  locationName?: string
  address?: string
  city?: string
  grade?: string
  pmdcRegistration?: string
  designation?: string
  patientCount?: number | null
}

const columnHelper = createColumnHelper<Doctor>()

const detailVal = (v?: string | number | null) =>
  v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '—'

const DoctorListPage = () => {
  const searchParams = useSearchParams()
  const [data, setData] = useState<Doctor[]>([])
  const [selectedPharmacy, setSelectedPharmacy] = useState<{ _id: string; name?: string } | null>(null)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Doctor | null>(null)
  const [form, setForm] = useState<DoctorFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<Doctor | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Doctor | null>(null)

  const isFormValid = form.name.trim() !== ''

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('doctors.create')
  const canEdit = hasPermission('doctors.edit')
  const canDelete = hasPermission('doctors.delete')
  const canAssign = hasPermission('doctors.assign')
  const canSeeTeam = hasPermission('team.viewAllReports') || hasPermission('admin.access')
  const urlWantsTeamScope = searchParams.get('scope') === 'team'
  const assignedRepIdFromUrl = searchParams.get('assignedRepId')
  const underTerritoryIdFromUrl = searchParams.get('underTerritoryId')
  const [scope, setScope] = useState<TeamScope>('self')

  useEffect(() => {
    if (urlWantsTeamScope && canSeeTeam) setScope('team')
  }, [urlWantsTeamScope, canSeeTeam])

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      if (canSeeTeam && scope === 'team') params.scope = 'team'
      if (assignedRepIdFromUrl && /^[a-f0-9]{24}$/i.test(assignedRepIdFromUrl)) {
        params.assignedRepId = assignedRepIdFromUrl
      }
      if (underTerritoryIdFromUrl && /^[a-f0-9]{24}$/i.test(underTerritoryIdFromUrl)) {
        params.underTerritoryId = underTerritoryIdFromUrl
      }
      const docsRes = await doctorsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(docsRes.data.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load data')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch, scope, canSeeTeam, assignedRepIdFromUrl, underTerritoryIdFromUrl])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const mapDoctorToForm = (item: Doctor): DoctorFormState => ({
    pharmacyId: (() => {
      const ph = item.pharmacyId
      if (ph && typeof ph === 'object' && ph !== null) return String(ph._id ?? '')
      return ph ? String(ph) : ''
    })(),
    name: item.name,
    specialization: item.specialization || '',
    phone: item.phone || '',
    email: item.email || '',
    zone: item.zone || '',
    doctorBrick: item.doctorBrick || '',
    doctorCode: item.doctorCode || '',
    qualification: item.qualification || '',
    mobileNo: item.mobileNo || '',
    gender: item.gender || '',
    frequency: item.frequency || '',
    locationName: item.locationName || '',
    address: item.address || '',
    city: item.city || '',
    grade: item.grade || '',
    pmdcRegistration: item.pmdcRegistration || '',
    designation: item.designation || '',
    patientCount: item.patientCount != null && item.patientCount !== undefined ? String(item.patientCount) : ''
  })

  const handleOpen = (item?: Doctor) => {
    if (item) {
      setEditItem(item)
      const ph = item.pharmacyId
      const pid = ph && typeof ph === 'object' && ph !== null ? String(ph._id ?? '') : ph ? String(ph) : ''
      const pname =
        ph && typeof ph === 'object' && ph !== null && 'name' in ph ? String((ph as { name?: string }).name ?? '') : ''
      setSelectedPharmacy(pid ? { _id: pid, name: pname } : null)
      setForm(mapDoctorToForm(item))
    } else {
      setEditItem(null)
      setSelectedPharmacy(null)
      setForm(emptyForm())
    }
    setOpen(true)
  }

  const payloadFromForm = (f: DoctorFormState) => {
    const patientCount =
      f.patientCount.trim() === '' ? null : Math.max(0, Math.floor(Number(f.patientCount)) || 0)
    return {
      pharmacyId: f.pharmacyId.trim() || null,
      name: f.name.trim(),
      specialization: f.specialization.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      zone: f.zone.trim(),
      doctorBrick: f.doctorBrick.trim(),
      doctorCode: f.doctorCode.trim(),
      qualification: f.qualification.trim(),
      mobileNo: f.mobileNo.trim(),
      gender: f.gender.trim(),
      frequency: f.frequency.trim(),
      locationName: f.locationName.trim(),
      address: f.address.trim(),
      city: f.city.trim(),
      grade: f.grade.trim(),
      pmdcRegistration: f.pmdcRegistration.trim(),
      designation: f.designation.trim(),
      patientCount
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = payloadFromForm(form)
      if (editItem) {
        await doctorsService.update(editItem._id, body)
        showSuccess('Doctor updated')
      } else {
        await doctorsService.create(body)
        showSuccess('Doctor created')
      }
      setOpen(false)
      fetchData()
    } catch (err: any) {
      showApiError(err, 'Error saving doctor')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = (id: string) => {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await doctorsService.remove(deleteId)
      showSuccess('Doctor deleted successfully')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting doctor')
    } finally {
      setDeleting(false)
    }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Doctor, any>[]>(
    () => [
      columnHelper.accessor('doctorCode', {
        header: 'Code',
        cell: ({ getValue }) => getValue() || '—'
      }),
      columnHelper.accessor('name', {
        header: 'Doctor name',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography>
      }),
      columnHelper.accessor('specialization', { header: 'Specialty', cell: ({ getValue }) => getValue() || '—' }),
      columnHelper.accessor('zone', { header: 'Zone', cell: ({ getValue }) => getValue() || '—' }),
      columnHelper.accessor('city', { header: 'City', cell: ({ getValue }) => getValue() || '—' }),
      columnHelper.display({
        id: 'pharmacy',
        header: 'Pharmacy',
        cell: ({ row }) => row.original.pharmacyId?.name || '—'
      }),
      columnHelper.accessor('mobileNo', {
        header: 'Mobile',
        cell: ({ row }) => row.original.mobileNo || row.original.phone || '—'
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex gap-1'>
            <IconButton size='small' onClick={() => setViewItem(row.original)} aria-label='View details'>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
            {canEdit && (
              <IconButton size='small' onClick={() => handleOpen(row.original)}>
                <i className='tabler-edit text-textSecondary' />
              </IconButton>
            )}
            {canAssign && (
              <IconButton
                size='small'
                onClick={() => setAssignTarget(row.original)}
                aria-label='Assign territory / rep / target'
              >
                <i className='tabler-user-plus text-textSecondary' />
              </IconButton>
            )}
            {canDelete && (
              <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}>
                <i className='tabler-trash text-textSecondary' />
              </IconButton>
            )}
          </div>
        )
      })
    ],
    [canEdit, canAssign, canDelete]
  )

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
      {underTerritoryIdFromUrl && /^[a-f0-9]{24}$/i.test(underTerritoryIdFromUrl) ? (
        <Alert severity="info" sx={{ mx: 3, mb: 0 }}>
          Listing doctors whose brick assignment falls under this territory (including the territory itself when it is a brick). Remove the filter from the address bar to see the full directory.
        </Alert>
      ) : null}
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search name, code, specialty, zone, city, mobile…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
          {canSeeTeam && <TeamScopeToggle value={scope} onChange={setScope} />}
        </Stack>
        {canCreate && (
          <Stack direction='row' spacing={1.5} useFlexGap>
            <Button
              variant='outlined'
              startIcon={<i className='tabler-file-upload' />}
              onClick={() => setImportOpen(true)}
            >
              Import Doctors
            </Button>
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>
              Add Doctor
            </Button>
          </Stack>
        )}
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
                  No doctors found
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

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='lg' fullWidth scroll='paper'>
        <DialogTitle>Doctor details</DialogTitle>
        <DialogContent dividers>
          {viewItem && (
            <Grid container spacing={3} className='pbs-2'>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Status
                </Typography>
                <Chip
                  label={viewItem.isActive ? 'Active' : 'Inactive'}
                  color={viewItem.isActive ? 'success' : 'default'}
                  size='small'
                  variant='tonal'
                  className='mts-1'
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Doctor name
                </Typography>
                <Typography fontWeight={600}>{viewItem.name}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Doctor code
                </Typography>
                <Typography>{detailVal(viewItem.doctorCode)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Pharmacy
                </Typography>
                <Typography>
                  {viewItem.pharmacyId && typeof viewItem.pharmacyId === 'object' && viewItem.pharmacyId !== null
                    ? String((viewItem.pharmacyId as { name?: string }).name ?? '—')
                    : '—'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Specialty
                </Typography>
                <Typography>{detailVal(viewItem.specialization)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Qualification
                </Typography>
                <Typography>{detailVal(viewItem.qualification)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Designation
                </Typography>
                <Typography>{detailVal(viewItem.designation)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Gender
                </Typography>
                <Typography>{detailVal(viewItem.gender)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Mobile no.
                </Typography>
                <Typography>{detailVal(viewItem.mobileNo)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Phone
                </Typography>
                <Typography>{detailVal(viewItem.phone)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Email
                </Typography>
                <Typography>{detailVal(viewItem.email)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Zone
                </Typography>
                <Typography>{detailVal(viewItem.zone)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Doctor brick
                </Typography>
                <Typography>{detailVal(viewItem.doctorBrick)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Frequency
                </Typography>
                <Typography>{detailVal(viewItem.frequency)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Grade
                </Typography>
                <Typography>{detailVal(viewItem.grade)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Location name
                </Typography>
                <Typography>{detailVal(viewItem.locationName)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  City
                </Typography>
                <Typography>{detailVal(viewItem.city)}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Address
                </Typography>
                <Typography>{detailVal(viewItem.address)}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  PMDC # / Duplicate / SMART
                </Typography>
                <Typography>{detailVal(viewItem.pmdcRegistration)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  No. of patients
                </Typography>
                <Typography>{viewItem.patientCount != null ? String(viewItem.patientCount) : '—'}</Typography>
              </Grid>
              <DoctorOwnershipPanel doctorId={viewItem._id} active />
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='md' fullWidth scroll='paper'>
        <DialogTitle>{editItem ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3} className='pbs-2'>
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
                placeholder='Type to search (optional)'
                helperText='Optional — link a pharmacy when this doctor is tied to one.'
                fetchErrorMessage='Failed to load pharmacies'
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='overline' color='text.secondary'>
                Core
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Doctor name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Doctor code'
                value={form.doctorCode}
                onChange={e => setForm(p => ({ ...p, doctorCode: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Specialty'
                value={form.specialization}
                onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Qualification'
                value={form.qualification}
                onChange={e => setForm(p => ({ ...p, qualification: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Designation'
                value={form.designation}
                onChange={e => setForm(p => ({ ...p, designation: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                fullWidth
                label='Gender'
                value={form.gender}
                onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value=''>(Not specified)</MenuItem>
                <MenuItem value='Male'>Male</MenuItem>
                <MenuItem value='Female'>Female</MenuItem>
                <MenuItem value='Other'>Other</MenuItem>
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Mobile no.'
                value={form.mobileNo}
                onChange={e => setForm(p => ({ ...p, mobileNo: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Phone'
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='email'
                label='Email'
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='overline' color='text.secondary'>
                Territory &amp; location
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label='Zone' value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Doctor brick'
                value={form.doctorBrick}
                onChange={e => setForm(p => ({ ...p, doctorBrick: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Frequency'
                value={form.frequency}
                onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Grade'
                value={form.grade}
                onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Location name'
                value={form.locationName}
                onChange={e => setForm(p => ({ ...p, locationName: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label='City' value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Address'
                multiline
                minRows={2}
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='PMDC # / Duplicate / SMART'
                value={form.pmdcRegistration}
                onChange={e => setForm(p => ({ ...p, pmdcRegistration: e.target.value }))}
                helperText='Registration or program reference'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='number'
                inputProps={{ min: 0 }}
                label='No. of patients'
                value={form.patientCount}
                onChange={e => setForm(p => ({ ...p, patientCount: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={() => void handleSave()}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
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

      <DoctorBulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void fetchData()
        }}
      />

      <DoctorAssignDialog
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        onSaved={() => {
          void fetchData()
        }}
        doctor={assignTarget as any}
      />
    </Card>
  )
}

export default DoctorListPage
