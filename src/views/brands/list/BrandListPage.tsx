'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'

import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { brandsService, type Brand } from '@/services/brands.service'
import { normalizeDocs } from '@/utils/apiList'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'

import tableStyles from '@core/styles/table.module.css'

const columnHelper = createColumnHelper<Brand>()

type FormState = {
  name: string
  code: string
  description: string
  isActive: boolean
}

const emptyForm = (): FormState => ({ name: '', code: '', description: '', isActive: true })

const BrandListPage = () => {
  const [data, setData] = useState<Brand[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Brand | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<Brand | null>(null)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('brands.create')
  const canEdit = hasPermission('brands.edit')
  const canDelete = hasPermission('brands.delete')

  const isFormValid = form.name.trim() !== ''

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      if (debouncedSearch) params.search = debouncedSearch
      const res = await brandsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(normalizeDocs<Brand>(res))
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load brands')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleOpen = (item?: Brand) => {
    if (item) {
      setEditItem(item)
      setForm({
        name: item.name,
        code: item.code || '',
        description: item.description || '',
        isActive: item.isActive !== false
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
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive
      }
      if (editItem) {
        await brandsService.update(editItem._id, body)
        showSuccess('Brand updated')
      } else {
        await brandsService.create(body)
        showSuccess('Brand created')
      }
      setOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error saving brand')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await brandsService.remove(deleteId)
      showSuccess('Brand deleted')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting brand')
    } finally {
      setDeleting(false)
    }
  }, [deleteId, fetchData])

  const columns = useMemo<ColumnDef<Brand, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography>
      }),
      columnHelper.accessor('code', {
        header: 'Code',
        cell: ({ row }) => row.original.code || '—'
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
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex gap-1'>
            <IconButton size='small' onClick={() => setViewItem(row.original)}>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
            {canEdit && (
              <IconButton size='small' onClick={() => handleOpen(row.original)}>
                <i className='tabler-edit text-textSecondary' />
              </IconButton>
            )}
            {canDelete && (
              <IconButton
                size='small'
                onClick={() => {
                  setDeleteId(row.original._id)
                  setConfirmOpen(true)
                }}
              >
                <i className='tabler-trash text-textSecondary' />
              </IconButton>
            )}
          </div>
        )
      })
    ],
    [canEdit, canDelete]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Brands' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <TableListSearchField
          value={searchInput}
          onChange={setSearchInput}
          onClear={clearSearch}
          placeholder='Search brands…'
        />
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>
            Add Brand
          </Button>
        )}
      </div>

      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
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
                  No brands found
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
        <DialogTitle>{editItem ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                required
                fullWidth
                label='Name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Code'
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                multiline
                minRows={2}
                label='Description'
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
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
                label='Active'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Brand Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Name
                </Typography>
                <Typography fontWeight={500}>{viewItem.name}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Code
                </Typography>
                <Typography>{viewItem.code || '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Description
                </Typography>
                <Typography>{viewItem.description || '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Status
                </Typography>
                <Typography>{viewItem.isActive ? 'Active' : 'Inactive'}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Brand?'
        description='This brand will be removed from the catalog.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default BrandListPage
