'use client'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import Drawer from '@mui/material/Drawer'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { CalendarEvent } from '@/types/calendar'
import { CALENDAR_CATEGORY_COLOR, CALENDAR_CATEGORY_LABEL } from '@/types/calendar'

type EventDetailsDrawerProps = {
  open: boolean
  event: CalendarEvent | null
  onClose: () => void
}

const EventDetailsDrawer = (props: EventDetailsDrawerProps) => {
  const { open, event, onClose } = props
  const router = useRouter()

  const ext = event?.extendedProps

  const handleOpenSource = () => {
    if (ext?.deepLink) {
      onClose()
      router.push(ext.deepLink)
    }
  }

  return (
    <Drawer
      anchor='right'
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      slotProps={{ paper: { className: 'is-[100%] sm:is-[400px]' } }}
    >
      <div className='flex items-center justify-between plb-5 pli-6'>
        <Typography variant='h5'>Activity details</Typography>
        <IconButton size='small' onClick={onClose}>
          <i className='tabler-x text-textPrimary' />
        </IconButton>
      </div>
      <Divider />

      {event && ext && (
        <div className='flex flex-col gap-5 p-6'>
          <div className='flex flex-col gap-2'>
            <Chip
              size='small'
              variant='tonal'
              label={CALENDAR_CATEGORY_LABEL[ext.category]}
              color={(CALENDAR_CATEGORY_COLOR[ext.category] as ThemeColor) || 'primary'}
              className='self-start'
            />
            <Typography variant='h6'>{event.title}</Typography>
            {ext.subtitle && (
              <Typography variant='body2' color='text.secondary'>
                {ext.subtitle}
              </Typography>
            )}
          </div>

          <Divider />

          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between gap-4'>
              <Typography variant='body2' color='text.secondary'>
                Date
              </Typography>
              <Typography variant='body2'>{event.start}</Typography>
            </div>
            {(ext.details || []).map((d, i) => (
              <div className='flex items-start justify-between gap-4' key={`${d.label}-${i}`}>
                <Typography variant='body2' color='text.secondary'>
                  {d.label}
                </Typography>
                <Typography variant='body2' className='text-end'>
                  {d.value}
                </Typography>
              </div>
            ))}
          </div>

          {ext.deepLink && (
            <>
              <Divider />
              <Button
                variant='contained'
                startIcon={<i className='tabler-external-link' />}
                onClick={handleOpenSource}
              >
                Open
              </Button>
              <Typography variant='caption' color='text.secondary'>
                The calendar is read-only. Actions are performed on the source screen.
              </Typography>
            </>
          )}
        </div>
      )}
    </Drawer>
  )
}

export default EventDetailsDrawer
