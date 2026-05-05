'use client'

import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { doctorsService } from '@/services/doctors.service'
import { territoriesService, type Territory } from '@/services/territories.service'
import { usersService } from '@/services/users.service'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  doctor: {
    _id: string
    name: string
    territoryId?: { _id: string; name: string; code?: string | null; kind: string } | string | null
    assignedRepId?: { _id: string; name: string; email: string } | string | null
    monthlyVisitTarget?: number | null
    tier?: string | null
  } | null
}

type RepLookup = { _id: string; name: string; email: string; role?: string }

const TIER_OPTIONS = ['', 'A', 'B', 'C', 'D']

const DoctorAssignDialog = ({ open, onClose, onSaved, doctor }: Props) => {
  const [territory, setTerritory] = useState<Territory | null>(null)
  const [rep, setRep] = useState<RepLookup | null>(null)
  const [target, setTarget] = useState<string>('')
  const [tier, setTier] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !doctor) return
    const t = typeof doctor.territoryId === 'object' ? doctor.territoryId : null
    const r = typeof doctor.assignedRepId === 'object' ? doctor.assignedRepId : null
    setTerritory(
      t
        ? ({
            _id: t._id,
            name: t.name,
            code: t.code,
            kind: t.kind as Territory['kind'],
            isActive: true
          } as Territory)
        : null
    )
    setRep(r ? { _id: r._id, name: r.name, email: r.email } : null)
    setTarget(doctor.monthlyVisitTarget == null ? '' : String(doctor.monthlyVisitTarget))
    setTier(doctor.tier || '')
  }, [open, doctor])

  const fetchTerritories = async (search: string) => {
    const res = await territoriesService.lookup({ search, kind: 'BRICK', limit: 25 })
    return (res.data?.data || []) as Territory[]
  }

  const fetchReps = async (search: string) => {
    const res = await usersService.assignable({ search, limit: 25 })
    return (res.data?.data || []) as RepLookup[]
  }

  const handleSave = async () => {
    if (!doctor) return
    setSaving(true)
    try {
      const targetNum = target.trim() === '' ? null : Number(target)
      if (targetNum != null && (Number.isNaN(targetNum) || targetNum < 0 || targetNum > 31)) {
        showApiError(new Error('Monthly target must be 0–31'), 'Invalid monthly target')
        setSaving(false)
        return
      }
      await doctorsService.assign(doctor._id, {
        territoryId: territory?._id || null,
        assignedRepId: rep?._id || null,
        monthlyVisitTarget: targetNum,
        tier: tier ? tier : null
      })
      showSuccess('Doctor assignment updated')
      onSaved()
      onClose()
    } catch (e) {
      showApiError(e, 'Failed to update assignment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={() => (saving ? null : onClose())} maxWidth='sm' fullWidth>
      <DialogTitle>Assign {doctor?.name}</DialogTitle>
      <DialogContent>
        <Grid container spacing={4} className='pbs-4'>
          <Grid size={{ xs: 12, sm: 6 }}>
            <LookupAutocomplete<Territory>
              value={territory}
              onChange={setTerritory}
              fetchOptions={fetchTerritories}
              label='Brick (territory)'
              getOptionLabel={t => `${t.name}${t.code ? ` (${t.code})` : ''}`}
              helperText='Optional. Used for coverage and manager rollups.'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <LookupAutocomplete<RepLookup>
              value={rep}
              onChange={setRep}
              fetchOptions={fetchReps}
              label='Assigned rep'
              getOptionLabel={u => `${u.name} <${u.email}>`}
              helperText='Optional override; otherwise inferred from territory.'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              type='number'
              label='Monthly visit target'
              value={target}
              onChange={e => setTarget(e.target.value)}
              inputProps={{ min: 0, max: 31 }}
              helperText='Number of visits expected per month (0–31).'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              select
              label='Tier'
              value={tier}
              onChange={e => setTier(e.target.value)}
              helperText='A/B/C tier influences priority sequence on the day plan.'
            >
              {TIER_OPTIONS.map(t => (
                <MenuItem key={t || 'none'} value={t}>
                  {t || '— none —'}
                </MenuItem>
              ))}
            </CustomTextField>
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
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
        >
          Save assignment
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DoctorAssignDialog
