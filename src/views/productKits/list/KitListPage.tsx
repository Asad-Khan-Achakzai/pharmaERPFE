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
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import TablePaginationComponent from '@components/TablePaginationComponent'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { productKitsService, type ProductKit } from '@/services/productKits.service'
import { productsService } from '@/services/products.service'
import { normalizeDocs } from '@/utils/apiList'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'

import tableStyles from '@core/styles/table.module.css'

type ProductOpt = { _id: string; name: string }

const columnHelper = createColumnHelper<ProductKit>()

type FormState = {
  name: string
  code: string
  description: string
  sortOrder: number
  isActive: boolean
  products: ProductOpt[]
}

const emptyForm = (): FormState => ({
  name: '',
  code: '',
  description: '',
  sortOrder: 0,
  isActive: true,
  products: []
})

const KitListPage = () => {
  const [data, setData] = useState<ProductKit[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<ProductKit | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [productOptions, setProductOptions] = useState<ProductOpt[]>([])
  const [productInput, setProductInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('kits.create')
  const canEdit = hasPermission('kits.edit')
  const canDelete = hasPermission('kits.delete')

  const isFormValid = form.name.trim() !== '' && form.products.length >= 2

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      if (debouncedSearch) params.search = debouncedSearch
      const res = await productKitsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(normalizeDocs<ProductKit>(res))
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load kits')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const res = await productsService.lookup({ search: productInput.trim(), limit: 25 })
        const rows = (res.data?.data || []) as ProductOpt[]
        if (!cancelled) setProductOptions(rows)
      } catch {
        /* ignore */
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [productInput])

  const handleOpen = async (item?: ProductKit) => {
    if (item) {
      setEditItem(item)
      const ids = (item.productIds || []).map(String)
      let products: ProductOpt[] = []
      if (ids.length) {
        try {
          const res = await productsService.lookup({ limit: 100 })
          const all = (res.data?.data || []) as ProductOpt[]
          products = ids.map(id => all.find(p => p._id === id) || { _id: id, name: id })
        } catch {
          products = ids.map(id => ({ _id: id, name: id }))
        }
      }
      setForm({
        name: item.name,
        code: item.code || '',
        description: item.description || '',
        sortOrder: item.sortOrder ?? 0,
        isActive: item.isActive !== false,
        products
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
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        productIds: form.products.map(p => p._id)
      }
      if (editItem) {
        await productKitsService.update(editItem._id, body)
        showSuccess('Kit updated')
      } else {
        await productKitsService.create(body)
        showSuccess('Kit created')
      }
      setOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error saving kit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await productKitsService.remove(deleteId)
      showSuccess('Kit deleted')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting kit')
    } finally {
      setDeleting(false)
    }
  }, [deleteId, fetchData])

  const columns = useMemo<ColumnDef<ProductKit, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography>
      }),
      columnHelper.accessor('code', {
        header: 'Code',
        cell: ({ row }) => row.original.code || '—'
      }),
      columnHelper.accessor('productIds', {
        header: 'Products',
        cell: ({ row }) => row.original.productIds?.length ?? 0
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
            {canEdit && (
              <IconButton size='small' onClick={() => void handleOpen(row.original)}>
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
      <CardHeader title='Product Kits' subheader='Bundles of at least 2 products for visit detailing.' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <TableListSearchField
          value={searchInput}
          onChange={setSearchInput}
          onClear={clearSearch}
          placeholder='Search kits…'
        />
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => void handleOpen()}>
            Add Kit
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
                  No kits found
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
        <DialogTitle>{editItem ? 'Edit Kit' : 'Add Kit'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
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
              <CustomAutocomplete
                multiple
                fullWidth
                options={productOptions}
                value={form.products}
                onChange={(_e, v) => setForm(p => ({ ...p, products: v }))}
                inputValue={productInput}
                onInputChange={(_e, v) => setProductInput(v)}
                getOptionLabel={o => o.name || o._id}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                renderInput={params => (
                  <CustomTextField
                    {...params}
                    label='Products (min 2)'
                    placeholder='Search products…'
                    helperText={`${form.products.length} selected`}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Sort order'
                value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: +e.target.value }))}
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

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Kit?'
        description='This kit will be removed from the catalog.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default KitListPage
