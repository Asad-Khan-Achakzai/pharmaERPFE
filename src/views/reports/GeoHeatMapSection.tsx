'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { GeoFeatureGate } from '@/geo/GeoPlatformProvider'
import { VisitHeatMapScene } from '@/geo/scenes/VisitHeatMapScene'

export default function GeoHeatMapSection({ from, to }: { from?: string; to?: string }) {
  return (
    <GeoFeatureGate feature='heatMaps'>
      <Card variant='outlined' className='mbe-4'>
        <CardContent>
          <Typography variant='subtitle2' className='mbe-1'>
            Visit density heat map
          </Typography>
          <Typography variant='caption' color='text.secondary' display='block' className='mbe-3'>
            Doctor visit locations aggregated for the selected date range. Brighter areas indicate more field visits
            with GPS recorded.
          </Typography>
          <VisitHeatMapScene from={from} to={to} height={380} />
        </CardContent>
      </Card>
    </GeoFeatureGate>
  )
}
