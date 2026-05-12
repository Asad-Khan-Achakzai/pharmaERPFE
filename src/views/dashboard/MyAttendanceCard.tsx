'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'

type PolicySummary = {
  shiftName?: string | null
  expectedStartLocal?: string
  expectedEndLocal?: string
  graceMinutes?: number
  postShiftCheckInCutoffMinutes?: number
  checkInClosedForShift?: boolean
}

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
  const ps = meToday?.policySummary as PolicySummary | undefined
  const cutoff = ps?.postShiftCheckInCutoffMinutes ?? 0

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
        title='My workday'
        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
        sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 1 }}
      />
      <CardContent
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'visible',
          px: { xs: 2.5, sm: 3 },
          pt: 0.5,
          pb: { xs: 10, sm: 3 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          '&:last-of-type': { pb: { xs: 10, sm: 3 } }
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
                    : meToday?.uiStatus === 'LATE_CHECKIN_PENDING'
                      ? 'Late check-in — waiting for manager'
                      : meToday?.uiStatus === 'LATE_CHECKIN_REJECTED'
                        ? 'Late check-in rejected'
                        : meToday?.uiStatus === 'SHIFT_CHECKIN_CLOSED'
                          ? 'Shift ended'
                          : meToday?.uiStatus === 'PRESENT'
                            ? 'Present'
                            : 'Not marked'
                }
                color={
                  meToday?.uiStatus === 'CHECKED_OUT'
                    ? 'default'
                    : meToday?.uiStatus === 'LATE_CHECKIN_PENDING'
                      ? 'warning'
                      : meToday?.uiStatus === 'LATE_CHECKIN_REJECTED'
                        ? 'error'
                        : meToday?.uiStatus === 'SHIFT_CHECKIN_CLOSED'
                          ? 'default'
                          : meToday?.uiStatus === 'PRESENT'
                            ? 'success'
                            : 'warning'
                }
                variant='tonal'
              />
            </Typography>
            {ps?.shiftName ? (
              <Box>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Today’s expected window
                </Typography>
                <Typography variant='body2'>
                  <strong>{ps.shiftName}</strong> · {ps.expectedStartLocal ?? '—'} – {ps.expectedEndLocal ?? '—'}
                  {typeof ps.graceMinutes === 'number' ? ` · ${ps.graceMinutes} min grace` : null}
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                  {cutoff > 0
                    ? `Check-in allowed up to ${cutoff} minutes after the scheduled end.`
                    : 'Check-in closes when the scheduled day ends (no extra buffer).'}
                </Typography>
              </Box>
            ) : null}
            {meToday?.uiStatus === 'LATE_CHECKIN_PENDING' && (
              <Typography variant='body2' color='text.secondary'>
                Your check-in time was saved and sent to your manager. You can check out after they approve.
              </Typography>
            )}
            {meToday?.uiStatus === 'LATE_CHECKIN_REJECTED' && (
              <Typography variant='body2' color='text.secondary'>
                Your manager rejected this late check-in. You can tap Check In again if needed.
              </Typography>
            )}
            {meToday?.uiStatus === 'SHIFT_CHECKIN_CLOSED' && (
              <Box>
                <Typography variant='body2' color='text.secondary'>
                  {meToday.shiftCheckInClosedMessage ||
                    'Shift has ended. Check-in is no longer allowed for today. Use an attendance correction request or contact your manager.'}
                </Typography>
                {ps?.shiftName ? (
                  <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                    Scheduled: {ps.expectedStartLocal} – {ps.expectedEndLocal}
                    {cutoff > 0 ? ` (check-in window extended ${cutoff} min past end)` : ''}
                  </Typography>
                ) : null}
              </Box>
            )}
            {meToday?.checkInTime && (
              <Typography variant='body2' color='text.secondary'>
                Check-in: {formatPstHm(meToday.checkInTime as string) ?? '—'}
              </Typography>
            )}
            {meToday?.checkOutTime && (
              <Typography variant='body2' color='text.secondary'>
                Check-out: {formatPstHm(meToday.checkOutTime as string) ?? '—'}
              </Typography>
            )}
            {meToday?.pstDate && (
              <Typography variant='caption' color='text.disabled' sx={{ display: 'block' }}>
                Workday date: {meToday.pstDate}
              </Typography>
            )}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                pt: 0.5,
                width: '100%',
                position: { xs: 'sticky', sm: 'static' },
                bottom: { xs: 8, sm: 'auto' },
                zIndex: 2,
                bgcolor: { xs: 'var(--mui-palette-background-paper)', sm: 'transparent' },
                pb: { xs: 0.5, sm: 0 }
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
