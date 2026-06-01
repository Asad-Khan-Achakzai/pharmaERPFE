/**
 * Business-friendly account types for simple creation mode.
 * Maps to backend SIMPLE_ACCOUNT_TYPE enum.
 */

export type SimpleAccountTypeId =
  | 'BANK'
  | 'CASH'
  | 'EXPENSE'
  | 'INCOME'
  | 'INVENTORY'
  | 'SUPPLIER_PAYABLE'
  | 'CUSTOMER_RECEIVABLE'

export type SimpleAccountTypeConfig = {
  id: SimpleAccountTypeId
  icon: string
  title: string
  description: string
  /** Only users with accounts.manage can create this type */
  requiresFullManage?: boolean
  showAccountNumber?: boolean
  notice?: string
}

export const SIMPLE_ACCOUNT_TYPES: SimpleAccountTypeConfig[] = [
  {
    id: 'BANK',
    icon: '🏦',
    title: 'Bank Account',
    description: 'Used to receive and pay money through banks',
    showAccountNumber: true
  },
  {
    id: 'CASH',
    icon: '💵',
    title: 'Cash Account',
    description: 'Used for physical cash handling — petty cash, cash in hand, etc.'
  },
  {
    id: 'EXPENSE',
    icon: '💸',
    title: 'Expense Category',
    description: 'Used to track company spending — salary, rent, logistics, and more',
    requiresFullManage: true
  },
  {
    id: 'INCOME',
    icon: '📈',
    title: 'Income Category',
    description: 'Used to track revenue streams beyond standard sales',
    requiresFullManage: true
  },
  {
    id: 'INVENTORY',
    icon: '📦',
    title: 'Inventory / Asset',
    description: 'Used for stock or asset value tracking',
    requiresFullManage: true
  },
  {
    id: 'SUPPLIER_PAYABLE',
    icon: '👤',
    title: 'Other Payable',
    description: 'For liabilities not tied to a supplier in the system',
    requiresFullManage: true,
    notice:
      'Supplier balances are tracked automatically in Suppliers. Only create this for other payables.'
  },
  {
    id: 'CUSTOMER_RECEIVABLE',
    icon: '👥',
    title: 'Other Receivable',
    description: 'For money owed to you outside pharmacy/customer ledgers',
    requiresFullManage: true,
    notice:
      'Pharmacy balances are tracked automatically. Only create this for special receivables.'
  }
]

export const FRIENDLY_CATEGORY_LABELS: Record<string, string> = {
  ASSET: 'What you own',
  LIABILITY: 'What you owe',
  EQUITY: 'Owner funds',
  INCOME: 'Money earned',
  EXPENSE: 'Money spent'
}

export function moneyAccountTypeLabel(a: { isCash?: boolean; isBank?: boolean; moneyAccountNature?: string | null }) {
  if (a.moneyAccountNature === 'BANK' || a.isBank) return 'Bank'
  if (a.moneyAccountNature === 'CASH' || a.isCash) return 'Cash'
  return 'Money'
}
