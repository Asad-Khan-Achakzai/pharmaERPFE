'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { GeoFeatureGate } from '@/geo/GeoPlatformProvider'
import { TerritoryBoundariesScene } from '@/geo/scenes/TerritoryBoundariesScene'

export default function TerritoryBoundariesMapSection({ territoryId }: { territoryId?: string }) {
  return (
    <GeoFeatureGate feature='territoryPolygons'>
      <Card variant='outlined'>
        <CardContent>
          <Typography variant='subtitle2' className='mbe-1'>
            Territory boundaries
          </Typography>
          <Typography variant='caption' color='text.secondary' display='block' className='mbe-3'>
            Saved territory polygon overlays for your company. Shown on web and mobile when the Territory polygons flag
            is enabled.
          </Typography>
          <TerritoryBoundariesScene height={400} territoryId={territoryId} />
        </CardContent>
      </Card>
    </GeoFeatureGate>
  )
}
