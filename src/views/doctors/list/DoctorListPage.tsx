'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
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
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { doctorsService } from '@/services/doctors.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import MediaUpload from '@/components/media/MediaUpload'
import EntityImageCell from '@/components/media/EntityImageCell'
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
import { GeoFeatureGate } from '@/geo/GeoPlatformProvider'
import { DoctorMapScene } from '@/geo/scenes/DoctorMapScene'
import { LocationPickerScene } from '@/geo/scenes/LocationPickerScene'

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
  latitude: string
  longitude: string
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
  patientCount: '',
  latitude: '',
  longitude: ''
})

type Doctor = {
  _id: string
  name: string
  imageUrl?: string | null
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
  locationStatus?: string
  latitude?: number | null
  longitude?: number | null
}

const columnHelper = createColumnHelper<Doctor>()

const detailVal = (v?: string | number | null) =>
  v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '—'

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

const formatCoords = (lat?: number | null, lng?: number | null) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

const parseCoordField = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

const coordsFromForm = (lat: string, lng: string) => {
  const latitude = parseCoordField(lat)
  const longitude = parseCoordField(lng)
  if (latitude == null && longitude == null) return { latitude: null, longitude: null }
  return { latitude, longitude }
}

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
  const [assetId, setAssetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<Doctor | null>(null)
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationTarget, setLocationTarget] = useState<Doctor | null>(null)
  const [locationLat, setLocationLat] = useState('')
  const [locationLng, setLocationLng] = useState('')
  const [locationSaving, setLocationSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Doctor | null>(null)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [totalEntries, setTotalEntries] = useState(0)

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

  /** New filters / search should reset to page 1 before fetch (avoid a stale-page request). */
  useLayoutEffect(() => {
    setPagination(p => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }, [appliedFilters, debouncedSearch, scope, canSeeTeam, assignedRepIdFromUrl, underTerritoryIdFromUrl])

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: String(pagination.pageIndex + 1),
        limit: String(pagination.pageSize)
      }
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
      const pag = docsRes.data.pagination
      setTotalEntries(typeof pag?.total === 'number' ? pag.total : 0)
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load data')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    appliedFilters,
    debouncedSearch,
    scope,
    canSeeTeam,
    assignedRepIdFromUrl,
    underTerritoryIdFromUrl
  ])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [pagination.pageIndex, pagination.pageSize, appliedFilters, debouncedSearch, scope])

  const pageIds = useMemo(() => data.map(d => d._id), [data])
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
  const somePageSelected = pageIds.some(id => selectedIds.has(id)) && !allPageSelected

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach(id => next.delete(id))
      else pageIds.forEach(id => next.add(id))
      return next
    })
  }

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
    patientCount: item.patientCount != null && item.patientCount !== undefined ? String(item.patientCount) : '',
    latitude: typeof item.latitude === 'number' ? String(item.latitude) : '',
    longitude: typeof item.longitude === 'number' ? String(item.longitude) : ''
  })

  const handleOpen = (item?: Doctor) => {
    setAssetId(null)
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
      patientCount,
      ...coordsFromForm(f.latitude, f.longitude)
    }
  }

  const openLocationDialog = (item: Doctor) => {
    setLocationTarget(item)
    setLocationLat(typeof item.latitude === 'number' ? String(item.latitude) : '')
    setLocationLng(typeof item.longitude === 'number' ? String(item.longitude) : '')
    setLocationOpen(true)
  }

  const saveLocation = async () => {
    if (!locationTarget) return
    const lat = parseCoordField(locationLat)
    const lng = parseCoordField(locationLng)
    if ((lat != null && lng == null) || (lat == null && lng != null)) {
      showApiError(new Error('Provide both latitude and longitude, or clear both.'), 'Invalid location')
      return
    }
    setLocationSaving(true)
    try {
      const { latitude, longitude } = coordsFromForm(locationLat, locationLng)
      await doctorsService.update(locationTarget._id, { latitude, longitude })
      showSuccess(latitude != null && longitude != null ? 'Doctor location saved' : 'Doctor location cleared')
      setLocationOpen(false)
      setLocationTarget(null)
      await fetchData()
      if (viewItem?._id === locationTarget._id) {
        setViewItem(prev =>
          prev
            ? {
                ...prev,
                latitude,
                longitude,
                locationStatus: latitude != null && longitude != null ? 'VERIFIED' : 'UNVERIFIED'
              }
            : prev
        )
      }
    } catch (err) {
      showApiError(err, 'Could not save doctor location')
    } finally {
      setLocationSaving(false)
    }
  }

  const handleSave = async () => {
    const lat = parseCoordField(form.latitude)
    const lng = parseCoordField(form.longitude)
    if ((lat != null && lng == null) || (lat == null && lng != null)) {
      showApiError(new Error('Provide both latitude and longitude, or leave both empty.'), 'Invalid location')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = payloadFromForm(form)
      if (assetId) body.assetId = assetId
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

  const openDeleteConfirm = (ids: string[]) => {
    setDeleteIds(ids)
    setConfirmOpen(true)
  }

  const handleDelete = useCallback(async () => {
    if (deleteIds.length === 0) return
    setDeleting(true)
    try {
      const results = await Promise.allSettled(deleteIds.map(id => doctorsService.remove(id)))
      const failed = results.filter(r => r.status === 'rejected').length
      const succeeded = results.length - failed
      if (failed === 0) {
        showSuccess(
          succeeded === 1 ? 'Doctor deleted successfully' : `${succeeded} doctors deleted successfully`
        )
      } else if (succeeded === 0) {
        const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
        showApiError(firstError?.reason, 'Error deleting doctors')
      } else {
        showApiError(null, `${succeeded} deleted, ${failed} failed`)
      }
      setConfirmOpen(false)
      setDeleteIds([])
      setSelectedIds(new Set())
      fetchData()
    } finally {
      setDeleting(false)
    }
  }, [deleteIds, fetchData])

  const columns = useMemo<ColumnDef<Doctor, any>[]>(
    () => [
      ...(canDelete
        ? [
            columnHelper.display({
              id: 'select',
              header: () => (
                <Checkbox
                  size='small'
                  checked={allPageSelected}
                  indeterminate={somePageSelected}
                  onChange={toggleSelectAllPage}
                  inputProps={{ 'aria-label': 'Select all doctors on this page' }}
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  size='small'
                  checked={selectedIds.has(row.original._id)}
                  onChange={() => toggleSelect(row.original._id)}
                  inputProps={{ 'aria-label': `Select ${row.original.name}` }}
                />
              )
            })
          ]
        : []),
      columnHelper.accessor('doctorCode', {
        header: 'Code',
        cell: ({ getValue }) => getValue() || '—'
      }),
      columnHelper.accessor('name', {
        header: 'Doctor name',
        cell: ({ row }) => (
          <Stack direction='row' alignItems='center' spacing={1.5}>
            <EntityImageCell url={row.original.imageUrl} name={row.original.name} rounded />
            <Typography fontWeight={500}>{row.original.name}</Typography>
          </Stack>
        )
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
              <IconButton size='small' onClick={() => openDeleteConfirm([row.original._id])}>
                <i className='tabler-trash text-textSecondary' />
              </IconButton>
            )}
          </div>
        )
      })
    ],
    [canEdit, canAssign, canDelete, allPageSelected, somePageSelected, selectedIds, pageIds]
  )

  const table = useReactTable({
    data,
    columns,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalEntries / pagination.pageSize)),
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
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
        {((canDelete && selectedIds.size > 0) || canCreate) && (
          <Stack direction='row' spacing={1.5} useFlexGap>
            {canDelete && selectedIds.size > 0 && (
              <Button
                variant='outlined'
                color='error'
                startIcon={<i className='tabler-trash' />}
                onClick={() => openDeleteConfirm(Array.from(selectedIds))}
              >
                Delete selected ({selectedIds.size})
              </Button>
            )}
            {canCreate && (
              <>
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
              </>
            )}
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
      <TablePaginationComponent table={table as any} serverPagination={{ total: totalEntries }} />

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
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Location verification
                </Typography>
                <Chip
                  size='small'
                  label={viewItem.locationStatus || 'UNVERIFIED'}
                  variant='tonal'
                  className='mts-1'
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  GPS coordinates
                </Typography>
                {formatCoords(viewItem.latitude, viewItem.longitude) ? (
                  <Stack direction='row' alignItems='center' spacing={0.5} className='mts-1'>
                    <Typography>{formatCoords(viewItem.latitude, viewItem.longitude)}</Typography>
                    <IconButton
                      component='a'
                      href={mapsUrl(viewItem.latitude!, viewItem.longitude!)}
                      target='_blank'
                      rel='noopener noreferrer'
                      size='small'
                      aria-label='Open doctor location on map'
                    >
                      <i className='tabler-external-link' />
                    </IconButton>
                  </Stack>
                ) : (
                  <Typography className='mts-1'>No GPS location set</Typography>
                )}
                {canEdit ? (
                  <Button
                    size='small'
                    variant='outlined'
                    className='mts-2'
                    onClick={() => openLocationDialog(viewItem)}
                  >
                    {formatCoords(viewItem.latitude, viewItem.longitude) ? 'Edit location' : 'Set location'}
                  </Button>
                ) : null}
              </Grid>
              {typeof viewItem.latitude === 'number' && typeof viewItem.longitude === 'number' ? (
                <Grid size={{ xs: 12 }}>
                  <GeoFeatureGate feature='doctorMaps'>
                    <DoctorMapScene
                      lat={viewItem.latitude}
                      lng={viewItem.longitude}
                      name={viewItem.name}
                      height={260}
                    />
                  </GeoFeatureGate>
                </Grid>
              ) : null}
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
              <MediaUpload
                kind='DOCTOR_PHOTO'
                rounded
                value={(editItem as { imageUrl?: string | null } | null)?.imageUrl ?? null}
                onUploaded={setAssetId}
                label='Upload doctor photo'
              />
            </Grid>
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
              <Typography variant='overline' color='text.secondary'>
                GPS location
              </Typography>
              <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                Search, click the map, or drag the pin. Saved locations are marked verified for visit geo-fencing.
              </Typography>
              <GeoFeatureGate feature='doctorMaps'>
                <LocationPickerScene
                  lat={parseCoordField(form.latitude)}
                  lng={parseCoordField(form.longitude)}
                  onChange={({ lat, lng }) =>
                    setForm(p => ({ ...p, latitude: String(lat), longitude: String(lng) }))
                  }
                  height={260}
                />
              </GeoFeatureGate>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Latitude'
                type='number'
                value={form.latitude}
                helperText='Optional — decimal between -90 and 90'
                onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Longitude'
                type='number'
                value={form.longitude}
                helperText='Optional — decimal between -180 and 180'
                onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
              />
            </Grid>
            {form.latitude.trim() || form.longitude.trim() ? (
              <Grid size={{ xs: 12 }}>
                <Button
                  size='small'
                  color='secondary'
                  onClick={() => setForm(p => ({ ...p, latitude: '', longitude: '' }))}
                >
                  Clear GPS location
                </Button>
              </Grid>
            ) : null}
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
        onClose={() => {
          setConfirmOpen(false)
          setDeleteIds([])
        }}
        onConfirm={handleDelete}
        title={deleteIds.length > 1 ? `Delete ${deleteIds.length} doctors?` : 'Delete Doctor?'}
        description={
          deleteIds.length > 1
            ? `These ${deleteIds.length} doctors will be removed. You can contact support to restore them if needed.`
            : 'This doctor will be removed. You can contact support to restore it if needed.'
        }
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

      <Dialog open={locationOpen} onClose={() => !locationSaving && setLocationOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>
          {locationTarget ? `${formatCoords(locationTarget.latitude, locationTarget.longitude) ? 'Edit' : 'Set'} location — ${locationTarget.name}` : 'Doctor location'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
            Search for the clinic or hospital, click the map, or drag the pin.
          </Typography>
          <GeoFeatureGate feature='doctorMaps'>
            <LocationPickerScene
              lat={parseCoordField(locationLat)}
              lng={parseCoordField(locationLng)}
              onChange={({ lat, lng }) => {
                setLocationLat(String(lat))
                setLocationLng(String(lng))
              }}
              height={320}
            />
          </GeoFeatureGate>
          <Grid container spacing={2} className='mts-3'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Latitude'
                type='number'
                value={locationLat}
                onChange={e => setLocationLat(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Longitude'
                type='number'
                value={locationLng}
                onChange={e => setLocationLng(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            color='secondary'
            disabled={locationSaving || (!locationLat.trim() && !locationLng.trim())}
            onClick={() => {
              setLocationLat('')
              setLocationLng('')
            }}
          >
            Clear
          </Button>
          <Button onClick={() => setLocationOpen(false)} disabled={locationSaving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void saveLocation()} disabled={locationSaving}>
            {locationSaving ? 'Saving…' : 'Save location'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default DoctorListPage
