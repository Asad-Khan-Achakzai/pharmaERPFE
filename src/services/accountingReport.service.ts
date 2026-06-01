import api from './api'
import type { TrialBalanceRow, GeneralLedgerEntry, GeneralLedgerAccountBucket, Account } from '@/types/accounting'

export const accountingReportService = {
  trialBalance: (params?: Record<string, string>) =>
    api.get<{ data: { rows: TrialBalanceRow[]; totals: { periodDebit: number; periodCredit: number; balanced: boolean } } }>(
      '/accounting-reports/trial-balance',
      { params }
    ),
  generalLedger: (params?: Record<string, string>) =>
    api.get<{
      data: { accounts: GeneralLedgerAccountBucket[] }
    }>('/accounting-reports/general-ledger', { params }),
  profitLoss: (params?: Record<string, string>) => api.get('/accounting-reports/profit-loss', { params }),
  balanceSheet: (params?: Record<string, string>) => api.get('/accounting-reports/balance-sheet', { params }),
  dayBook: (params?: Record<string, string>) =>
    api.get<{ data: { entries: GeneralLedgerEntry[] } }>('/accounting-reports/day-book', { params }),
  cashBook: (params?: Record<string, string>) => api.get('/accounting-reports/cash-book', { params }),
  bankBook: (params?: Record<string, string>) => api.get('/accounting-reports/bank-book', { params }),
  subLedgerReconciliation: (controlCode?: string) =>
    api.get('/accounting-reports/sub-ledger-reconciliation', { params: controlCode ? { controlCode } : {} }),
  fiscalPeriods: () => api.get('/accounting-reports/fiscal-periods'),
  closeFiscalPeriod: (id: string) => api.post(`/accounting-reports/fiscal-periods/${id}/close`)
}
