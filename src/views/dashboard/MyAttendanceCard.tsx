'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'

const MyAttendanceCard = ({
  meTodayLoading,
  meToday,
  checkingIn,
  checkingOut,
  handleCheckIn,
  handleCheckOut,
  formatPstHm
}: {
  meTodayLoading: boolean
  meToday: any
  checkingIn: boolean
  checkingOut: boolean
  handleCheckIn: () => Promise<void>
  handleCheckOut: () => Promise<void>
  formatPstHm: (iso: string | undefined) => string | null
}) => {
  return (
    <Card
      className='w-full max-w-full'
      sx={{
        boxShadow: 'var(--shadow-xs)',
        minHeight: 0,
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <CardHeader
        title='My attendance today'
        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
        sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 1 }}
      />
      <CardContent
        sx={{
          flex: '0 0 auto',
          minHeight: 0,
          overflow: 'visible',
          px: { xs: 2.5, sm: 3 },
          pt: 0.5,
          pb: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          '&:last-of-type': { pb: 3 }
        }}
      >
        {meTodayLoading ? (
          <Box sx={{ width: '100%' }} aria-busy aria-label='Loading your attendance'>
            <Skeleton variant='rounded' width='42%' height={28} animation='wave' sx={{ mb: 1.5 }} />
            <Skeleton variant='text' width='55%' animation='wave' />
            <Skeleton variant='text' width='48%' animation='wave' sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Skeleton variant='rounded' width={100} height={32} />
              <Skeleton variant='rounded' width={100} height={32} />
            </Box>
          </Box>
        ) : (
          <>
            <Typography component='div' variant='body2' className='flex items-center gap-2 flex-wrap'>
              <span>Status:</span>
              <Chip
                size='small'
                label={
                  meToday?.uiStatus === 'CHECKED_OUT'
                    ? 'Checked out'
                    : meToday?.uiStatus === 'PRESENT'
                      ? 'Present'
                      : 'Not marked'
                }
                color={
                  meToday?.uiStatus === 'CHECKED_OUT'
                    ? 'default'
                    : meToday?.uiStatus === 'PRESENT'
                      ? 'success'
                      : 'warning'
                }
                variant='tonal'
              />
            </Typography>
            {meToday?.checkInTime && (
              <Typography variant='body2' color='text.secondary'>
                Check-in (PT): {formatPstHm(meToday.checkInTime as string) ?? '—'}
              </Typography>
            )}
            {meToday?.checkOutTime && (
              <Typography variant='body2' color='text.secondary'>
                Check-out (PT): {formatPstHm(meToday.checkOutTime as string) ?? '—'}
              </Typography>
            )}
            {meToday?.pstDate && (
              <Typography variant='caption' color='text.disabled' sx={{ display: 'block' }}>
                Business date (Pacific): {meToday.pstDate}
              </Typography>
            )}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                pt: 0.5,
                width: '100%'
              }}
            >
              <Button
                variant='contained'
                size='small'
                onClick={handleCheckIn}
                disabled={meTodayLoading || checkingIn || checkingOut || !meToday?.canCheckIn}
              >
                {checkingIn ? 'Checking in...' : 'Check In'}
              </Button>
              <Button
                variant='tonal'
                color='secondary'
                size='small'
                onClick={handleCheckOut}
                disabled={meTodayLoading || checkingIn || checkingOut || !meToday?.canCheckOut}
              >
                {checkingOut ? 'Checking out...' : 'Check Out'}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default MyAttendanceCard
