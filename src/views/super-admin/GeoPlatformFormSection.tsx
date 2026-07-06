'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import type { GeoFeatureKey } from '@/geo/types'
import type { GeoFeaturePlatform, GeoPlatformFormState } from '@/views/super-admin/geoPlatformForm'
import {
  FEATURE_DESCRIPTIONS,
  FEATURE_LABELS,
  FEATURE_PLATFORMS,
  GEO_FEATURE_SECTIONS,
  PLATFORM_GROUP_LABELS,
  PLATFORM_GROUP_ORDER,
  setGeoFeatureWithDeps
} from '@/views/super-admin/geoPlatformForm'
import { LiveTrackingTunablesSection } from '@/views/super-admin/LiveTrackingTunablesSection'

type Props = {
  value: GeoPlatformFormState
  onChange: (next: GeoPlatformFormState) => void
}

const PLATFORM_CHIP_COLOR: Record<GeoFeaturePlatform, 'default' | 'primary' | 'secondary' | 'info'> = {
  both: 'primary',
  mobile: 'secondary',
  web: 'info'
}

function groupKeysByPlatform(keys: readonly GeoFeatureKey[]): Partial<Record<GeoFeaturePlatform, GeoFeatureKey[]>> {
  const groups: Partial<Record<GeoFeaturePlatform, GeoFeatureKey[]>> = {}
  for (const key of keys) {
    const platform = FEATURE_PLATFORMS[key]
    if (!groups[platform]) groups[platform] = []
    groups[platform]!.push(key)
  }
  return groups
}

function GeoFeatureToggle({
  featureKey,
  checked,
  disabled,
  onToggle
}: {
  featureKey: GeoFeatureKey
  checked: boolean
  disabled: boolean
  onToggle: (checked: boolean) => void
}) {
  const platform = FEATURE_PLATFORMS[featureKey]

  return (
    <FormControlLabel
      control={
        <Switch
          checked={checked}
          disabled={disabled}
          onChange={e => onToggle(e.target.checked)}
          color='primary'
          size='small'
        />
      }
      label={
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant='body2' component='span'>
              {FEATURE_LABELS[featureKey]}
            </Typography>
            <Chip
              label={PLATFORM_GROUP_LABELS[platform]}
              size='small'
              color={PLATFORM_CHIP_COLOR[platform]}
              variant='outlined'
              sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }}
            />
          </Box>
          <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.25 }}>
            {FEATURE_DESCRIPTIONS[featureKey]}
          </Typography>
        </Box>
      }
      sx={{ alignItems: 'flex-start', mr: 0, ml: 0 }}
    />
  )
}

export default function GeoPlatformFormSection({ value, onChange }: Props) {
  const setFeature = (key: GeoFeatureKey, checked: boolean) => {
    onChange(setGeoFeatureWithDeps(value, key, checked))
  }

  return (
    <>
      <Typography variant='subtitle2' sx={{ mt: 3, mb: 0.5 }}>
        Geo Platform
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
        Enable the Geo Platform master switch, then toggle map and routing capabilities. Disabled features are hidden
        in web and mobile and blocked by the API.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={value.enabled}
            onChange={e => onChange({ ...value, enabled: e.target.checked })}
            color='primary'
          />
        }
        label='Geo Platform enabled'
        sx={{ alignItems: 'flex-start', mr: 0, ml: 0 }}
      />
      <TextField
        label='Max Google API calls / day (optional quota)'
        value={value.maxGoogleCallsPerDay}
        onChange={e => onChange({ ...value, maxGoogleCallsPerDay: e.target.value })}
        size='small'
        fullWidth
        sx={{ mt: 1 }}
        placeholder='Leave blank for unlimited'
      />

      {GEO_FEATURE_SECTIONS.map(section => {
        const platformGroups = groupKeysByPlatform(section.keys)

        return (
          <Box
            key={section.id}
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'action.hover'
            }}
          >
            <Typography variant='subtitle2' sx={{ mb: 0.5 }}>
              {section.title}
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
              {section.description}
            </Typography>

            {PLATFORM_GROUP_ORDER.filter(platform => platformGroups[platform]?.length).map((platform, index, visible) => (
              <Box key={platform} sx={{ mt: index > 0 ? 1.5 : 0, mb: index < visible.length - 1 ? 0 : 0 }}>
                {visible.length > 1 ? (
                  <Typography
                    variant='overline'
                    color='text.secondary'
                    sx={{ display: 'block', mb: 0.75, letterSpacing: 0.6 }}
                  >
                    {PLATFORM_GROUP_LABELS[platform]}
                  </Typography>
                ) : null}
                <Grid container spacing={1}>
                  {platformGroups[platform]!.map(key => (
                    <Grid size={{ xs: 12 }} key={key}>
                      <GeoFeatureToggle
                        featureKey={key}
                        checked={value.features[key] === true}
                        disabled={!value.enabled}
                        onToggle={checked => setFeature(key, checked)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Box>
        )
      })}

      {(value.features.liveTracking || value.features.managerLiveMap) && value.enabled ? (
        <LiveTrackingTunablesSection
          value={value.liveTracking}
          onChange={liveTracking => onChange({ ...value, liveTracking })}
          disabled={!value.enabled}
        />
      ) : null}
    </>
  )
}
