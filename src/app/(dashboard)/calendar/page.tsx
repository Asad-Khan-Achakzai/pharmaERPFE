// MUI Imports
import Card from '@mui/material/Card'

// Component Imports
import CalendarView from '@/views/calendar/CalendarView'

// Styled Component Imports
import AppFullCalendar from '@/libs/styles/AppFullCalendar'

const CalendarPage = () => {
  return (
    <Card className='overflow-visible'>
      <AppFullCalendar className='app-calendar'>
        <CalendarView />
      </AppFullCalendar>
    </Card>
  )
}

export default CalendarPage
