'use client'

import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import type { WidgetLayoutRoot } from './engine/widgetTypes'
import { getBandRowOrder } from './engine/widgetLayoutEngine'
import { WidgetRenderer } from './WidgetRenderer'

export function WidgetGrid({ layout }: { layout: WidgetLayoutRoot }) {
  const { bands, featureFlags } = layout

  return (
    <Grid container spacing={4}>
      {bands.map(band => {
        const rowSx = {
          order: getBandRowOrder(band.band, featureFlags)
        }
        if (band.variant === 'split') {
          return (
            <Grid key={band.band} size={{ xs: 12 }} sx={rowSx}>
              <Grid container spacing={4}>
                <Grid
                  size={{ xs: 12, md: 4 }}
                  sx={{ alignSelf: { md: 'flex-start' }, minHeight: 0 }}
                >
                  <Stack spacing={2.5} sx={{ width: '100%', minHeight: 0 }}>
                    {band.sidebar.map(i => (
                      <WidgetRenderer key={i.key} instance={i} />
                    ))}
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Stack spacing={2.5} sx={{ width: '100%', minHeight: 0 }}>
                    {band.main.map(i => (
                      <WidgetRenderer key={i.key} instance={i} />
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          )
        }
        return (
          <Grid key={band.band} size={{ xs: 12 }} sx={rowSx}>
            <Stack spacing={2.5} sx={{ width: '100%', minHeight: 0 }}>
              {band.full.map(i => (
                <WidgetRenderer key={i.key} instance={i} />
              ))}
            </Stack>
          </Grid>
        )
      })}
    </Grid>
  )
}
