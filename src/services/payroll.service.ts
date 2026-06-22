import api from './api'

export const payrollService = {
  list: (params?: Record<string, unknown>) => api.get('/payroll', { params }),
  preview: (data: Record<string, unknown>) => api.post('/payroll/preview', data),
  create: (data: Record<string, unknown>) => api.post('/payroll', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/payroll/${id}`, data),
  remove: (id: string) => api.delete(`/payroll/${id}`),
  pay: (id: string, data?: { moneyAccountId?: string }) => api.post(`/payroll/${id}/pay`, data ?? {}),
  pendingSummary: (month: string) => api.get('/payroll/pending-summary', { params: { month } }),
  downloadPayslip: (id: string) =>
    api.get(`/payroll/${id}/payslip`, { responseType: 'blob' })
}
