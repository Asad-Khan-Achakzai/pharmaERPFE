export type PlatformRange = {
  days: number
  from: string
  to: string
  previousFrom: string
  previousTo: string
} | null

export type PlatformTotals = {
  revenue: number
  orders: number
  receivablesFromPharmacy: number
  distributorOwedToCompany: number
  companiesCount: number
}

export type CompanyHealth = 'healthy' | 'warning'

export type PlatformCompanyRow = {
  companyId: string
  name: string
  city?: string
  isActive: boolean
  period: {
    revenue: number
    orders: number
    receivablesFromPharmacy: number
    distributorOwedToCompany: number
  }
  previous: { revenue: number; orders: number }
  health: CompanyHealth
  shareOfRevenue: number
}

export type PlatformDashboardPayload = {
  range: PlatformRange
  totals: PlatformTotals
  previousTotals: { revenue: number; orders: number }
  companies: PlatformCompanyRow[]
  revenueByDay: {
    dates: string[]
    byCompany: Record<string, number[]>
    totals: number[]
  }
  allCompanyIds: string[]
}
