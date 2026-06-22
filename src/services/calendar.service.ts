/**
 * Calendar service (thin client).
 *
 * The web Calendar Module is a READ-ONLY visual layer. All aggregation, event
 * transformation, deterministic state resolution, classification and KPI logic
 * lives in ONE place: the backend calendar engine (GET /calendar/events).
 *
 * This module only issues the request and returns the typed payload. It contains
 * no business logic and no per-source transformation — that keeps every calendar
 * view (Day / Week / Month / Team) on a single, consistent interpretation of the
 * data and removes the previous client-side N+1 fetching.
 */
import api from './api'
import type { CalendarPayload, CalendarScope, CalendarSummary } from '@/types/calendar'

export interface FetchCalendarParams {
  /** Inclusive visible range, YYYY-MM-DD. */
  rangeStartYmd: string
  rangeEndYmd: string
  /** 'mine' = personal calendar; 'team' = reporting subtree (manager oversight). */
  scope?: CalendarScope
  /** Optional rep narrowing for team scope — keeps KPIs aligned with the filter. */
  repIds?: string[]
}

const EMPTY_SUMMARY: CalendarSummary = {
  planned: 0,
  completed: 0,
  missed: 0,
  attendance: 0,
  coveragePct: null
}

function emptyPayload(scope: CalendarScope, from: string, to: string): CalendarPayload {
  return { events: [], summary: { ...EMPTY_SUMMARY }, reps: [], scope, range: { from, to } }
}

/**
 * Fetch the aggregated, read-only calendar payload for a range and scope.
 * Returns events, the KPI summary and the rep directory in a single round-trip.
 */
export async function fetchCalendar(params: FetchCalendarParams): Promise<CalendarPayload> {
  const { rangeStartYmd, rangeEndYmd, scope = 'mine', repIds = [] } = params

  const res = await api.get('/calendar/events', {
    params: {
      from: rangeStartYmd,
      to: rangeEndYmd,
      scope,
      ...(repIds.length ? { repIds: repIds.join(',') } : {})
    }
  })

  const body = res?.data as { data?: CalendarPayload } | undefined
  const payload = body?.data

  if (!payload || !Array.isArray(payload.events)) {
    return emptyPayload(scope, rangeStartYmd, rangeEndYmd)
  }

  return {
    events: payload.events,
    summary: { ...EMPTY_SUMMARY, ...payload.summary },
    reps: Array.isArray(payload.reps) ? payload.reps : [],
    scope: payload.scope || scope,
    range: payload.range || { from: rangeStartYmd, to: rangeEndYmd }
  }
}
