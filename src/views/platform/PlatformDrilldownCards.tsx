'use client'

import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import type { PlatformCompanyRow } from '@/types/platformDashboard'
import { formatPKR } from './PlatformKpiRow'

const PlatformDrilldownCards = ({
  rows,
  rangeLabel
}: {
  rows: PlatformCompanyRow[]
  rangeLabel: string
}) => {
  if (!rows.length) return null

  return (
    <Grid
      container
      spacing={3}
      component='section'
      role='region'
      aria-label='Company summary cards'
    >
      {rows.map(r => {
        const o = r.period.receivablesFromPharmacy + r.period.distributorOwedToCompany
        return (
          <Grid key={r.companyId} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card
              className='h-full'
              variant='outlined'
              sx={th => ({
                boxShadow: th.shadows[0],
                transition: th.transitions.create(['box-shadow', 'transform'], { duration: th.transitions.duration.shorter }),
                '&:hover': { boxShadow: th.shadows[2] }
              })}
            >
              <CardHeader
                title={r.name}
                subheader={r.city}
                action={
                  <Chip
                    size='small'
                    color={r.health === 'warning' ? 'warning' : 'success'}
                    variant='tonal'
                    label={r.health === 'warning' ? 'Review' : 'OK'}
                  />
                }
              />
              <CardContent className='flex flex-col gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  {rangeLabel}
                </Typography>
                <Typography variant='body2'>Revenue: {formatPKR(r.period.revenue)}</Typography>
                <Typography variant='body2'>Orders: {r.period.orders}</Typography>
                <Typography variant='body2'>Outstanding: {formatPKR(o)}</Typography>
                <Button size='small' variant='tonal' disabled className='self-start mbs-2' aria-disabled>
                  View details
                </Button>
                <Typography variant='caption' color='text.secondary'>
                  Deep link coming soon
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )
      })}
    </Grid>
  )
}

export default PlatformDrilldownCards
