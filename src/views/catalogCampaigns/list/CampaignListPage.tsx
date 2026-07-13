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
import MenuItem from '@mui/material/MenuItem'
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
import {
  catalogCampaignsService,
  type CampaignType,
  type CatalogCampaign
} from '@/services/catalogCampaigns.service'
import { productsService } from '@/services/products.service'
import { normalizeDocs } from '@/utils/apiList'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'

import tableStyles from '@core/styles/table.module.css'

type ProductOpt = { _id: string; name: string }

const CAMPAIGN_TYPES: CampaignType[] = ['FEATURED', 'NEW_LAUNCH', 'SEASONAL', 'COLLECTION', 'CUSTOM']

const columnHelper = createColumnHelper<CatalogCampaign>()

type FormState = {
  name: string
  code: string
  type: CampaignType
  description: string
  startAt: string
  endAt: string
  sortOrder: number
  isActive: boolean
  products: ProductOpt[]
}

const emptyForm = (): FormState => ({
  name: '',
  code: '',
  type: 'FEATURED',
  description: '',
  startAt: '',
  endAt: '',
  sortOrder: 0,
  isActive: true,
  products: []
})

const CampaignListPage = () => {
  const [data, setData] = useState<CatalogCampaign[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<CatalogCampaign | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [productOptions, setProductOptions] = useState<ProductOpt[]>([])
  const [productInput, setProductInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('campaigns.create')
  const canEdit = hasPermission('campaigns.edit')
  const canDelete = hasPermission('campaigns.delete')

  const isFormValid = form.name.trim() !== ''

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      if (debouncedSearch) params.search = debouncedSearch
      const res = await catalogCampaignsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(normalizeDocs<CatalogCampaign>(res))
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load campaigns')
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
        /* ignore lookup errors while typing */
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [productInput])

  const handleOpen = async (item?: CatalogCampaign) => {
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
        type: item.type || 'FEATURED',
        description: item.description || '',
        startAt: item.startAt ? item.startAt.slice(0, 10) : '',
        endAt: item.endAt ? item.endAt.slice(0, 10) : '',
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
        type: form.type,
        description: form.description.trim() || null,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        productIds: form.products.map(p => p._id)
      }
      if (editItem) {
        await catalogCampaignsService.update(editItem._id, body)
        showSuccess('Campaign updated')
      } else {
        await catalogCampaignsService.create(body)
        showSuccess('Campaign created')
      }
      setOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error saving campaign')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await catalogCampaignsService.remove(deleteId)
      showSuccess('Campaign deleted')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting campaign')
    } finally {
      setDeleting(false)
    }
  }, [deleteId, fetchData])

  const columns = useMemo<ColumnDef<CatalogCampaign, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography>
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: ({ row }) => <Chip size='small' variant='tonal' label={row.original.type} />
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
      <CardHeader title='Catalog Campaigns' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <TableListSearchField
          value={searchInput}
          onChange={setSearchInput}
          onClear={clearSearch}
          placeholder='Search campaigns…'
        />
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => void handleOpen()}>
            Add Campaign
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
                  No campaigns found
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
        <DialogTitle>{editItem ? 'Edit Campaign' : 'Add Campaign'}</DialogTitle>
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                fullWidth
                label='Type'
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as CampaignType }))}
              >
                {CAMPAIGN_TYPES.map(t => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </CustomTextField>
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='date'
                label='Start date'
                InputLabelProps={{ shrink: true }}
                value={form.startAt}
                onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='date'
                label='End date'
                InputLabelProps={{ shrink: true }}
                value={form.endAt}
                onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))}
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
                renderInput={params => <CustomTextField {...params} label='Products' placeholder='Search products…' />}
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
        title='Delete Campaign?'
        description='This campaign will be removed from the catalog.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default CampaignListPage
