// Type Imports
import type { ThemeColor } from '@core/types'

/**
 * Calendar categories are derived from existing field-execution state.
 * The calendar is a read-only visual layer; it never authors business records.
 */
export type CalendarCategory = 'PLANNED' | 'COMPLETED' | 'MISSED' | 'ATTENDANCE'

export const CALENDAR_CATEGORIES: CalendarCategory[] = ['PLANNED', 'COMPLETED', 'MISSED', 'ATTENDANCE']

export const CALENDAR_CATEGORY_LABEL: Record<CalendarCategory, string> = {
  PLANNED: 'Planned visits',
  COMPLETED: 'Completed visits',
  MISSED: 'Missed visits',
  ATTENDANCE: 'Attendance'
}

/** Category → MUI ThemeColor → `event-bg-{color}` class (see AppFullCalendar styles). */
export const CALENDAR_CATEGORY_COLOR: Record<CalendarCategory, ThemeColor> = {
  PLANNED: 'primary',
  COMPLETED: 'success',
  MISSED: 'error',
  ATTENDANCE: 'secondary'
}

/** Manager scope: personal calendar vs the reporting subtree (team oversight). */
export type CalendarScope = 'mine' | 'team'

export type CalendarSourceType = 'PLAN_ITEM' | 'ATTENDANCE'

/**
 * Structural classification of an event (req. 6). Assigned once, server-side:
 *   POINT   — point-in-time activity (plan item / visit)
 *   DERIVED — computed day context (attendance)
 */
export type CalendarEventClass = 'POINT' | 'DERIVED'

export interface CalendarEventExtendedProps {
  category: CalendarCategory
  eventClass: CalendarEventClass
  sourceType: CalendarSourceType
  /** Raw backend status (e.g. PENDING / VISITED / MISSED / PRESENT). */
  status: string
  statusLabel: string
  /** Secondary line for the details drawer (doctor location, check-in time, etc.). */
  subtitle?: string
  /** Existing screen the event deep-links to (read-only calendar acts only via deep links). */
  deepLink?: string
  /** Owning rep (team / oversight views) — used for grouping and the rep filter. */
  repId?: string
  repName?: string
  /** Extra read-only key/value details rendered in the drawer. */
  details?: Array<{ label: string; value: string }>
}

/** FullCalendar `EventInput`-compatible, read-only event projected from existing data. */
export interface CalendarEvent {
  id: string
  title: string
  /** YYYY-MM-DD (all-day) to match the rest of the app's local-date convention. */
  start: string
  end?: string
  allDay: boolean
  extendedProps: CalendarEventExtendedProps
}

/** Reporting rep entry for the team-scope filter (derived server-side). */
export interface CalendarRep {
  id: string
  name: string
}

/**
 * KPI summary for the loaded scope + range, computed by the single backend engine
 * (req. 3). The UI must render these values and never recompute them.
 */
export interface CalendarSummary {
  planned: number
  completed: number
  missed: number
  attendance: number
  coveragePct: number | null
}

/** Full read-only payload returned by GET /calendar/events. */
export interface CalendarPayload {
  events: CalendarEvent[]
  summary: CalendarSummary
  reps: CalendarRep[]
  scope: CalendarScope
  range: { from: string; to: string }
}

/** Maps a category to the matching summary count (single interpretation across views). */
export const CALENDAR_CATEGORY_SUMMARY_KEY: Record<CalendarCategory, keyof CalendarSummary> = {
  PLANNED: 'planned',
  COMPLETED: 'completed',
  MISSED: 'missed',
  ATTENDANCE: 'attendance'
}
