'use client'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'

type VisitLogRef = {
  _id?: string
  visitTime?: string
  doctorId?: unknown
  employeeId?: unknown
}

export function OrderVisitLinkPanel({ order }: { order: any }) {
  const raw = order?.visitLogId
  const visit: VisitLogRef | string | null | undefined =
    raw && typeof raw === 'object' ? (raw as VisitLogRef) : raw || null
  const visitId = visit && typeof visit === 'object' ? visit._id : visit
  const hasLink = Boolean(visitId && String(visitId).length >= 12)
  const visitTime =
    visit && typeof visit === 'object' && visit.visitTime
      ? new Date(visit.visitTime).toLocaleString()
      : null

  return (
    <Card variant='outlined' className='mbe-4'>
      <CardHeader title='Visit linkage' subheader='Order ↔ field visit (existing order payload)' />
      <CardContent>
        <Stack spacing={2}>
          <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
            <Chip
              size='small'
              color={hasLink ? 'success' : 'default'}
              variant='tonal'
              label={hasLink ? 'Visit-driven sale' : 'Direct sale'}
            />
          </Stack>
          {hasLink ? (
            <>
              <Typography variant='body2'>
                Linked visit ID:{' '}
                <Typography component='span' fontWeight={600}>
                  {String(visitId)}
                </Typography>
              </Typography>
              {visitTime ? (
                <Typography variant='body2' color='text.secondary'>
                  Visit time: {visitTime}
                </Typography>
              ) : null}
            </>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              Not linked to any visit.
            </Typography>
          )}
          {hasLink ? (
            <Typography variant='caption' color='text.secondary'>
              Visit logs are managed from weekly plans /Today&apos;s visits; this panel is read-only.
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
