'use client'

import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CustomTextField from '@core/components/mui/TextField'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { doctorsService } from '@/services/doctors.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import {
  type DoctorLookupOption,
  doctorLookupOptionLabel,
  renderDoctorLookupOption
} from '@/components/lookup/doctorLookupDisplay'

export type CheckInPolicyType =
  | 'COMPANY_DEFAULT'
  | 'FIRST_PLANNED_VISIT'
  | 'SPECIFIC_DOCTOR'
  | 'CUSTOM_LOCATION'

export type CheckInConfiguration = {
  policyType: CheckInPolicyType
  doctorId?: string | null
  customLocation?: {
    locationName: string
    latitude: number
    longitude: number
    radiusMeters: number
  }
}

type Props = {
  planId: string
  disabled?: boolean
  initial?: CheckInConfiguration | null
  onSaved?: (config: CheckInConfiguration) => void
}

const defaultCustom = () => ({
  locationName: '',
  latitude: 0,
  longitude: 0,
  radiusMeters: 150
})

export default function CheckInPolicySection({ planId, disabled, initial, onSaved }: Props) {
  const [policyType, setPolicyType] = useState<CheckInPolicyType>('COMPANY_DEFAULT')
  const [doctor, setDoctor] = useState<DoctorLookupOption | null>(null)
  const [customLocation, setCustomLocation] = useState(defaultCustom())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const cfg = initial
    if (!cfg) return
    setPolicyType(cfg.policyType || 'COMPANY_DEFAULT')
    if (cfg.customLocation) {
      setCustomLocation({
        locationName: cfg.customLocation.locationName || '',
        latitude: cfg.customLocation.latitude ?? 0,
        longitude: cfg.customLocation.longitude ?? 0,
        radiusMeters: cfg.customLocation.radiusMeters ?? 150
      })
    }
    if (cfg.doctorId) {
      void doctorsService
        .getById(String(cfg.doctorId))
        .then(r => setDoctor(r.data.data as DoctorLookupOption))
        .catch(() => setDoctor(null))
    } else {
      setDoctor(null)
    }
  }, [initial])

  const buildPayload = (): CheckInConfiguration => {
    const base: CheckInConfiguration = { policyType }
    if (policyType === 'SPECIFIC_DOCTOR' && doctor?._id) {
      base.doctorId = String(doctor._id)
    }
    if (policyType === 'CUSTOM_LOCATION') {
      base.customLocation = {
        locationName: customLocation.locationName.trim(),
        latitude: Number(customLocation.latitude),
        longitude: Number(customLocation.longitude),
        radiusMeters: Number(customLocation.radiusMeters) || 150
      }
    }
    return base
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const checkInConfiguration = buildPayload()
      await weeklyPlansService.update(planId, { checkInConfiguration })
      showSuccess('Check-in policy saved')
      onSaved?.(checkInConfiguration)
    } catch (e) {
      showApiError(e, 'Could not save check-in policy')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant='outlined' className='mbe-4'>
      <CardHeader title='Check-in policy' subheader='Where reps should start their day this week (V2 companies only)' />
      <CardContent>
        <Alert severity='info' className='mbe-4'>
          Attendance is always recorded. Out-of-zone check-ins are flagged for reporting only.
        </Alert>
        <RadioGroup
          value={policyType}
          onChange={e => setPolicyType(e.target.value as CheckInPolicyType)}
        >
          <FormControlLabel value='COMPANY_DEFAULT' control={<Radio />} label='Use company default' disabled={disabled} />
          <FormControlLabel value='FIRST_PLANNED_VISIT' control={<Radio />} label='First planned visit' disabled={disabled} />
          <FormControlLabel value='SPECIFIC_DOCTOR' control={<Radio />} label='Specific doctor' disabled={disabled} />
          <FormControlLabel value='CUSTOM_LOCATION' control={<Radio />} label='Custom location' disabled={disabled} />
        </RadioGroup>

        {policyType === 'SPECIFIC_DOCTOR' && (
          <CustomAutocomplete<DoctorLookupOption, false, false, false>
            className='mbs-3'
            disabled={disabled}
            options={doctor ? [doctor] : []}
            value={doctor}
            getOptionLabel={doctorLookupOptionLabel}
            renderOption={renderDoctorLookupOption}
            onChange={(_e, v) => setDoctor(v)}
            onInputChange={async (_e, q) => {
              if (!q || q.length < 2) return
              try {
                const rows = (await doctorsService.list({ search: q, limit: 15 })).data.data as DoctorLookupOption[]
                if (rows[0]) setDoctor(rows[0])
              } catch {
                /* ignore */
              }
            }}
            renderInput={params => (
              <CustomTextField {...params} label='Doctor' placeholder='Search doctor' />
            )}
          />
        )}

        {policyType === 'CUSTOM_LOCATION' && (
          <Grid container spacing={2} className='mbs-3'>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                label='Location name'
                value={customLocation.locationName}
                disabled={disabled}
                onChange={e => setCustomLocation(c => ({ ...c, locationName: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                label='Latitude'
                type='number'
                disabled={disabled}
                value={customLocation.latitude}
                onChange={e => setCustomLocation(c => ({ ...c, latitude: Number(e.target.value) }))}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                label='Longitude'
                type='number'
                disabled={disabled}
                value={customLocation.longitude}
                onChange={e => setCustomLocation(c => ({ ...c, longitude: Number(e.target.value) }))}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                label='Radius (m)'
                type='number'
                disabled={disabled}
                value={customLocation.radiusMeters}
                onChange={e => setCustomLocation(c => ({ ...c, radiusMeters: Number(e.target.value) }))}
                fullWidth
              />
            </Grid>
          </Grid>
        )}

        {policyType === 'FIRST_PLANNED_VISIT' && (
          <Typography variant='body2' color='text.secondary' className='mbs-2'>
            Uses the first doctor visit on each day (lowest sequence). Falls back to company default if none is scheduled.
          </Typography>
        )}

        {!disabled && (
          <Button variant='contained' className='mbs-4' disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save check-in policy'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
