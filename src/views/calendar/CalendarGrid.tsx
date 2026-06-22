'use client'

// React Imports
import type { FC } from 'react'

// MUI Imports
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import FullCalendar from '@fullcalendar/react'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarApi, CalendarOptions, DatesSetArg, EventClickArg } from '@fullcalendar/core'

// Type Imports
import type { CalendarCategory, CalendarEvent } from '@/types/calendar'
import { CALENDAR_CATEGORY_COLOR } from '@/types/calendar'

/** React 19 + @fullcalendar/react v6 class-component typing gap — render via a typed alias. */
const FullCalendarTyped = FullCalendar as unknown as FC<CalendarOptions>

type CalendarGridProps = {
  events: CalendarEvent[]
  setCalendarApi: (api: CalendarApi) => void
  onEventClick: (event: CalendarEvent) => void
  onDatesSet: (start: Date, end: Date) => void
  handleLeftSidebarToggle: () => void
}

const CalendarGrid = (props: CalendarGridProps) => {
  const { events, setCalendarApi, onEventClick, onDatesSet, handleLeftSidebarToggle } = props

  const theme = useTheme()

  const calendarOptions: CalendarOptions = {
    events: events as unknown as CalendarOptions['events'],
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      start: 'sidebarToggle, prev, next, title',
      end: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    views: {
      week: {
        titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
      }
    },

    /* Read-only calendar: no drag, resize, or inline editing. */
    editable: false,
    selectable: false,
    dayMaxEvents: 3,
    navLinks: true,

    eventClassNames({ event: calendarEvent }) {
      const category = calendarEvent.extendedProps.category as CalendarCategory
      const colorName = CALENDAR_CATEGORY_COLOR[category] || 'primary'

      return [`event-bg-${colorName}`]
    },

    eventClick(arg: EventClickArg) {
      arg.jsEvent.preventDefault()
      const e = arg.event

      onEventClick({
        id: e.id,
        title: e.title,
        start: (e.startStr || '').slice(0, 10),
        allDay: e.allDay,
        extendedProps: e.extendedProps as CalendarEvent['extendedProps']
      })
    },

    datesSet(arg: DatesSetArg) {
      setCalendarApi(arg.view.calendar)
      onDatesSet(arg.start, arg.end)
    },

    customButtons: {
      sidebarToggle: {
        icon: 'tabler tabler-menu-2',
        click() {
          handleLeftSidebarToggle()
        }
      }
    },

    direction: theme.direction
  }

  return <FullCalendarTyped {...calendarOptions} />
}

export default CalendarGrid
