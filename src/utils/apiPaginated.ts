/**
 * Normalizes our Express paginated JSON (`{ data: T[], pagination }`) and axios wrapper.
 * Works even if `data` is nested differently in edge cases.
 */
export function extractPaginatedList<T>(axiosResponse: { data?: unknown } | null | undefined): T[] {
  const body = axiosResponse?.data
  if (body == null) return []
  if (typeof body !== 'object') return []
  const raw = body as { data?: unknown }
  const inner = raw.data
  if (Array.isArray(inner)) return inner as T[]
  if (Array.isArray(body)) return body as T[]
  return []
}
