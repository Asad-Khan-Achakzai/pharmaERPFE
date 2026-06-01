export type AccountGroupType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export type VoucherType = 'JV' | 'PV' | 'RV' | 'CV' | 'SV' | 'PURV' | 'AUTO'
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'REVERSED'

export type Account = {
  _id: string
  code: string
  name: string
  groupType: AccountGroupType
  parentId?: string | null
  isGroup: boolean
  isControlAccount: boolean
  isCash: boolean
  isBank: boolean
  isMoneyAccount?: boolean
  moneyAccountNature?: 'CASH' | 'BANK' | null
  openingBalance: number
  currentBalance: number
  isActive: boolean
  isSystem: boolean
  children?: Account[]
}

export type VoucherLine = {
  _id?: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  description?: string
  partyEntityType?: string
  partyEntityId?: string
}

export type Voucher = {
  _id: string
  voucherNumber: string
  voucherType: VoucherType
  status: VoucherStatus
  date: string
  narration?: string
  lines: VoucherLine[]
  totalDebit: number
  totalCredit: number
  sourceModule?: string
  sourceRefId?: string
}

export type TrialBalanceRow = {
  accountId: string
  code: string
  name: string
  groupType: AccountGroupType
  openingBalance: number
  periodDebit: number
  periodCredit: number
  closingBalance: number
}

export type GeneralLedgerAccountBucket = {
  account: Account
  openingBalance: number
  closingBalance: number
  entries: GeneralLedgerEntry[]
}

export type GeneralLedgerEntry = {
  date: string
  voucherNumber: string
  voucherType: VoucherType
  voucherId: string
  accountCode: string
  accountName: string
  narration?: string
  debit: number
  credit: number
  runningBalance: number
}
