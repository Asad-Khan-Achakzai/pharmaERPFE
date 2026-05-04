/** GET /plan-items/today — execution bundle (sorted items, next visit, summary). */

export type TodayExecutionSummary = {
  total: number
  visited: number
  missed: number
  pending: number
  progressPercent: number
}

export type TodayEndOfDayPreview = {
  visited: number
  missed: number
  coveragePercent: number
  outOfSequenceCount: number
  unplannedCompletedCount: number
  dayComplete: boolean
}

export type TodayExecutionPayload = {
  date: string
  summary: TodayExecutionSummary
  dayExecutionState: string
  nextPlanItem: unknown | null
  endOfDayPreview?: TodayEndOfDayPreview
  items: unknown[]
}

export function parseTodayExecutionResponse(res: { data?: { data?: unknown } }): TodayExecutionPayload | null {
  const raw = res?.data?.data
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const items = raw
    const visited = items.filter((x: any) => x?.status === 'VISITED').length
    const missed = items.filter((x: any) => x?.status === 'MISSED').length
    const pending = items.filter((x: any) => x?.status === 'PENDING').length
    const total = items.length
    const progressPercent = total ? Math.round(((visited + missed) / total) * 100) : 0
    const nextPlanItem = items.find((x: any) => x?.status === 'PENDING') ?? null
    return {
      date: '',
      summary: { total, visited, missed, pending, progressPercent },
      dayExecutionState: pending === total ? 'NOT_STARTED' : pending === 0 ? 'COMPLETED' : 'IN_PROGRESS',
      nextPlanItem,
      items
    }
  }
  const p = raw as Partial<TodayExecutionPayload>
  if (!Array.isArray(p.items)) return null
  const items = p.items
  let summary = p.summary as TodayExecutionSummary | undefined
  if (!summary || typeof summary.total !== 'number') {
    const visited = items.filter((x: any) => x?.status === 'VISITED').length
    const missed = items.filter((x: any) => x?.status === 'MISSED').length
    const pending = items.filter((x: any) => x?.status === 'PENDING').length
    const total = items.length
    summary = {
      total,
      visited,
      missed,
      pending,
      progressPercent: total ? Math.round(((visited + missed) / total) * 100) : 0
    }
  }
  return {
    date: String(p.date || ''),
    summary,
    dayExecutionState: String(p.dayExecutionState || ''),
    nextPlanItem: p.nextPlanItem ?? null,
    endOfDayPreview: p.endOfDayPreview,
    items
  }
}

/** First pending id in route order — mirrors backend nextPlanItem. */
export function getNextPlanItemId(bundle: TodayExecutionPayload | null): string | null {
  if (!bundle?.nextPlanItem || typeof bundle.nextPlanItem !== 'object') return null
  const id = (bundle.nextPlanItem as { _id?: unknown })._id
  return id != null ? String(id) : null
}
