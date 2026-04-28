import { toast } from 'react-toastify'
import { getApiErrorMessage } from '@/utils/apiErrors'

/**
 * Maps common API / validation strings to short, user-facing copy for the procurement hub only.
 * Does not change API behavior — only how errors are displayed.
 */
function mapBackendMessage(raw: string, fallback: string): string {
  const t = raw.trim()
  if (!t) return fallback

  const lower = t.toLowerCase()

  if (/cannot read propert|cannot read properties|typeerror|referenceerror/i.test(t)) {
    return 'Something went wrong. Please try again.'
  }
  if (/network error|econnrefused|failed to fetch|load failed/i.test(lower)) {
    return 'Unable to connect. Check your connection and try again.'
  }
  if (/supplierid.*required|\"supplierid\".*required|supplier id.*required/i.test(lower)) {
    return 'Please select a supplier.'
  }
  if (
    /purchaseorderid.*required|\"purchaseorderid\".*required|purchase order id.*required/i.test(lower)
  ) {
    return 'Please select a supplier order.'
  }
  if (/productid.*required|\"productid\".*required/i.test(lower)) {
    return 'Please select a product on each line.'
  }
  if (/distributorid.*required|\"distributorid\".*required/i.test(lower)) {
    return 'Choose where stock goes (distributor) on each line that has quantity.'
  }
  if (/orderedqty|ordered qty/i.test(lower) && /positive|required|must/.test(lower)) {
    return 'Enter a valid order quantity on each line.'
  }
  if (/qtyreceived|qty received|quantity received/i.test(lower) && /positive|must/.test(lower)) {
    return 'Enter a valid received quantity on each line.'
  }
  if (/unitprice|unit price/i.test(lower) && /non-negative|required|must/.test(lower)) {
    return 'Enter a valid unit price on each line.'
  }
  if (/unitcost|unit cost/i.test(lower) && /non-negative|required|must/.test(lower)) {
    return 'Enter a valid unit cost on each line.'
  }
  if (/at least one line|lines.*contain|array must contain|\\"lines\\".*min/i.test(lower)) {
    return 'Add at least one line item.'
  }
  if (/only draft.*supplier|only draft.*purchase order|edited/i.test(lower) && /draft/i.test(lower)) {
    return 'Only draft supplier orders can be edited.'
  }
  if (/only draft.*goods receipt|only draft goods/i.test(lower)) {
    return 'Only draft receipts can be edited.'
  }
  if (/only draft.*approved|approve.*draft/i.test(lower)) {
    return 'Only draft supplier orders can be approved.'
  }
  if (/not available for receiving|no longer accepts|purchase order.*receiving/i.test(lower)) {
    return 'This supplier order cannot receive goods in its current status.'
  }
  if (/exceed.*ordered|would exceed/i.test(lower)) {
    return 'Received quantity cannot exceed what was ordered on that line.'
  }
  if (/post.*first|posted receipts only|link posted/i.test(lower)) {
    return 'Post the receipt first, then link it from supplier invoice.'
  }
  if (/401|403|unauthorized|forbidden|permission/i.test(lower)) {
    return 'You do not have permission to do that.'
  }
  if (/validationerror|validation failed|invalid input|bad request/i.test(lower)) {
    return 'Please check your entries and try again.'
  }

  if (t.length > 200 || /\s+at\s+[\w.]+\s+\(/i.test(t)) {
    return fallback
  }

  return t
}

export function procurementFriendlyMessage(error: unknown, fallback: string): string {
  if (error === null || error === undefined) {
    return fallback
  }
  const raw = getApiErrorMessage(error, fallback)
  return mapBackendMessage(raw, fallback)
}

export function procurementShowError(error: unknown, fallback: string) {
  toast.error(procurementFriendlyMessage(error, fallback))
}
