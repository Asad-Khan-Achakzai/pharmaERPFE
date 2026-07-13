'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import {
  productTaxonomyService,
  type TaxonomyKind,
  type TaxonomyNode,
  type TaxonomyTreeNode
} from '@/services/productTaxonomy.service'

const KIND_COLOR: Record<TaxonomyKind, 'primary' | 'secondary' | 'default'> = {
  THERAPY: 'primary',
  AREA: 'secondary',
  CLASS: 'default'
}

const KIND_LABEL: Record<TaxonomyKind, string> = {
  THERAPY: 'Therapy',
  AREA: 'Area',
  CLASS: 'Class'
}

const PARENT_KIND: Record<TaxonomyKind, TaxonomyKind | null> = {
  THERAPY: null,
  AREA: 'THERAPY',
  CLASS: 'AREA'
}

const CHILD_KIND: Partial<Record<TaxonomyKind, TaxonomyKind>> = {
  THERAPY: 'AREA',
  AREA: 'CLASS'
}

const matchesSearch = (n: TaxonomyTreeNode, term: string): boolean => {
  if (!term) return true
  const t = term.toLowerCase()
  if (n.name?.toLowerCase().includes(t)) return true
  if (n.code?.toLowerCase().includes(t)) return true
  return n.children.some(c => matchesSearch(c, t))
}

type ParentLookup = { _id: string; name: string; code?: string | null; kind: TaxonomyKind }

const ProductTaxonomyPage = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('productTaxonomy.manage')

  const [roots, setRoots] = useState<TaxonomyTreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<{
    open: boolean
    initial: TaxonomyNode | null
    parent: ParentLookup | null
    kind?: TaxonomyKind
  }>({ open: false, initial: null, parent: null })
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyTreeNode | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<TaxonomyKind>('THERAPY')
  const [parent, setParent] = useState<ParentLookup | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productTaxonomyService.tree()
      const body = res.data?.data ?? res.data ?? []
      setRoots(Array.isArray(body) ? body : [])
    } catch (e) {
      showApiError(e, 'Failed to load taxonomy')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!debouncedSearch) return
    const next: Record<string, boolean> = {}
    const walk = (n: TaxonomyTreeNode) => {
      if (matchesSearch(n, debouncedSearch) && n.children.length) next[n._id] = true
      n.children.forEach(walk)
    }
    roots.forEach(walk)
    setExpanded(prev => ({ ...prev, ...next }))
  }, [debouncedSearch, roots])

  const totals = useMemo(() => {
    let therapy = 0
    let area = 0
    let klass = 0
    const walk = (n: TaxonomyTreeNode) => {
      if (n.kind === 'THERAPY') therapy += 1
      else if (n.kind === 'AREA') area += 1
      else klass += 1
      n.children.forEach(walk)
    }
    roots.forEach(walk)
    return { therapy, area, klass }
  }, [roots])

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const openDialog = (opts: {
    initial?: TaxonomyNode | null
    parent?: ParentLookup | null
    kind?: TaxonomyKind
  }) => {
    const initial = opts.initial || null
    const k = initial?.kind || opts.kind || 'THERAPY'
    setKind(k)
    setName(initial?.name || '')
    setCode(initial?.code || '')
    setIsActive(initial?.isActive !== false)
    setParent(opts.parent || null)
    setDialog({
      open: true,
      initial,
      parent: opts.parent || null,
      kind: k
    })
  }

  const closeDialog = () => setDialog({ open: false, initial: null, parent: null })

  const expectedParentKind = PARENT_KIND[kind]
  const isEdit = !!dialog.initial
  const valid = name.trim() !== '' && (!expectedParentKind || !!parent)

  const fetchParents = async (search: string) => {
    if (!expectedParentKind) return []
    const res = await productTaxonomyService.lookup({ search, kind: expectedParentKind, limit: 25 })
    return (res.data?.data || []) as ParentLookup[]
  }

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    try {
      if (isEdit && dialog.initial) {
        await productTaxonomyService.update(dialog.initial._id, {
          name: name.trim(),
          code: code.trim() || null,
          parentId: expectedParentKind ? parent?._id || null : null,
          isActive
        })
        showSuccess('Taxonomy node updated')
      } else {
        await productTaxonomyService.create({
          name: name.trim(),
          code: code.trim() || null,
          kind,
          parentId: expectedParentKind ? parent?._id || null : null,
          isActive
        })
        showSuccess('Taxonomy node created')
      }
      closeDialog()
      await load()
    } catch (e) {
      showApiError(e, 'Failed to save taxonomy node')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productTaxonomyService.remove(deleteTarget._id)
      showSuccess(`${KIND_LABEL[deleteTarget.kind]} deleted`)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      showApiError(e, 'Failed to delete taxonomy node')
    } finally {
      setDeleting(false)
    }
  }

  const renderNode = (n: TaxonomyTreeNode, depth: number) => {
    if (debouncedSearch && !matchesSearch(n, debouncedSearch)) return null
    const isOpen = !!expanded[n._id] || !!debouncedSearch
    const hasChildren = n.children.length > 0
    const childKind = CHILD_KIND[n.kind]
    return (
      <Box key={n._id}>
        <Stack
          direction='row'
          alignItems='center'
          spacing={1}
          sx={{
            pl: depth * 3,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            '&:hover': { backgroundColor: 'action.hover' }
          }}
        >
          <IconButton
            size='small'
            onClick={() => hasChildren && toggle(n._id)}
            sx={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            <i className={`tabler-chevron-${isOpen ? 'down' : 'right'}`} />
          </IconButton>
          <Chip size='small' color={KIND_COLOR[n.kind]} variant='tonal' label={KIND_LABEL[n.kind]} sx={{ minWidth: 64 }} />
          <Typography fontWeight={500}>{n.name}</Typography>
          {n.code && <Chip size='small' variant='outlined' label={n.code} sx={{ fontFamily: 'monospace' }} />}
          {!n.isActive && <Chip size='small' color='warning' variant='tonal' label='Inactive' />}
          <Box sx={{ flex: 1 }} />
          <Stack direction='row' spacing={0.5}>
            {canManage && childKind && (
              <Tooltip title={`Add ${KIND_LABEL[childKind]}`}>
                <IconButton
                  size='small'
                  onClick={() =>
                    openDialog({
                      kind: childKind,
                      parent: { _id: n._id, name: n.name, code: n.code, kind: n.kind }
                    })
                  }
                >
                  <i className='tabler-plus text-textSecondary' />
                </IconButton>
              </Tooltip>
            )}
            {canManage && (
              <Tooltip title='Edit'>
                <IconButton
                  size='small'
                  onClick={() =>
                    openDialog({
                      initial: n,
                      parent: n.parentId
                        ? ({ _id: String(n.parentId), name: 'Parent', kind: PARENT_KIND[n.kind] || 'THERAPY' } as ParentLookup)
                        : null
                    })
                  }
                >
                  <i className='tabler-edit text-textSecondary' />
                </IconButton>
              </Tooltip>
            )}
            {canManage && (
              <Tooltip title='Delete'>
                <IconButton size='small' onClick={() => setDeleteTarget(n)} color='error'>
                  <i className='tabler-trash text-textSecondary' />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
        {hasChildren && (
          <Collapse in={isOpen} unmountOnExit>
            {n.children.map(c => renderNode(c, depth + 1))}
          </Collapse>
        )}
      </Box>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Product Taxonomy'
        subheader='Therapy → Area → Class. Products can link to any node.'
        action={
          canManage && (
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => openDialog({ kind: 'THERAPY' })}
            >
              Add Therapy
            </Button>
          )
        }
      />
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          justifyContent='space-between'
          sx={{ mb: 2 }}
        >
          <Stack direction='row' spacing={1.5}>
            <Chip color='primary' variant='tonal' label={`${totals.therapy} Therapies`} />
            <Chip color='secondary' variant='tonal' label={`${totals.area} Areas`} />
            <Chip variant='tonal' label={`${totals.klass} Classes`} />
          </Stack>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search by name or code…'
          />
        </Stack>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          {loading ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress size={32} />
            </Box>
          ) : roots.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>No taxonomy nodes yet.</Typography>
            </Box>
          ) : (
            roots.map(r => renderNode(r, 0))
          )}
        </Box>
      </CardContent>

      <Dialog open={dialog.open} onClose={() => (saving ? null : closeDialog())} maxWidth='sm' fullWidth>
        <DialogTitle>{isEdit ? 'Edit taxonomy node' : 'Add taxonomy node'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                select
                label='Kind'
                value={kind}
                onChange={e => {
                  const next = e.target.value as TaxonomyKind
                  setKind(next)
                  if (!PARENT_KIND[next]) setParent(null)
                }}
                disabled={isEdit}
              >
                {(Object.keys(KIND_LABEL) as TaxonomyKind[]).map(k => (
                  <MenuItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField required fullWidth label='Name' value={name} onChange={e => setName(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label='Code' value={code} onChange={e => setCode(e.target.value)} />
            </Grid>
            {expectedParentKind && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <LookupAutocomplete<ParentLookup>
                  label={`Parent ${KIND_LABEL[expectedParentKind]}`}
                  value={parent}
                  onChange={setParent}
                  fetchOptions={fetchParents}
                  required
                  getOptionLabel={o => (o.code ? `${o.name} (${o.code})` : o.name)}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
                label='Active'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving || !valid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        onConfirm={() => void handleDelete()}
        title={deleteTarget ? `Delete ${KIND_LABEL[deleteTarget.kind].toLowerCase()} "${deleteTarget.name}"?` : 'Delete?'}
        description='Blocked when the node has children or products assigned to it.'
        confirmText='Delete'
        confirmColor='error'
        loading={deleting}
      />
    </Card>
  )
}

export default ProductTaxonomyPage
