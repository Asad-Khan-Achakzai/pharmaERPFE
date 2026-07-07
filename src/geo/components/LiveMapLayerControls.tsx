'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { LiveMapLayerKey } from '@/geo/types/mapContext'

const PROXIMITY_OPTIONS = [100, 150, 250, 500, 1000]

type Props = {
  availableLayers: LiveMapLayerKey[]
  layers: Record<LiveMapLayerKey, boolean>
  layerLabels: Record<LiveMapLayerKey, string>
  onToggleLayer: (key: LiveMapLayerKey, visible: boolean) => void
  proximityRadiusMeters: number
  onProximityChange: (meters: number) => void
  contextLoading?: boolean
}

export function LiveMapLayerControls({
  availableLayers,
  layers,
  layerLabels,
  onToggleLayer,
  proximityRadiusMeters,
  onProximityChange,
  contextLoading = false
}: Props) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        zIndex: 2,
        pointerEvents: 'none'
      }}
    >
      <Stack
        direction='row'
        spacing={0.75}
        flexWrap='wrap'
        useFlexGap
        alignItems='center'
        sx={{
          pointerEvents: 'auto',
          p: 1,
          borderRadius: 1,
          bgcolor: 'background.paper',
          boxShadow: 1,
          maxWidth: '100%'
        }}
      >
        <Typography variant='caption' color='text.secondary' sx={{ mr: 0.5, fontWeight: 600 }}>
          Layers
        </Typography>
        {availableLayers.map((key) => (
          <Chip
            key={key}
            size='small'
            label={layerLabels[key]}
            color={layers[key] ? 'primary' : 'default'}
            variant={layers[key] ? 'filled' : 'outlined'}
            onClick={() => onToggleLayer(key, !layers[key])}
          />
        ))}
        <FormControl size='small' sx={{ minWidth: 120, ml: 'auto !important' }}>
          <InputLabel id='live-map-proximity-label'>Nearby</InputLabel>
          <Select
            labelId='live-map-proximity-label'
            label='Nearby'
            value={proximityRadiusMeters}
            onChange={(e) => onProximityChange(Number(e.target.value))}
          >
            {PROXIMITY_OPTIONS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}m
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {contextLoading ? (
          <Typography variant='caption' color='text.secondary'>
            Loading context…
          </Typography>
        ) : null}
      </Stack>
    </Box>
  )
}
