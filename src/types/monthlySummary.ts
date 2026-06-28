export type MonthlySummaryRow = {
  month: string
  monthLabel: string
  netSales: number
  distribution: number
  discount: number
  castingCost: number
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

export type MonthlySummaryProductPackRow = {
  productId: string
  productName: string
  composition: string
  deliveredPacks: number
  paidPacks: number
  bonusPacks: number
  returnedPacks: number
  netPacks: number
}

export type MonthlySummaryProductPacksResponse = {
  month: string
  monthLabel: string
  rows: MonthlySummaryProductPackRow[]
  totals: {
    netPacks: number
    paidPacks: number
    bonusPacks: number
    returnedPacks: number
  }
}
