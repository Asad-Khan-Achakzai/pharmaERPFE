'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import {
  TableListSearchField,
  useDebouncedSearch
} from '@/components/standard-list-toolbar'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import {
  territoriesService,
  type Territory,
  type TerritoryKind,
  type TerritoryNode
} from '@/services/territories.service'
import TerritoryFormDialog from './TerritoryFormDialog'
import TerritoryBulkImportDialog from './TerritoryBulkImportDialog'

const KIND_COLOR: Record<TerritoryKind, 'primary' | 'secondary' | 'default'> = {
  ZONE: 'primary',
  AREA: 'secondary',
  BRICK: 'default'
}

const KIND_LABEL: Record<TerritoryKind, string> = {
  ZONE: 'Zone',
  AREA: 'Area',
  BRICK: 'Brick'
}

const matchesSearch = (n: TerritoryNode, term: string): boolean => {
  if (!term) return true
  const t = term.toLowerCase()
  if (n.name?.toLowerCase().includes(t)) return true
  if (n.code?.toLowerCase().includes(t)) return true
  return n.children.some(c => matchesSearch(c, t))
}

const TerritoriesPage = () => {
  const { hasPermission } = useAuth()
  const searchParams = useSearchParams()
  const searchFromUrl = searchParams.get('search')
  const canManage = hasPermission('territories.manage')

  const [roots, setRoots] = useState<TerritoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<{
    open: boolean
    initial: Territory | null
    parent: { _id: string; name: string; kind: TerritoryKind } | null
    kind?: TerritoryKind
  }>({ open: false, initial: null, parent: null })
  const [deleteTarget, setDeleteTarget] = useState<TerritoryNode | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()

  useEffect(() => {
    const q = searchFromUrl?.trim()
    if (q) setSearchInput(q)
  }, [searchFromUrl, setSearchInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await territoriesService.tree()
      const body = res.data?.data || res.data || { roots: [], total: 0 }
      setRoots((body as { roots?: TerritoryNode[] }).roots || [])
    } catch (e) {
      showApiError(e, 'Failed to load territories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Auto-expand zones that contain a search match. */
  useEffect(() => {
    if (!debouncedSearch) return
    const next: Record<string, boolean> = {}
    const walk = (n: TerritoryNode) => {
      if (matchesSearch(n, debouncedSearch) && n.children.length) next[n._id] = true
      n.children.forEach(walk)
    }
    roots.forEach(walk)
    setExpanded(prev => ({ ...prev, ...next }))
  }, [debouncedSearch, roots])

  const totals = useMemo(() => {
    let zones = 0
    let areas = 0
    let bricks = 0
    const walk = (n: TerritoryNode) => {
      if (n.kind === 'ZONE') zones += 1
      else if (n.kind === 'AREA') areas += 1
      else if (n.kind === 'BRICK') bricks += 1
      n.children.forEach(walk)
    }
    roots.forEach(walk)
    return { zones, areas, bricks }
  }, [roots])

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const openAddZone = () => setDialog({ open: true, initial: null, parent: null, kind: 'ZONE' })
  const openAddChild = (parent: TerritoryNode) =>
    setDialog({
      open: true,
      initial: null,
      parent: { _id: parent._id, name: parent.name, kind: parent.kind },
      kind: parent.kind === 'ZONE' ? 'AREA' : 'BRICK'
    })
  const openEdit = (n: TerritoryNode) =>
    setDialog({ open: true, initial: n, parent: null })
  const closeDialog = () => setDialog({ open: false, initial: null, parent: null })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await territoriesService.remove(deleteTarget._id)
      showSuccess(`${KIND_LABEL[deleteTarget.kind]} deleted`)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      showApiError(e, 'Failed to delete territory')
    } finally {
      setDeleting(false)
    }
  }

  const renderNode = (n: TerritoryNode, depth: number) => {
    if (debouncedSearch && !matchesSearch(n, debouncedSearch)) return null
    const isOpen = !!expanded[n._id] || !!debouncedSearch
    const hasChildren = n.children.length > 0
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
          <Chip size='small' color={KIND_COLOR[n.kind]} variant='tonal' label={KIND_LABEL[n.kind]} sx={{ minWidth: 56 }} />
          <Typography fontWeight={500}>{n.name}</Typography>
          {n.code && (
            <Chip
              size='small'
              variant='outlined'
              label={n.code}
              sx={{ fontFamily: 'monospace' }}
            />
          )}
          {!n.isActive && <Chip size='small' color='warning' variant='tonal' label='Inactive' />}
          <Box sx={{ flex: 1 }} />
          <Stack direction='row' spacing={0.5}>
            {canManage && n.kind !== 'BRICK' && (
              <Tooltip title={`Add ${n.kind === 'ZONE' ? 'Area' : 'Brick'}`}>
                <IconButton size='small' onClick={() => openAddChild(n)}>
                  <i className='tabler-plus text-textSecondary' />
                </IconButton>
              </Tooltip>
            )}
            {canManage && (
              <Tooltip title='Edit'>
                <IconButton size='small' onClick={() => openEdit(n)}>
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
        title='Territories'
        subheader='Zones contain Areas; Areas contain Bricks. Doctors and Pharmacies can be assigned to a Brick.'
        action={
          canManage && (
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
              <Button variant='tonal' startIcon={<i className='tabler-file-upload' />} onClick={() => setImportOpen(true)}>
                Import Excel
              </Button>
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openAddZone}>
                Add Zone
              </Button>
            </Stack>
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
            <Chip color='primary' variant='tonal' label={`${totals.zones} Zones`} />
            <Chip color='secondary' variant='tonal' label={`${totals.areas} Areas`} />
            <Chip variant='tonal' label={`${totals.bricks} Bricks`} />
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
              <Typography>No territories yet.</Typography>
              {canManage && (
                <Button onClick={openAddZone} variant='outlined' sx={{ mt: 2 }} startIcon={<i className='tabler-plus' />}>
                  Add your first Zone
                </Button>
              )}
            </Box>
          ) : (
            roots.map(r => renderNode(r, 0))
          )}
        </Box>
      </CardContent>

      <TerritoryFormDialog
        open={dialog.open}
        onClose={closeDialog}
        onSaved={load}
        initial={dialog.initial}
        defaultParent={dialog.parent}
        defaultKind={dialog.kind}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        onConfirm={() => void handleDelete()}
        title={deleteTarget ? `Delete ${KIND_LABEL[deleteTarget.kind].toLowerCase()} "${deleteTarget.name}"?` : 'Delete?'}
        description='This is blocked when there are child territories or assigned users / doctors / pharmacies.'
        confirmText='Delete'
        confirmColor='error'
        icon='tabler-trash'
        loading={deleting}
      />

      <TerritoryBulkImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
    </Card>
  )
}

export default TerritoriesPage
