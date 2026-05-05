'use client'

import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { territoriesService, type Territory, type TerritoryKind } from '@/services/territories.service'

type ParentLookup = { _id: string; name: string; code?: string | null; kind: TerritoryKind }

const PARENT_KIND: Record<TerritoryKind, TerritoryKind | null> = {
  ZONE: null,
  AREA: 'ZONE',
  BRICK: 'AREA'
}

const KIND_LABEL: Record<TerritoryKind, string> = {
  ZONE: 'Zone',
  AREA: 'Area',
  BRICK: 'Brick'
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  initial?: Territory | null
  /** Pre-fill a parent (used when "Add child" is clicked from the tree). */
  defaultParent?: { _id: string; name: string; kind: TerritoryKind } | null
  /** Pre-fill a kind on create (used when "Add zone" / "Add area" buttons are clicked). */
  defaultKind?: TerritoryKind
}

const TerritoryFormDialog = ({ open, onClose, onSaved, initial, defaultParent, defaultKind }: Props) => {
  const isEdit = !!initial
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<TerritoryKind>('ZONE')
  const [parent, setParent] = useState<ParentLookup | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const init = async () => {
      if (initial) {
        setName(initial.name)
        setCode(initial.code || '')
        setKind(initial.kind)
        setIsActive(initial.isActive !== false)
        setNotes(initial.notes || '')
        if (initial.parentId) {
          try {
            const res = await territoriesService.getById(String(initial.parentId))
            const p = res.data?.data || res.data
            if (!cancelled && p) {
              setParent({ _id: p._id, name: p.name, code: p.code, kind: p.kind } as ParentLookup)
            }
          } catch {
            if (!cancelled) {
              setParent({
                _id: String(initial.parentId),
                name: 'Loading…',
                kind: PARENT_KIND[initial.kind] || 'ZONE'
              } as ParentLookup)
            }
          }
        } else {
          setParent(null)
        }
      } else {
        setName('')
        setCode('')
        setKind(defaultKind || (defaultParent ? (defaultParent.kind === 'ZONE' ? 'AREA' : 'BRICK') : 'ZONE'))
        setParent(defaultParent ? ({ ...defaultParent } as ParentLookup) : null)
        setIsActive(true)
        setNotes('')
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [open, initial, defaultKind, defaultParent])

  const expectedParentKind = PARENT_KIND[kind]

  const valid = useMemo(() => {
    if (!name.trim()) return false
    if (expectedParentKind && !parent) return false
    return true
  }, [name, expectedParentKind, parent])

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        kind,
        parentId: expectedParentKind ? parent?._id || null : null,
        isActive,
        notes: notes.trim() ? notes.trim() : null
      }
      if (isEdit && initial) {
        const { kind: _omit, ...patch } = payload
        await territoriesService.update(initial._id, patch)
        showSuccess('Territory updated')
      } else {
        await territoriesService.create(payload)
        showSuccess('Territory created')
      }
      onSaved()
      onClose()
    } catch (e) {
      showApiError(e, isEdit ? 'Failed to update territory' : 'Failed to create territory')
    } finally {
      setSaving(false)
    }
  }

  const fetchParents = async (search: string) => {
    if (!expectedParentKind) return []
    const res = await territoriesService.lookup({ search, kind: expectedParentKind, limit: 25 })
    return (res.data?.data || []) as ParentLookup[]
  }

  return (
    <Dialog open={open} onClose={() => (saving ? null : onClose())} maxWidth='sm' fullWidth>
      <DialogTitle>{isEdit ? 'Edit territory' : 'Add territory'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={4} className='pbs-4'>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              required
              fullWidth
              select
              label='Kind'
              value={kind}
              onChange={e => setKind(e.target.value as TerritoryKind)}
              disabled={isEdit}
              helperText={isEdit ? 'Kind cannot be changed after creation' : 'Zones contain Areas; Areas contain Bricks'}
            >
              {(Object.keys(KIND_LABEL) as TerritoryKind[]).map(k => (
                <MenuItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </MenuItem>
              ))}
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              required
              fullWidth
              label='Name'
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              label='Code (optional)'
              value={code}
              onChange={e => setCode(e.target.value)}
              helperText='Short code, e.g. "QTA-N". Must be unique within kind.'
            />
          </Grid>
          {expectedParentKind && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <LookupAutocomplete<ParentLookup>
                value={parent}
                onChange={setParent}
                fetchOptions={fetchParents}
                label={`Parent ${KIND_LABEL[expectedParentKind]}`}
                required
                getOptionLabel={o => `${o.name}${o.code ? ` (${o.code})` : ''}`}
                helperText={`A ${KIND_LABEL[kind]} must belong to a ${KIND_LABEL[expectedParentKind]}.`}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <CustomTextField
              fullWidth
              multiline
              minRows={2}
              label='Notes (optional)'
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
              label='Active'
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant='contained'
          onClick={handleSave}
          disabled={saving || !valid}
          startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
        >
          {isEdit ? 'Save changes' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default TerritoryFormDialog
