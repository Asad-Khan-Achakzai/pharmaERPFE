/** Maps internal ledger reference types to business-friendly labels (UI only). */
export const REFERENCE_TYPE_LABEL: Record<string, string> = {
  DELIVERY: 'Sales invoice',
  COLLECTION: 'Payment received',
  RETURN: 'Sales return',
  ORDER: 'Order',
  PAYMENT: 'Payment (legacy)',
  SETTLEMENT: 'Settlement',
  RETURN_CLEARING_ADJ: 'Clearing adjustment',
  ADJUSTMENT: 'Adjustment',
  OPENING: 'Opening balance'
}

export const labelForReferenceType = (ref: string) => REFERENCE_TYPE_LABEL[ref] || ref

export const lineStatusLabel = (row: { type: string; referenceType: string }) => {
  if (row.type === 'DEBIT' && row.referenceType === 'DELIVERY') return 'Invoiced'
  if (row.type === 'CREDIT' && row.referenceType === 'COLLECTION') return 'Paid'
  if (row.type === 'CREDIT' && row.referenceType === 'RETURN') return 'Credited'
  return 'Posted'
}
