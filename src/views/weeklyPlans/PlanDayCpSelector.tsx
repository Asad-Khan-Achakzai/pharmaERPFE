'use client'

import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import type { CallPoint } from '@/services/callPoints.service'
import { enumeratePlanDays, type CpByDay } from './planCpDays'

type Props = {
  weekStartDate: string
  weekEndDate: string
  cps: CallPoint[]
  value: CpByDay
  onChange: (next: CpByDay) => void
  disabled?: boolean
}

/**
 * Per-day CP dropdowns for a weekly plan. One Active-CP dropdown per calendar day in
 * the selected week range. Selection is stored by weekday key (cpByDay).
 */
export default function PlanDayCpSelector({
  weekStartDate,
  weekEndDate,
  cps,
  value,
  onChange,
  disabled
}: Props) {
  const days = enumeratePlanDays(weekStartDate, weekEndDate)

  if (!weekStartDate || !weekEndDate || days.length === 0) {
    return (
      <Typography variant='body2' color='text.secondary'>
        Select the week range first to assign a CP for each day.
      </Typography>
    )
  }

  if (cps.length === 0) {
    return (
      <Typography variant='body2' color='text.secondary'>
        No active CPs are configured. Ask your Admin to add Call Points first.
      </Typography>
    )
  }

  return (
    <Grid container spacing={3}>
      {days.map(day => (
        <Grid size={{ xs: 12, sm: 6 }} key={day.ymd}>
          <CustomTextField
            select
            required
            fullWidth
            label={day.label}
            disabled={disabled}
            value={value[day.dayKey] ?? ''}
            onChange={e =>
              onChange({ ...value, [day.dayKey]: e.target.value ? e.target.value : null })
            }
          >
            <MenuItem value=''>
              <em>Select a CP</em>
            </MenuItem>
            {cps.map(cp => (
              <MenuItem key={cp._id} value={cp._id}>
                {cp.name}
              </MenuItem>
            ))}
          </CustomTextField>
        </Grid>
      ))}
    </Grid>
  )
}
