/** Extract payload from ApiResponse-style axios responses (no API changes). */
export function apiPayload<T = unknown>(res: { data?: unknown }): T {
  const d = res?.data as { data?: T } | T | undefined
  if (d && typeof d === 'object' && 'data' in d && (d as { data?: T }).data !== undefined) {
    return (d as { data: T }).data
  }
  return d as T
}

export const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const formatDate = (d: string | Date | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Open POs: active purchasing (not closed / cancelled). */
export function countOpenPurchaseOrders(rows: { status?: string }[]) {
  return rows.filter(r => !['CLOSED', 'CANCELLED'].includes(String(r.status || ''))).length
}

export function countPendingGrns(rows: { status?: string }[]) {
  return rows.filter(r => r.status === 'DRAFT').length
}

export function countDraftInvoices(rows: { status?: string }[]) {
  return rows.filter(r => r.status === 'DRAFT').length
}
