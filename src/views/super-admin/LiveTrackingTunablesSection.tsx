'use client'

import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

export type LiveTrackingTunables = {
  heartbeatIntervalMs: string
  maxAccuracyMeters: string
  historyMaxAccuracyMeters: string
  trackingProfile: 'balanced' | 'fresh' | 'conservative'
  schedulerMinIntervalMs: string
  schedulerMaxIntervalMs: string
  staleDisplayMs: string
  retentionDays: string
  sampleIntervalMs: string
  uploadBatchIntervalMs: string
}

export const defaultLiveTrackingTunables = (): LiveTrackingTunables => ({
  heartbeatIntervalMs: '300000',
  maxAccuracyMeters: '150',
  historyMaxAccuracyMeters: '500',
  trackingProfile: 'balanced',
  schedulerMinIntervalMs: '30000',
  schedulerMaxIntervalMs: '600000',
  staleDisplayMs: '1800000',
  retentionDays: '90',
  sampleIntervalMs: '60000',
  uploadBatchIntervalMs: '90000'
})

type Props = {
  value: LiveTrackingTunables
  onChange: (next: LiveTrackingTunables) => void
  disabled?: boolean
}

export function LiveTrackingTunablesSection({ value, onChange, disabled = false }: Props) {
  const set = <K extends keyof LiveTrackingTunables>(key: K, v: LiveTrackingTunables[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1 }}>
        Live tracking engine
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
        Adaptive scheduler profile and GPS quality thresholds. Live pin accuracy is stricter than
        Route History retention so weak GPS can still fill historical trails without moving the
        live map pin.
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <FormControl fullWidth size='small' disabled={disabled}>
            <InputLabel>Tracking profile</InputLabel>
            <Select
              label='Tracking profile'
              value={value.trackingProfile}
              onChange={e => set('trackingProfile', e.target.value as LiveTrackingTunables['trackingProfile'])}
            >
              <MenuItem value='balanced'>Balanced</MenuItem>
              <MenuItem value='fresh'>Fresh (more pings)</MenuItem>
              <MenuItem value='conservative'>Conservative (battery)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Baseline interval (ms)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.heartbeatIntervalMs}
            onChange={e => set('heartbeatIntervalMs', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Live pin accuracy (m)'
            size='small'
            fullWidth
            disabled={disabled}
            helperText='Max GPS error to update the live map pin'
            value={value.maxAccuracyMeters}
            onChange={e => set('maxAccuracyMeters', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='History retention accuracy (m)'
            size='small'
            fullWidth
            disabled={disabled}
            helperText='Weaker fixes up to this value are kept for Route History only'
            value={value.historyMaxAccuracyMeters}
            onChange={e => set('historyMaxAccuracyMeters', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Scheduler min interval (ms)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.schedulerMinIntervalMs}
            onChange={e => set('schedulerMinIntervalMs', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Scheduler max interval (ms)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.schedulerMaxIntervalMs}
            onChange={e => set('schedulerMaxIntervalMs', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Stale display window (ms)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.staleDisplayMs}
            onChange={e => set('staleDisplayMs', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Heartbeat retention (days)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.retentionDays}
            onChange={e => set('retentionDays', e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Sample interval (ms)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.sampleIntervalMs}
            onChange={e => set('sampleIntervalMs', e.target.value)}
            helperText='OS GPS callback cadence for route density'
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <TextField
            label='Upload batch interval (ms)'
            size='small'
            fullWidth
            disabled={disabled}
            value={value.uploadBatchIntervalMs}
            onChange={e => set('uploadBatchIntervalMs', e.target.value)}
            helperText='Background upload cadence (independent of live display)'
          />
        </Grid>
      </Grid>
    </Box>
  )
}
