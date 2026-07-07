'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
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

import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { callPointsService, type CallPoint } from '@/services/callPoints.service'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'

import tableStyles from '@core/styles/table.module.css'
import { GeoFeatureGate } from '@/geo/GeoPlatformProvider'
import { LocationPickerScene } from '@/geo/scenes/LocationPickerScene'
import { CallPointsMapScene } from '@/geo/scenes/CallPointsMapScene'

const columnHelper = createColumnHelper<CallPoint>()

type FormState = { name: string; latitude: string; longitude: string; isActive: boolean }

const emptyForm = (): FormState => ({ name: '', latitude: '', longitude: '', isActive: true })

const isValidCoord = (raw: string, kind: 'lat' | 'lng') => {
  if (raw.trim() === '') return false
  const n = Number(raw)
  if (!Number.isFinite(n)) return false
  return kind === 'lat' ? n >= -90 && n <= 90 : n >= -180 && n <= 180
}

const CallPointsPage = () => {
  const [data, setData] = useState<CallPoint[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<CallPoint | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('callPoints.create')
  const canEdit = hasPermission('callPoints.edit')
  const canDelete = hasPermission('callPoints.delete')

  const latError = form.latitude.trim() !== '' && !isValidCoord(form.latitude, 'lat')
  const lngError = form.longitude.trim() !== '' && !isValidCoord(form.longitude, 'lng')
  const isFormValid =
    form.name.trim() !== '' && isValidCoord(form.latitude, 'lat') && isValidCoord(form.longitude, 'lng')

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      if (debouncedSearch) params.search = debouncedSearch
      const { data: res } = await callPointsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(res.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load CPs')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleOpen = (item?: CallPoint) => {
    if (item) {
      setEditItem(item)
      setForm({
        name: item.name,
        latitude: String(item.latitude),
        longitude: String(item.longitude),
        isActive: item.isActive
      })
    } else {
      setEditItem(null)
      setForm(emptyForm())
    }
    setOpen(true)
  }

  const handleSave = async () => {
    if (!isFormValid) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        isActive: form.isActive
      }
      if (editItem) {
        await callPointsService.update(editItem._id, body)
        showSuccess('CP updated')
      } else {
        await callPointsService.create(body)
        showSuccess('CP created')
      }
      setOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error saving CP')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (item: CallPoint) => {
    setTogglingId(item._id)
    try {
      await callPointsService.update(item._id, { isActive: !item.isActive })
      showSuccess(item.isActive ? 'CP deactivated' : 'CP activated')
      fetchData()
    } catch (err) {
      showApiError(err, 'Could not update status')
    } finally {
      setTogglingId(null)
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
      await callPointsService.remove(deleteId)
      showSuccess('CP deleted')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting CP')
    } finally {
      setDeleting(false)
    }
  }, [deleteId])

  const columns = useMemo<ColumnDef<CallPoint, any>[]>(() => {
    const base: ColumnDef<CallPoint, any>[] = [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography>
      }),
      columnHelper.accessor('latitude', {
        header: 'Latitude',
        cell: ({ row }) => row.original.latitude
      }),
      columnHelper.accessor('longitude', {
        header: 'Longitude',
        cell: ({ row }) => row.original.longitude
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            label={row.original.isActive ? 'Active' : 'Inactive'}
            color={row.original.isActive ? 'success' : 'default'}
            size='small'
            variant='tonal'
          />
        )
      }),
      columnHelper.accessor('createdAt', {
        header: 'Created Date',
        cell: ({ row }) =>
          row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : '-'
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex gap-1'>
            {canEdit && (
              <Tooltip title='Edit'>
                <IconButton size='small' onClick={() => handleOpen(row.original)}>
                  <i className='tabler-edit text-textSecondary' />
                </IconButton>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title={row.original.isActive ? 'Deactivate' : 'Activate'}>
                <span>
                  <IconButton
                    size='small'
                    disabled={togglingId === row.original._id}
                    onClick={() => handleToggleActive(row.original)}
                  >
                    <i
                      className={
                        row.original.isActive
                          ? 'tabler-toggle-right text-success'
                          : 'tabler-toggle-left text-textSecondary'
                      }
                    />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title='Delete'>
                <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}>
                  <i className='tabler-trash text-textSecondary' />
                </IconButton>
              </Tooltip>
            )}
          </div>
        )
      })
    ]
    return base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, canDelete, togglingId])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Call Points (CP)' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search by name…'
          />
        </Stack>
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>
            Add CP
          </Button>
        )}
      </div>

      <GeoFeatureGate feature='callPointMaps'>
        <div className='pli-6 pbe-4'>
          <Typography variant='subtitle2' className='mbe-2'>
            Coverage map
          </Typography>
          <CallPointsMapScene height={280} />
        </div>
      </GeoFeatureGate>

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
            {loading ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  No CPs found
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editItem ? 'Edit CP' : 'Add CP'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                required
                fullWidth
                label='CP Name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <GeoFeatureGate feature='callPointMaps'>
                <LocationPickerScene
                  lat={form.latitude.trim() === '' ? null : Number(form.latitude)}
                  lng={form.longitude.trim() === '' ? null : Number(form.longitude)}
                  onChange={({ lat, lng }) =>
                    setForm(p => ({ ...p, latitude: String(lat), longitude: String(lng) }))
                  }
                  height={260}
                />
              </GeoFeatureGate>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Latitude'
                type='number'
                value={form.latitude}
                error={latError}
                helperText={latError ? 'Must be a decimal between -90 and 90' : 'e.g. 31.520370'}
                onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Longitude'
                type='number'
                value={form.longitude}
                error={lngError}
                helperText={lngError ? 'Must be a decimal between -180 and 180' : 'e.g. 74.358749'}
                onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  />
                }
                label={form.isActive ? 'Active' : 'Inactive'}
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
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete CP?'
        description='This CP will be removed. CPs referenced by a weekly plan cannot be deleted.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default CallPointsPage
