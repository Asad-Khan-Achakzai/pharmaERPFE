export type SalesMovementTp = {
  grossDeliveriesTp: number
  returnsCurrentPeriodTp: number
  returnsPriorPeriodTp: number
  amendmentsCurrentPeriodTp: number
  amendmentsPriorPeriodTp: number
  returnsUnclassifiedTp: number
  amendmentsUnclassifiedTp: number
  netTpSales: number
}

export type DashboardReconciliationReason = {
  code: 'FULLY_CREDITED_ORDERS' | 'SOFT_DELETED_EXCLUDED' | 'LEGACY_UNCLASSIFIED' | 'OTHER' | string
  label: string
  tpImpact: number
  orderCount?: number
}

export type DashboardReconciliation = {
  netTpSales: number
  dashboardTp: number
  difference: number
  status: 'MATCHED' | 'EXPLAINED_DIFFERENCE' | string
  reasons: DashboardReconciliationReason[]
  fullyCredited: {
    orderCount: number
    excludedDeliveryTp: number
    excludedReturnTp: number
    excludedAmendmentTp: number
    netExcludedImpact: number
  }
}

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
  salesMovement?: SalesMovementTp
  dashboardReconciliation?: DashboardReconciliation
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
    salesMovementIdentity?: string
    dateBasis?: Record<string, string>
    notes?: string[]
    legacyUnclassifiedCount?: number
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
  amendedPacks?: number
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
    amendedPacks?: number
  }
}

export type TpEventsBucket =
  | 'grossDeliveries'
  | 'returnsCurrentPeriod'
  | 'returnsPriorPeriod'
  | 'amendmentsCurrentPeriod'
  | 'amendmentsPriorPeriod'
  | 'netTpSales'
  | 'dashboardExclusion'

export type TpEventRow = {
  eventType: 'DELIVERY' | 'RETURN' | 'AMENDMENT' | string
  eventId: string
  eventAt: string
  eventYm: string
  orderId: string
  orderNumber: string
  invoiceNumber: string
  orderStatus: string
  medicalRepId: string | null
  medicalRepName: string
  pharmacyId: string | null
  pharmacyName: string
  sourceDeliveredAt: string | null
  sourceDeliveryYm: string | null
  classification: string
  packs: number
  productCount: number
  productsLabel: string
  tpAmount: number
  customerNet: number
  companyShare: number
  amendmentNumber?: string
}

export type TpEventsResponse = {
  month: string
  monthLabel: string
  bucket: TpEventsBucket | string
  summary: {
    totalTp: number
    orderCount: number
    invoiceCount: number
    packCount: number
    productCount: number
  }
  filtersApplied: Record<string, string | null>
  rows: TpEventRow[]
  page: number
  limit: number
  totalCount: number
  totals: { tpAmount: number }
}
