'use client'

// MUI Imports
import Drawer from '@mui/material/Drawer'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { CalendarCategory } from '@/types/calendar'
import { CALENDAR_CATEGORIES, CALENDAR_CATEGORY_COLOR, CALENDAR_CATEGORY_LABEL } from '@/types/calendar'

// Styled Component Imports
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'

type CalendarFilterSidebarProps = {
  mdAbove: boolean
  leftSidebarOpen: boolean
  selectedCategories: CalendarCategory[]
  calendarApi: { gotoDate: (date: Date) => void } | null
  handleLeftSidebarToggle: () => void
  toggleCategory: (category: CalendarCategory) => void
  toggleAllCategories: (checked: boolean) => void
}

const CalendarFilterSidebar = (props: CalendarFilterSidebarProps) => {
  const {
    mdAbove,
    leftSidebarOpen,
    selectedCategories,
    calendarApi,
    handleLeftSidebarToggle,
    toggleCategory,
    toggleAllCategories
  } = props

  return (
    <Drawer
      open={leftSidebarOpen}
      onClose={handleLeftSidebarToggle}
      variant={mdAbove ? 'permanent' : 'temporary'}
      ModalProps={{
        disablePortal: true,
        disableAutoFocus: true,
        disableScrollLock: true,
        keepMounted: true
      }}
      className={classnames('block', { static: mdAbove, absolute: !mdAbove })}
      slotProps={{
        paper: {
          className: classnames('items-start is-[280px] shadow-none rounded rounded-se-none rounded-ee-none', {
            static: mdAbove,
            absolute: !mdAbove
          })
        }
      }}
      sx={{
        zIndex: 3,
        '& .MuiDrawer-paper': {
          zIndex: mdAbove ? 2 : 'drawer'
        },
        '& .MuiBackdrop-root': {
          borderRadius: 1,
          position: 'absolute'
        }
      }}
    >
      <AppReactDatepicker
        inline
        onChange={(date: Date | null) => date && calendarApi?.gotoDate(date)}
        boxProps={{
          className: 'flex justify-center is-full',
          sx: { '& .react-datepicker': { boxShadow: 'none !important', border: 'none !important' } }
        }}
      />
      <Divider className='is-full' />

      <div className='flex flex-col p-6 is-full'>
        <Typography variant='h5' className='mbe-4'>
          Filters
        </Typography>
        <FormControlLabel
          className='mbe-1'
          label='View All'
          control={
            <Checkbox
              color='secondary'
              checked={selectedCategories.length === CALENDAR_CATEGORIES.length}
              indeterminate={
                selectedCategories.length > 0 && selectedCategories.length < CALENDAR_CATEGORIES.length
              }
              onChange={e => toggleAllCategories(e.target.checked)}
            />
          }
        />
        {CALENDAR_CATEGORIES.map(category => (
          <FormControlLabel
            className='mbe-1'
            key={category}
            label={CALENDAR_CATEGORY_LABEL[category]}
            control={
              <Checkbox
                color={CALENDAR_CATEGORY_COLOR[category] as ThemeColor}
                checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />
            }
          />
        ))}
      </div>
    </Drawer>
  )
}

export default CalendarFilterSidebar
