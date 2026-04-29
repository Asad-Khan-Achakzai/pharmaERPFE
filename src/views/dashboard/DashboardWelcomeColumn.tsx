import type { ReactNode } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import classnames from 'classnames'
import CustomAvatar from '@core/components/mui/Avatar'

type DashboardWelcomeColumnProps = {
  greeting: string
  name: string
  summary: string
  /** Optional hero metric — string or richer layout (e.g. dual net sales). */
  highlight?: ReactNode
}

/**
 * Ecommerce `Congratulations` layout: Card, Grid 8+4, text + visual anchor (avatar instead of static asset).
 */
const DashboardWelcomeColumn = ({ greeting, name, summary, highlight }: DashboardWelcomeColumnProps) => {
  return (
    <Card className='w-full' sx={{ boxShadow: 'var(--shadow-xs)' }}>
      <Grid container>
        <Grid size={{ xs: 8 }}>
          <CardContent sx={{ p: 3, '&:last-of-type': { pb: 3 } }}>
            <Typography variant='h5' className='mbe-0.5' sx={{ fontWeight: 600 }}>
              {greeting}, {name}
            </Typography>
            <Typography variant='subtitle1' className='mbe-2' color='text.secondary'>
              {summary}
            </Typography>
            {highlight ? (
              <div className='flex flex-col gap-0.5'>{typeof highlight === 'string' ? (
                <Typography variant='h4' color='primary.main' className='mbe-0'>
                  {highlight}
                </Typography>
              ) : (
                highlight
              )}</div>
            ) : null}
          </CardContent>
        </Grid>
        <Grid size={{ xs: 4 }} className='flex items-end justify-center p-3 max-xs:p-2'>
          <div className='flex justify-center items-end w-full is-full'>
            <CustomAvatar
              color='primary'
              variant='rounded'
              size={100}
              skin='light'
              className='bs-auto min-is-0 w-full'
              sx={{ maxWidth: 120, maxHeight: 120, height: 120, width: 120 }}
            >
              <i className={classnames('tabler-briefing text-5xl')} />
            </CustomAvatar>
          </div>
        </Grid>
      </Grid>
    </Card>
  )
}

export default DashboardWelcomeColumn
