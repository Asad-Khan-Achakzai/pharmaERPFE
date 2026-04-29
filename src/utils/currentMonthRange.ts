import type { KpiDateRange } from '@/types/dashboardKpi'

/** Local calendar month as YYYY-MM-DD pair (matches dashboard /reports `from`+`to`). */
export function currentMonthRange(): KpiDateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0)
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { from, to }
}
