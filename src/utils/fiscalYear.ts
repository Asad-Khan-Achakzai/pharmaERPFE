/** Fiscal year runs August → July. Returns the start calendar year (e.g. 2025 for 2025-2026). */
export const currentFiscalYearStart = (ref = new Date()) => {
  const m = ref.getMonth() // 0-indexed; August = 7
  const y = ref.getFullYear()
  return m >= 7 ? y : y - 1
}

export const fiscalYearLabel = (startYear: number) => `${startYear}-${startYear + 1}`

export const fiscalYearOptions = (count = 6, ref = new Date()) => {
  const current = currentFiscalYearStart(ref)
  return Array.from({ length: count }, (_, i) => {
    const y = current - i
    return { value: y, label: fiscalYearLabel(y) }
  })
}
