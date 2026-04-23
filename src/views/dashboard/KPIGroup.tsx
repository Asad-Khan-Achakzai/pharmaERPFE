import classnames from 'classnames'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

// Types Imports
import type { ThemeColor } from '@core/types'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

/**
 * Executive KPI tile — matches starter-kit + full-version statistics rhythm:
 * Card + avatar + typographic stack (see `card-statistics/Horizontal.tsx`, ecommerce StatisticsCard).
 * No trend deltas (dashboard snapshot has no “last week” source).
 */
type KPIGroupProps = {
  title: string
  value: string
  helper: string
  icon: string
  tone?: ThemeColor
}

const KPIGroup = ({ title, value, helper, icon, tone = 'primary' }: KPIGroupProps) => {
  return (
    <Card
      className='bs-full'
      variant='outlined'
      sx={{
        borderColor: 'divider',
        boxShadow: 'none'
      }}
    >
      <CardContent
        className='flex flex-col justify-between'
        sx={{ py: 2.5, px: 2.5, minHeight: { xs: 128, sm: 120 } }}
      >
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 flex-1 flex-col gap-y-1'>
            <Typography variant='overline' color='text.secondary' className='leading-tight' sx={{ letterSpacing: 0.6 }}>
              {title}
            </Typography>
            <Typography variant='h5' className='font-bold leading-tight' sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            <Typography variant='caption' color='text.disabled' className='line-clamp-2 leading-snug'>
              {helper}
            </Typography>
          </div>
          <CustomAvatar color={tone} skin='light' variant='rounded' size={48}>
            <i className={classnames(icon, 'text-[26px]')} />
          </CustomAvatar>
        </div>
      </CardContent>
    </Card>
  )
}

export default KPIGroup
