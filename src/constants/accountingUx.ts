/**
 * Business-friendly labels for the accounting module.
 * Backend terms (GL, COA, JV, debit/credit) stay in API/models — UI uses these.
 */

export const ACCOUNTING_UX = {
  /** Navigation & section titles */
  financeHub: 'Money & Business',
  advancedAccounting: 'Advanced Accounting',
  financialStructure: 'Financial Structure',
  advancedFinancialStructure: 'Advanced Financial Structure',
  moneyAccounts: 'Money Accounts',
  financialActivity: 'Financial Activity',
  usableAccount: 'Usable Account',
  categoryFolder: 'Category Folder',
  addAccount: 'Add Account',
  addMoneyAccount: 'Add Money Account',
  createAccount: 'Create Account',
  accountantMode: 'Accountant Mode',
  simpleModeHint: 'Pick what you want to track — we handle the accounting setup automatically.',
  expenseCategories: 'Expense Categories',
  incomeCategories: 'Income Categories',
  inventoryAssets: 'Inventory & Assets',
  transactions: 'Financial Activity',
  newTransaction: 'New Entry',
  manualTransactionAdvanced: 'Manual Entry (Accountant)',
  accountHistory: 'General Ledger',
  clientLedger: 'Client Ledger',
  supplierLedger: 'Supplier Ledger',
  expenseLedger: 'Expense Ledger',
  activityLedger: 'Activity Ledger',
  employeeLedger: 'Employee Ledger',
  financialSummaryCheck: 'Financial Summary Check',
  businessPositionReport: 'Business Position Report',
  profitReport: 'Profit Report',
  dailyActivity: 'Daily Activity',
  cashActivity: 'Cash Activity',
  bankActivity: 'Bank Activity',
  transferMoney: 'Voucher Entry',
  customerBalances: 'Customer Balances',

  /** Business action labels */
  receivePayment: 'Receive Payment',
  recordExpense: 'Record Expense',
  createSale: 'Create Sale',
  paySupplier: 'Pay Supplier',
  allPayments: 'All Payments Received',
  allExpenses: 'All Expenses',

  /** Dashboard KPIs */
  cashAvailable: 'Cash Available',
  bankBalance: 'Bank Balance',
  moneyOwedToYou: 'Money Owed to You',
  moneyYouOwe: 'Money You Owe',
  monthlySales: 'Sales This Month',
  monthlyProfit: 'Profit This Month',

  /** Hints for non-finance users */
  autoAccountingHint: 'Accounting is handled automatically — you only need to record the business action.',
  accountantOnlyHint: 'This screen is for accountants and administrators.',
  transferHint: 'Move money between your cash and bank accounts.',
  noDebitCreditNeeded: 'Enter amounts in plain language — no accounting knowledge required.',
  doctorActivityInvestment: 'Doctor activity investment'
} as const

/** Friendly labels for voucher sourceModule (Financial Activity list). */
export const VOUCHER_SOURCE_LABELS: Record<string, string> = {
  ORDER: 'Sale / return',
  COLLECTION: 'Payment received',
  SETTLEMENT: 'Settlement',
  EXPENSE: 'Expense',
  DOCTOR_ACTIVITY: 'Doctor activity',
  SUPPLIER: 'Supplier payment',
  PROCUREMENT: 'Purchase',
  OPENING: 'Opening balance',
  FUND_TRANSFER: 'Fund transfer',
  MANUAL: 'Manual entry'
}

/** Friendly account name map (code → display name for non-accountants). */
export const FRIENDLY_ACCOUNT_NAMES: Record<string, string> = {
  '1110': 'Cash',
  '1120': 'Bank',
  '1130': 'Customer Receivables',
  '1140': 'Inventory',
  '2110': 'Supplier Payables',
  '2120': 'Distributor Clearing',
  '4100': 'Sales',
  '4200': 'Sales Returns',
  '5100': 'Cost of Goods',
  '6100': 'Operating Expenses',
  '6110': 'Salaries',
  '6120': 'Rent',
  '6130': 'Logistics'
}

export function friendlyAccountLabel(code: string, name: string, showTechnical: boolean): string {
  if (showTechnical) return `${code} — ${name}`
  return FRIENDLY_ACCOUNT_NAMES[code] || name.replace(/Accounts /i, '').replace(/General /i, '')
}

export type FinanceUxRole = 'staff' | 'manager' | 'accountant'

export function resolveFinanceUxRole(hasPermission: (perm: string) => boolean): FinanceUxRole {
  if (
    hasPermission('reports.accounting') ||
    hasPermission('accounts.view') ||
    hasPermission('accounts.manage') ||
    hasPermission('vouchers.view')
  ) {
    return 'accountant'
  }
  if (hasPermission('reports.view') || hasPermission('payments.view') || hasPermission('expenses.view')) {
    return 'manager'
  }
  return 'staff'
}

export function isAccountantView(role: FinanceUxRole): boolean {
  return role === 'accountant'
}
