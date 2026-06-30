import { parseYyyyMmDd } from '@/utils/dateLocal'

/** Aligns with backend CP_DAY_KEYS / Luxon weekday. */
export const CP_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const

export type CpDayKey = (typeof CP_DAY_KEYS)[number]

export type CpByDay = Partial<Record<CpDayKey, string | null>>

/** JS getDay(): 0=Sun..6=Sat → CP_DAY_KEYS (Mon-first). */
export const dayKeyForDate = (d: Date): CpDayKey => {
  const js = d.getDay()
  return CP_DAY_KEYS[(js + 6) % 7]
}

export type PlanDay = { ymd: string; date: Date; dayKey: CpDayKey; label: string }

/** Enumerate each calendar day in [start, end] (inclusive) as { ymd, dayKey, label }. */
export const enumeratePlanDays = (startYmd: string, endYmd: string): PlanDay[] => {
  const start = parseYyyyMmDd(startYmd)
  const end = parseYyyyMmDd(endYmd)
  if (!start || !end || end < start) return []
  const out: PlanDay[] = []
  const cursor = new Date(start)
  let guard = 0
  while (cursor <= end && guard < 31) {
    const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate()
    ).padStart(2, '0')}`
    out.push({
      ymd,
      date: new Date(cursor),
      dayKey: dayKeyForDate(cursor),
      label: cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    })
    cursor.setDate(cursor.getDate() + 1)
    guard += 1
  }
  return out
}

/** Normalize a populated/raw plan.cpByDay into { dayKey: cpId } ids only. */
export const cpByDayToIds = (raw: any): CpByDay => {
  const out: CpByDay = {}
  if (!raw) return out
  for (const key of CP_DAY_KEYS) {
    const val = raw[key]
    if (!val) continue
    out[key] = typeof val === 'object' ? String(val._id) : String(val)
  }
  return out
}
