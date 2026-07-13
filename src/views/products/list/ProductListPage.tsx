'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import Link from 'next/link'
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
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
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
import { productsService } from '@/services/products.service'
import { brandsService, type Brand } from '@/services/brands.service'
import { productTaxonomyService, type TaxonomyNode } from '@/services/productTaxonomy.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import MediaUpload from '@/components/media/MediaUpload'
import EntityImageCell from '@/components/media/EntityImageCell'
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

type BrandRef = { _id: string; name?: string; code?: string | null }
type TaxonomyRef = { _id: string; name?: string; kind?: string; code?: string | null }

type Product = {
  _id: string
  name: string
  sku?: string | null
  brandId?: BrandRef | string | null
  composition?: string
  genericName?: string | null
  strength?: string | null
  dosageForm?: string | null
  packSize?: string | null
  manufacturer?: string | null
  taxonomyNodeId?: TaxonomyRef | string | null
  description?: string | null
  indications?: string | null
  contraindications?: string | null
  dosageInstructions?: string | null
  sideEffects?: string | null
  storageInstructions?: string | null
  mrp: number
  tp: number
  casting?: number
  distributorPrice?: number | null
  isSampleEligible?: boolean
  sampleUnitLabel?: string | null
  imageUrl?: string | null
  isActive: boolean
}

type FormState = {
  name: string
  sku: string
  composition: string
  genericName: string
  strength: string
  dosageForm: string
  packSize: string
  manufacturer: string
  description: string
  indications: string
  contraindications: string
  dosageInstructions: string
  sideEffects: string
  storageInstructions: string
  mrp: number
  tp: number
  casting: number
  distributorPrice: string
  isSampleEligible: boolean
  sampleUnitLabel: string
  isActive: boolean
  brand: Brand | null
  taxonomy: TaxonomyNode | null
}

const emptyForm = (): FormState => ({
  name: '',
  sku: '',
  composition: '',
  genericName: '',
  strength: '',
  dosageForm: '',
  packSize: '',
  manufacturer: '',
  description: '',
  indications: '',
  contraindications: '',
  dosageInstructions: '',
  sideEffects: '',
  storageInstructions: '',
  mrp: 0,
  tp: 0,
  casting: 0,
  distributorPrice: '',
  isSampleEligible: false,
  sampleUnitLabel: '',
  isActive: true,
  brand: null,
  taxonomy: null
})

const columnHelper = createColumnHelper<Product>()

const ProductListPage = () => {
  const [data, setData] = useState<Product[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [assetId, setAssetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('products.create')
  const canEdit = hasPermission('products.edit')
  const canDelete = hasPermission('products.delete')
  const canViewCostPrice = hasPermission('products.viewCostPrice')

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const isFormValid =
    form.name.trim() !== '' &&
    form.mrp > 0 &&
    form.tp > 0 &&
    (canViewCostPrice ? form.casting > 0 : true)

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const { data: res } = await productsService.list(params)
      if (seq !== fetchSeq.current) return
      setData(res.data || [])
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load products')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const fetchBrands = async (search: string) => {
    const res = await brandsService.lookup({ search, limit: 25 })
    return (res.data?.data || []) as Brand[]
  }

  const fetchTaxonomy = async (search: string) => {
    const res = await productTaxonomyService.lookup({ search, limit: 25 })
    return (res.data?.data || []) as TaxonomyNode[]
  }

  const handleOpen = (item?: Product) => {
    setAssetId(null)
    if (item) {
      setEditItem(item)
      const brandRef = item.brandId
      const taxRef = item.taxonomyNodeId
      setForm({
        name: item.name,
        sku: item.sku || '',
        composition: item.composition || '',
        genericName: item.genericName || '',
        strength: item.strength || '',
        dosageForm: item.dosageForm || '',
        packSize: item.packSize || '',
        manufacturer: item.manufacturer || '',
        description: item.description || '',
        indications: item.indications || '',
        contraindications: item.contraindications || '',
        dosageInstructions: item.dosageInstructions || '',
        sideEffects: item.sideEffects || '',
        storageInstructions: item.storageInstructions || '',
        mrp: item.mrp,
        tp: item.tp,
        casting: canViewCostPrice ? (item.casting ?? 0) : 0,
        distributorPrice: item.distributorPrice != null ? String(item.distributorPrice) : '',
        isSampleEligible: !!item.isSampleEligible,
        sampleUnitLabel: item.sampleUnitLabel || '',
        isActive: item.isActive !== false,
        brand:
          brandRef && typeof brandRef === 'object'
            ? ({ _id: brandRef._id, name: brandRef.name || '', code: brandRef.code, isActive: true } as Brand)
            : null,
        taxonomy:
          taxRef && typeof taxRef === 'object'
            ? ({
                _id: taxRef._id,
                name: taxRef.name || '',
                kind: (taxRef.kind as TaxonomyNode['kind']) || 'CLASS',
                code: taxRef.code,
                isActive: true
              } as TaxonomyNode)
            : null
      })
    } else {
      setEditItem(null)
      setForm(emptyForm())
    }
    setOpen(true)
  }

  const buildBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      composition: form.composition,
      genericName: form.genericName.trim() || null,
      strength: form.strength.trim() || null,
      dosageForm: form.dosageForm.trim() || null,
      packSize: form.packSize.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      brandId: form.brand?._id || null,
      taxonomyNodeId: form.taxonomy?._id || null,
      description: form.description.trim() || null,
      indications: form.indications.trim() || null,
      contraindications: form.contraindications.trim() || null,
      dosageInstructions: form.dosageInstructions.trim() || null,
      sideEffects: form.sideEffects.trim() || null,
      storageInstructions: form.storageInstructions.trim() || null,
      mrp: form.mrp,
      tp: form.tp,
      distributorPrice: form.distributorPrice.trim() === '' ? null : Number(form.distributorPrice),
      isSampleEligible: form.isSampleEligible,
      sampleUnitLabel: form.sampleUnitLabel.trim() || null,
      isActive: form.isActive
    }
    if (canViewCostPrice) body.casting = form.casting
    else if (!editItem) body.casting = 0
    if (assetId) body.assetId = assetId
    return body
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = buildBody()
      if (editItem) {
        await productsService.update(editItem._id, body)
        showSuccess('Product updated')
      } else {
        await productsService.create(body)
        showSuccess('Product created')
      }
      setOpen(false)
      fetchData()
    } catch (err: any) {
      showApiError(err, 'Error saving product')
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
      await productsService.remove(deleteId)
      showSuccess('Product deleted successfully')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting product')
    } finally {
      setDeleting(false)
    }
  }, [deleteId, fetchData])

  const columns = useMemo<ColumnDef<Product, any>[]>(() => {
    const base: ColumnDef<Product, any>[] = [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <Stack direction='row' alignItems='center' spacing={1.5}>
            <EntityImageCell url={row.original.imageUrl} name={row.original.name} rounded={false} />
            <Typography
              component={Link}
              href={`/products/${row.original._id}`}
              fontWeight={500}
              sx={{ textDecoration: 'none', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            >
              {row.original.name}
            </Typography>
          </Stack>
        )
      }),
      columnHelper.accessor('sku', {
        header: 'SKU',
        cell: ({ row }) => row.original.sku || '—'
      }),
      columnHelper.accessor('mrp', { header: 'MRP', cell: ({ row }) => `₨ ${row.original.mrp?.toFixed(2)}` }),
      columnHelper.accessor('tp', { header: 'TP', cell: ({ row }) => `₨ ${row.original.tp?.toFixed(2)}` })
    ]
    if (canViewCostPrice) {
      base.push(
        columnHelper.accessor('casting', {
          header: 'Standard Cost (Catalog)',
          cell: ({ row }) => `₨ ${row.original.casting != null ? row.original.casting.toFixed(2) : '—'}`
        })
      )
    }
    base.push(
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex gap-1'>
            <IconButton size='small' component={Link} href={`/products/${row.original._id}`}>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
            {canEdit && (
              <IconButton size='small' onClick={() => handleOpen(row.original)}>
                <i className='tabler-edit text-textSecondary' />
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
    )
    return base
  }, [canEdit, canDelete, canViewCostPrice])

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
      <CardHeader title='Products' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search name, composition…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
        {canCreate && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>
            Add Product
          </Button>
        )}
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter products'
          description='Narrow the catalog by when the product was added and who created it.'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the product record.'
          datePickerId='product-list-date-range-picker-months'
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
                  No products found
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
        <DialogTitle>{editItem ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <MediaUpload
                kind='PRODUCT_VISUAL'
                value={editItem?.imageUrl ?? null}
                onUploaded={setAssetId}
                label='Upload product image'
              />
            </Grid>
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
                label='SKU'
                value={form.sku}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <LookupAutocomplete<Brand>
                label='Brand'
                value={form.brand}
                onChange={v => setForm(p => ({ ...p, brand: v }))}
                fetchOptions={fetchBrands}
                getOptionLabel={o => (o.code ? `${o.name} (${o.code})` : o.name)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <LookupAutocomplete<TaxonomyNode>
                label='Taxonomy'
                value={form.taxonomy}
                onChange={v => setForm(p => ({ ...p, taxonomy: v }))}
                fetchOptions={fetchTaxonomy}
                getOptionLabel={o => `${o.name}${o.kind ? ` · ${o.kind}` : ''}`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Generic name'
                value={form.genericName}
                onChange={e => setForm(p => ({ ...p, genericName: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Composition'
                value={form.composition}
                onChange={e => setForm(p => ({ ...p, composition: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                label='Strength'
                value={form.strength}
                onChange={e => setForm(p => ({ ...p, strength: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                label='Dosage form'
                value={form.dosageForm}
                onChange={e => setForm(p => ({ ...p, dosageForm: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                label='Pack size'
                value={form.packSize}
                onChange={e => setForm(p => ({ ...p, packSize: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Manufacturer'
                value={form.manufacturer}
                onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))}
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
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                multiline
                minRows={2}
                label='Indications'
                value={form.indications}
                onChange={e => setForm(p => ({ ...p, indications: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                multiline
                minRows={2}
                label='Contraindications'
                value={form.contraindications}
                onChange={e => setForm(p => ({ ...p, contraindications: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                multiline
                minRows={2}
                label='Dosage instructions'
                value={form.dosageInstructions}
                onChange={e => setForm(p => ({ ...p, dosageInstructions: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                multiline
                minRows={2}
                label='Side effects'
                value={form.sideEffects}
                onChange={e => setForm(p => ({ ...p, sideEffects: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Storage instructions'
                value={form.storageInstructions}
                onChange={e => setForm(p => ({ ...p, storageInstructions: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <CustomTextField
                required
                fullWidth
                label='MRP'
                type='number'
                value={form.mrp}
                onChange={e => setForm(p => ({ ...p, mrp: +e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <CustomTextField
                required
                fullWidth
                label='TP'
                type='number'
                value={form.tp}
                onChange={e => setForm(p => ({ ...p, tp: +e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <CustomTextField
                fullWidth
                label='Distributor price'
                type='number'
                value={form.distributorPrice}
                onChange={e => setForm(p => ({ ...p, distributorPrice: e.target.value }))}
              />
            </Grid>
            {canViewCostPrice && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField
                  required
                  fullWidth
                  label='Standard Cost (Catalog)'
                  type='number'
                  value={form.casting}
                  onChange={e => setForm(p => ({ ...p, casting: +e.target.value }))}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Sample unit label'
                value={form.sampleUnitLabel}
                onChange={e => setForm(p => ({ ...p, sampleUnitLabel: e.target.value }))}
                disabled={!form.isSampleEligible}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isSampleEligible}
                    onChange={e => setForm(p => ({ ...p, isSampleEligible: e.target.checked }))}
                  />
                }
                label='Sample eligible'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
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
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Product?'
        description='This product will be removed. You can contact support to restore it if needed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default ProductListPage
