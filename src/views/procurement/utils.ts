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

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '')

export type PrintPartyInfo = {
  name: string
  logoUrl?: string | null
  addressLines: string[]
  phones: string[]
  email?: string
  ntnNo?: string
  notes?: string
}

export function printLogoSrc(logo?: string | null, logoDataUrl?: string | null): string | null {
  if (logoDataUrl?.startsWith('data:image/')) return logoDataUrl
  if (!logo) return null
  if (logo.startsWith('data:') || /^https?:\/\//i.test(logo)) return logo
  if (logo.startsWith('/')) return `${API_ORIGIN}${logo}`
  return logo
}

export function partyAddressLines(p: {
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
}): string[] {
  const cityState = [p.city, p.state].filter(Boolean).join(', ')
  return [p.address, cityState, p.country].map(s => String(s || '').trim()).filter(Boolean)
}

export function buildPrintParty(
  p: {
    name?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    phone?: string | null
    phones?: string[] | null
    email?: string | null
    logo?: string | null
    logoDataUrl?: string | null
    ntnNo?: string | null
    notes?: string | null
  } | null | undefined,
  fallbackName = '—'
): PrintPartyInfo {
  if (!p) {
    return { name: fallbackName, addressLines: [], phones: [] }
  }
  const phones =
    Array.isArray(p.phones) && p.phones.length
      ? p.phones.map(n => String(n || '').trim()).filter(Boolean)
      : p.phone
        ? [String(p.phone).trim()].filter(Boolean)
        : []
  return {
    name: p.name?.trim() || fallbackName,
    logoUrl: printLogoSrc(p.logo, p.logoDataUrl),
    addressLines: partyAddressLines(p),
    phones,
    email: p.email?.trim() || undefined,
    ntnNo: p.ntnNo?.trim() || undefined,
    notes: p.notes?.trim() || undefined
  }
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
