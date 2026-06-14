export type MonthlySummaryRow = {
  month: string
  monthLabel: string
  netSales: number
  distribution: number
  discount: number
  stockPurchaseExpenses: number
  expenses: number
  pl: number
  marketing: number
}

export type MonthlySummaryResponse = {
  fiscalYearLabel: string
  fiscalYearStart: number
  period: { from: string; to: string }
  monthKeys: string[]
  rows: MonthlySummaryRow[]
  totals: MonthlySummaryRow
  meta?: {
    plFormula?: string
    dateBasis?: Record<string, string>
    notes?: string[]
  }
}
