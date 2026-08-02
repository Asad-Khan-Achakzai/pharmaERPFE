/** Business-facing labels for tax configuration UI (never show raw codes to accountants by default). */

export const TAX_TYPE_LABELS: Record<string, string> = {
  ADVANCE_TAX_236H: 'Advance Tax (Section 236H)',
  VAT: 'VAT',
  GST: 'GST',
  WHT: 'Withholding Tax',
  ENVIRONMENTAL: 'Environmental Tax'
}

export const CALCULATION_BASE_LABELS: Record<string, string> = {
  GROSS_AMOUNT: 'Gross amount',
  SUBTOTAL: 'Subtotal',
  AFTER_DISCOUNT: 'After discount',
  NET_PAYABLE: 'Net payable',
  BEFORE_TAX_TYPE: 'Before another tax',
  AFTER_TAX_TYPE: 'After another tax',
  CUSTOM: 'Custom base'
}

export const TAX_STATUS_LABELS: Record<string, string> = {
  FILER: 'Filer',
  NON_FILER: 'Non-Filer',
  UNKNOWN: 'Not set',
  NOT_APPLICABLE: 'Not applicable'
}

export const REGISTER_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  INCLUDED_IN_DEPOSIT: 'Included in Deposit',
  REMITTED: 'Remitted',
  ADJUSTED: 'Adjusted',
  REVERSED: 'Reversed',
  CLEARED: 'Remitted',
  PARTIALLY_CLEARED: 'Remitted',
  VOID: 'Cancelled'
}

export const REGISTER_STATUS_COLORS: Record<
  string,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  OPEN: 'info',
  INCLUDED_IN_DEPOSIT: 'warning',
  REMITTED: 'success',
  ADJUSTED: 'secondary',
  REVERSED: 'default',
  CLEARED: 'success',
  PARTIALLY_CLEARED: 'success',
  VOID: 'error'
}

export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CLOSED: 'Submitted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed'
}

export const DEPOSIT_STATUS_COLORS: Record<
  string,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  DRAFT: 'warning',
  SUBMITTED: 'success',
  CLOSED: 'success',
  CANCELLED: 'default',
  REVERSED: 'error'
}

export const AVAILABLE_TAX_TYPES = [
  { code: 'ADVANCE_TAX_236H', label: TAX_TYPE_LABELS.ADVANCE_TAX_236H, section: '236H' },
  { code: 'GST', label: TAX_TYPE_LABELS.GST, section: 'GST' },
  { code: 'VAT', label: TAX_TYPE_LABELS.VAT, section: 'VAT' },
  { code: 'WHT', label: TAX_TYPE_LABELS.WHT, section: 'WHT' },
  { code: 'ENVIRONMENTAL', label: TAX_TYPE_LABELS.ENVIRONMENTAL, section: 'ENV' }
] as const

export const DEFAULT_LIABILITY_BY_TYPE: Record<string, string> = {
  ADVANCE_TAX_236H: '2140',
  GST: '2150',
  VAT: '2150',
  WHT: '2160',
  ENVIRONMENTAL: '2170'
}

export const taxTypeLabel = (code?: string) =>
  (code && TAX_TYPE_LABELS[code]) || code || 'Tax'

export const calculationBaseLabel = (base?: string) =>
  (base && CALCULATION_BASE_LABELS[base]) || base || '—'

export const taxStatusLabel = (status?: string) =>
  (status && TAX_STATUS_LABELS[status]) || status || '—'

export const registerStatusLabel = (status?: string, fallback?: string) =>
  fallback || (status && REGISTER_STATUS_LABELS[status]) || status || '—'

export const depositStatusLabel = (status?: string) =>
  (status && DEPOSIT_STATUS_LABELS[status]) || status || '—'

export const formatMoney = (amount: number, currency = 'PKR') => {
  const n = Number(amount) || 0
  return `${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export const formatDate = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
