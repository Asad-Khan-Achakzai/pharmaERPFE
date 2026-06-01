import api from './api'
import type { Account } from '@/types/accounting'

export const accountService = {
  list: (params?: Record<string, string>) => api.get<{ data: Account[] }>('/accounts', { params }),
  listMoneyAccounts: () => api.get<{ data: Account[] }>('/accounts/money-accounts'),
  businessView: () =>
    api.get<{
      data: {
        moneyAccounts: Account[]
        expenseCategories: Account[]
        incomeCategories: Account[]
        inventoryAccounts: Account[]
        notices: { suppliers: string; pharmacies: string }
      }
    }>('/accounts/business-view'),
  createSimple: (body: {
    accountType: string
    name: string
    openingBalance?: number
    accountNumber?: string
    notes?: string
  }) => api.post<{ data: Account }>('/accounts/simple', body),
  tree: () => api.get<{ data: Account[] }>('/accounts/tree'),
  getById: (id: string) => api.get<{ data: Account }>(`/accounts/${id}`),
  create: (body: Partial<Account>) => api.post<{ data: Account }>('/accounts', body),
  update: (id: string, body: Partial<Account>) => api.patch<{ data: Account }>(`/accounts/${id}`, body),
  setOpeningBalance: (id: string, openingBalance: number) =>
    api.patch<{ data: Account }>(`/accounts/${id}/opening-balance`, { openingBalance }),
  remove: (id: string) => api.delete(`/accounts/${id}`),
  groupTypes: () => api.get<{ data: string[] }>('/accounts/group-types')
}
