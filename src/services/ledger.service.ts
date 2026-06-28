import api from './api'

export const ledgerService = {
  list: (params?: any) => api.get('/ledger', { params }),
  getByPharmacy: (id: string, params?: any) => api.get(`/ledger/pharmacy/${id}`, { params }),
  getBalance: (pharmacyId: string) => api.get(`/ledger/pharmacy/${pharmacyId}/balance`),
  clientStatement: (params: Record<string, string>) => api.get('/ledger/client-statement', { params }),
  supplierStatement: (params: Record<string, string>) => api.get('/ledger/supplier-statement', { params }),
  expenseLedger: (params?: Record<string, string>) => api.get('/ledger/expense-ledger', { params }),
  activityLedger: (params?: Record<string, string>) => api.get('/ledger/activity-ledger', { params }),
  employeeStatement: (params: Record<string, string>) => api.get('/ledger/employee-statement', { params })
}
