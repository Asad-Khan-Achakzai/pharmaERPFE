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
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { useAuth } from '@/contexts/AuthContext'
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
  /**
   * When set (e.g. from `/doctors/list?assignedRepId=`), brick + rep options are limited
   * to that person's reporting-subtree footprint — same ownership model as the doctors list.
   */
  scopeRepId?: string | null
}

type RepLookup = { _id: string; name: string; email: string; role?: string; roleCode?: string | null }

const TIER_OPTIONS = ['', 'A', 'B', 'C', 'D']
const MREP_CODE = 'DEFAULT_MEDICAL_REP'

const DoctorAssignDialog = ({ open, onClose, onSaved, doctor, scopeRepId }: Props) => {
  const { user, hasPermission } = useAuth()
  const isTenantWide = hasPermission('admin.access')
  const [territory, setTerritory] = useState<Territory | null>(null)
  const [rep, setRep] = useState<RepLookup | null>(null)
  const [target, setTarget] = useState<string>('')
  const [tier, setTier] = useState<string>('')
  const [saving, setSaving] = useState(false)

  /** Prefer URL/org-chart scope; else managers use their own id; admins leave open unless scoped. */
  const footprintUserId =
    (scopeRepId && /^[a-f0-9]{24}$/i.test(scopeRepId) ? scopeRepId : null) ||
    (!isTenantWide && user?._id ? String(user._id) : null)

  const ownershipLabel = !doctor
    ? ''
    : doctor.assignedRepId && (typeof doctor.assignedRepId === 'object' || typeof doctor.assignedRepId === 'string')
      ? 'Assigned rep'
      : doctor.territoryId && (typeof doctor.territoryId === 'object' || typeof doctor.territoryId === 'string')
        ? 'Territory-inferred'
        : 'Unassigned'

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
    const res = await territoriesService.lookup({
      search,
      kind: 'BRICK',
      limit: 25,
      ...(footprintUserId ? { underUserId: footprintUserId } : {})
    })
    return (res.data?.data || []) as Territory[]
  }

  const fetchReps = async (search: string) => {
    if (footprintUserId) {
      // Team roster under the scoped manager (or caller): same subtree as doctors ownership.
      const res = await usersService.team({
        managerId: footprintUserId,
        includeSelf: true,
        search: search || undefined
      })
      const body = res.data?.data || res.data
      const docs = ((body as { docs?: Array<Record<string, unknown>> })?.docs || []) as Array<{
        _id: string
        name: string
        email: string
        roleId?: { code?: string; name?: string } | null
      }>
      return docs
        .filter(u => u.roleId?.code === MREP_CODE)
        .map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.roleId?.name,
          roleCode: u.roleId?.code ?? null
        })) as RepLookup[]
    }
    const res = await usersService.assignable({ search, limit: 25, scope: 'team' })
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
      <DialogTitle>
        <span className='flex flex-wrap items-center gap-2'>
          Assign {doctor?.name}
          {doctor && ownershipLabel ? (
            <Chip size='small' variant='outlined' label={`Ownership: ${ownershipLabel}`} />
          ) : null}
        </span>
      </DialogTitle>
      <DialogContent>
        {doctor ? (
          <Typography variant='caption' color='text.secondary' display='block' className='pbs-1 pbe-2'>
            Brick options are limited to the team footprint
            {footprintUserId ? ' (this person / your reporting tree)' : ''}. Assigned rep overrides territory for
            coverage — clear the rep to rely on brick inference only.
          </Typography>
        ) : null}
        <Grid container spacing={4} className='pbs-4'>
          <Grid size={{ xs: 12, sm: 6 }}>
            <LookupAutocomplete<Territory>
              value={territory}
              onChange={setTerritory}
              fetchOptions={fetchTerritories}
              label='Brick (territory)'
              getOptionLabel={t => `${t.name}${t.code ? ` (${t.code})` : ''}`}
              helperText={
                footprintUserId
                  ? 'Bricks in this team’s territory footprint (MRep brick / ASM areas / RM zones).'
                  : 'Optional. Used for coverage and manager rollups.'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <LookupAutocomplete<RepLookup>
              value={rep}
              onChange={setRep}
              fetchOptions={fetchReps}
              label='Assigned rep'
              getOptionLabel={u => `${u.name} <${u.email}>`}
              helperText={
                footprintUserId
                  ? 'MReps in this reporting subtree. Optional override; otherwise inferred from brick.'
                  : 'Optional override; otherwise inferred from territory.'
              }
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
