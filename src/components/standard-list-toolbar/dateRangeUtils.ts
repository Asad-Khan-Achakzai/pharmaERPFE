export type DateUserFilterState = { from: string; to: string; createdBy: string }

export const emptyDateUserFilters: DateUserFilterState = { from: '', to: '', createdBy: '' }

export function countDateUserFilters(f: DateUserFilterState): number {
  let n = 0
  if (f.from || f.to) n += 1
  if (f.createdBy) n += 1
  return n
}

export function toLocalDayStartIso(ymd: string): string | null {
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const [y, m, d] = parts
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

export function toLocalDayEndIso(ymd: string): string | null {
  const parts = ymd.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const [y, m, d] = parts
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}

export function formatRangeDisplay(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

export function formatYyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYyyyMmDd(s: string): Date | null {
  if (!s) return null
  const parts = s.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  return Number.isNaN(d.getTime()) ? null : d
}

export function appendDateUserParams(
  params: Record<string, string>,
  applied: DateUserFilterState,
  debouncedSearch: string
) {
  if (applied.from) {
    const iso = toLocalDayStartIso(applied.from)
    if (iso) params.from = iso
  }
  if (applied.to) {
    const iso = toLocalDayEndIso(applied.to)
    if (iso) params.to = iso
  }
  if (applied.createdBy) params.createdBy = applied.createdBy
  if (debouncedSearch) params.search = debouncedSearch
}
