'use client'

// React Imports
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// MUI Imports
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

// Component Imports (template MUI wrappers)
import CustomTextField from '@core/components/mui/TextField'
import MenuItem from '@mui/material/MenuItem'

// Context / Service Imports
import { useAuth } from '@/contexts/AuthContext'
import { fetchCalendar } from '@/services/calendar.service'
import { showApiError } from '@/utils/apiErrors'
import { formatYyyyMmDd } from '@/utils/dateLocal'

// Type Imports
import type { CalendarApi } from '@fullcalendar/core'
import type { CalendarCategory, CalendarEvent, CalendarRep, CalendarScope, CalendarSummary } from '@/types/calendar'
import {
  CALENDAR_CATEGORIES,
  CALENDAR_CATEGORY_COLOR,
  CALENDAR_CATEGORY_LABEL,
  CALENDAR_CATEGORY_SUMMARY_KEY
} from '@/types/calendar'

// Component Imports
import CalendarGrid from './CalendarGrid'
import CalendarFilterSidebar from './CalendarFilterSidebar'
import EventDetailsDrawer from './EventDetailsDrawer'

const CalendarView = () => {
  const { user, hasPermission } = useAuth()
  const theme = useTheme()
  const mdAbove = useMediaQuery(theme.breakpoints.up('md'))

  const employeeId = user?._id || ''
  const canSeeTeam = hasPermission('team.viewAllReports')

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [summary, setSummary] = useState<CalendarSummary | null>(null)
  const [reps, setReps] = useState<CalendarRep[]>([])
  const [selectedCategories, setSelectedCategories] = useState<CalendarCategory[]>([...CALENDAR_CATEGORIES])
  const [scope, setScope] = useState<CalendarScope>('mine')
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [calendarApi, setCalendarApi] = useState<CalendarApi | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const lastRangeRef = useRef<string>('')
  const currentRangeRef = useRef<{ start: Date; end: Date } | null>(null)

  const loadRange = useCallback(
    async (start: Date, end: Date) => {
      if (!employeeId) return
      // FullCalendar `end` is exclusive — step back one day for an inclusive range.
      const rangeStartYmd = formatYyyyMmDd(start)
      const inclusiveEnd = new Date(end)
      inclusiveEnd.setDate(inclusiveEnd.getDate() - 1)
      const rangeEndYmd = formatYyyyMmDd(inclusiveEnd)

      const repKey = scope === 'team' ? selectedRepIds.join(',') : ''
      const rangeKey = `${employeeId}|${scope}|${repKey}|${rangeStartYmd}|${rangeEndYmd}`
      if (rangeKey === lastRangeRef.current) return
      lastRangeRef.current = rangeKey

      setLoading(true)
      try {
        const payload = await fetchCalendar({
          rangeStartYmd,
          rangeEndYmd,
          scope,
          repIds: scope === 'team' ? selectedRepIds : []
        })
        setAllEvents(payload.events)
        setSummary(payload.summary)
        // Keep the rep picker stable: server returns the full base-scope directory.
        if (scope === 'team') setReps(payload.reps)
      } catch (err) {
        showApiError(err, 'Failed to load calendar')
      } finally {
        setLoading(false)
      }
    },
    [employeeId, scope, selectedRepIds]
  )

  const handleDatesSet = useCallback(
    (start: Date, end: Date) => {
      currentRangeRef.current = { start, end }
      void loadRange(start, end)
    },
    [loadRange]
  )

  // Refetch when scope, rep filter or user changes, reusing the visible range.
  useEffect(() => {
    lastRangeRef.current = ''
    if (currentRangeRef.current) {
      void loadRange(currentRangeRef.current.start, currentRangeRef.current.end)
    }
  }, [scope, selectedRepIds, employeeId, loadRange])

  // Reset team-only state when leaving team scope.
  useEffect(() => {
    if (scope === 'mine') {
      if (selectedRepIds.length) setSelectedRepIds([])
      if (reps.length) setReps([])
    }
  }, [scope, selectedRepIds.length, reps.length])

  // Category visibility is a pure display toggle; KPIs stay on the server summary.
  const visibleEvents = useMemo(
    () => allEvents.filter(e => selectedCategories.includes(e.extendedProps.category)),
    [allEvents, selectedCategories]
  )

  const counts = useMemo<Record<CalendarCategory, number>>(() => {
    const c = { PLANNED: 0, COMPLETED: 0, MISSED: 0, ATTENDANCE: 0 }
    if (summary) {
      for (const category of CALENDAR_CATEGORIES) {
        c[category] = summary[CALENDAR_CATEGORY_SUMMARY_KEY[category]] as number
      }
    }
    return c
  }, [summary])

  const coveragePct = summary?.coveragePct ?? null

  const toggleCategory = useCallback((category: CalendarCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }, [])

  const toggleAllCategories = useCallback((checked: boolean) => {
    setSelectedCategories(checked ? [...CALENDAR_CATEGORIES] : [])
  }, [])

  const handleLeftSidebarToggle = useCallback(() => setLeftSidebarOpen(prev => !prev), [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setDetailEvent(event)
    setDetailOpen(true)
  }, [])

  return (
    <>
      <CalendarFilterSidebar
        mdAbove={mdAbove}
        leftSidebarOpen={leftSidebarOpen}
        selectedCategories={selectedCategories}
        calendarApi={calendarApi}
        handleLeftSidebarToggle={handleLeftSidebarToggle}
        toggleCategory={toggleCategory}
        toggleAllCategories={toggleAllCategories}
      />
      <div className='p-6 pbs-0 grow overflow-visible bs-full'>
        <Box sx={{ minHeight: 4, mbe: 2 }}>{loading && <LinearProgress />}</Box>

        <Box className='flex flex-wrap items-center justify-between gap-3' sx={{ mbe: 4 }}>
          <Box className='flex flex-wrap items-center gap-3'>
            {canSeeTeam && (
              <ToggleButtonGroup
                exclusive
                size='small'
                value={scope}
                onChange={(_, value) => value && setScope(value as CalendarScope)}
              >
                <ToggleButton value='mine'>My calendar</ToggleButton>
                <ToggleButton value='team'>Team</ToggleButton>
              </ToggleButtonGroup>
            )}
            {scope === 'team' && reps.length > 0 && (
              <CustomTextField
                select
                size='small'
                label='Reps'
                value={selectedRepIds}
                slotProps={{
                  select: {
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (selected: unknown) => {
                      const arr = selected as string[]
                      if (!arr.length) return 'All reps'
                      return `${arr.length} selected`
                    },
                    onChange: e => setSelectedRepIds(e.target.value as unknown as string[])
                  }
                }}
                sx={{ minInlineSize: 180 }}
              >
                {reps.map(r => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            )}
          </Box>

          <Box className='flex flex-wrap items-center gap-2'>
            {CALENDAR_CATEGORIES.map(category => (
              <Chip
                key={category}
                size='small'
                variant='tonal'
                color={CALENDAR_CATEGORY_COLOR[category]}
                label={`${CALENDAR_CATEGORY_LABEL[category]}: ${counts[category]}`}
              />
            ))}
            {coveragePct !== null && (
              <Chip size='small' variant='tonal' color='info' label={`Coverage: ${coveragePct}%`} />
            )}
          </Box>
        </Box>

        <CalendarGrid
          events={visibleEvents}
          setCalendarApi={setCalendarApi}
          onEventClick={handleEventClick}
          onDatesSet={handleDatesSet}
          handleLeftSidebarToggle={handleLeftSidebarToggle}
        />
      </div>
      <EventDetailsDrawer open={detailOpen} event={detailEvent} onClose={() => setDetailOpen(false)} />
    </>
  )
}

export default CalendarView
