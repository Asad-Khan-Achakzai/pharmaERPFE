/**
 * Canonical financial display names (SAP/Odoo-style). Values/bindings stay on API field names.
 */

export const FIN_LAYERS = {
  sales: 'Sales Layer',
  cost: 'Cost Layer',
  profit: 'Profit Layer'
} as const

export const FIN_LABELS = {
  grossSalesTp: 'Gross Sales (TP)',
  pharmacyDiscount: 'Pharmacy discount',
  netSalesCustomer: 'Net Sales (Customer)',
  netSalesCompany: 'Net Sales (Company)',
  distributorCommission: 'Distributor commission (on Gross Sales TP)',
  standardCostCatalog: 'Standard Cost (Catalog)',
  estimatedCostStandard: 'Estimated Cost (Standard)',
  inventoryCostAvg: 'Inventory Cost (Avg)',
  inventoryCostAvgCogs: 'Inventory Cost (Avg) — COGS',
  totalInventoryValue: 'Total inventory value (at cost)',
  salesMarginCustomerBasis: 'Sales Margin (Customer Basis)',
  grossProfitCompany: 'Gross Profit (Company)',
  estimatedGrossProfitCompany: 'Estimated Gross Profit (Company)',
  netProfitLifetime: 'Net profit (lifetime)',
  netProfitPeriod: 'Net profit (period)',
  netSalesCustomerCumulative: 'Net Sales (Customer) — cumulative',
  netSalesCompanyCumulative: 'Net Sales (Company) — cumulative',
  grossSalesTpCumulative: 'Gross Sales (TP) — cumulative (deliveries)',
  totalCostsPeriod: 'Total costs (period)',
  profitMarginPct: 'Net profit margin %',
  collectedLifetime: 'Collected (lifetime)',
  outstandingPharmacies: 'Outstanding (pharmacies)'
} as const

export const FIN_TOOLTIPS = {
  customerVsCompany:
    'Net Sales (Customer) is what the pharmacy pays on the invoice (Gross Sales TP minus pharmacy discount). Net Sales (Company) is what accrues to the company after distributor commission. Commission is calculated on Gross Sales (TP), not on Net Sales (Customer).',
  bonusCostVsRevenue:
    'Bonus units may carry zero Gross Sales (TP) in a delivery batch but still consume stock. Estimated Cost (Standard) uses paid + bonus units; Inventory Cost (Avg) applies to every unit shipped.',
  standardVsAvg:
    'Standard Cost (Catalog) is the product master rate used for planning. Inventory Cost (Avg) is weighted average landed cost in distributor stock, including receipt/transfer allocations.',
  estimatedGrossProfitCompany:
    'Net Sales (Company) for the order minus extended Inventory Cost (Avg) on delivered or paid quantity. Confirmed margins are on each delivery record.',
  salesMarginCustomerBasis:
    'From posted sale/return transactions: Net Sales (Customer) basis minus COGS (same basis as backend Transaction.profit).',
  grossProfitCompanyLine:
    'Net Sales (Company) for the line or SKU minus Inventory Cost (Avg) — COGS, where the report uses company-share revenue.',
  dashboardTotals:
    'Gross Sales (TP) and Net Sales (Company) sum delivery records (returns reduce company share when return lines store companyShare). Net Sales (Customer) — cumulative matches posted transactions.',
  netProfitLifetime:
    'Sum of transaction margins minus distributor commission, paid payroll, and non-salary expenses (all-time, not period-scoped).',
  castingUnit: 'Catalog standard cost per unit from product master.',
  deliveryAmount:
    'Net Sales (Customer) for this delivery (pharmacy invoice net). Sales Margin uses posted transaction logic.',
  deliveryProfit: 'Sales Margin (Customer Basis) for this delivery total.'
} as const
