import api from './api'

export type CreateExpensePayload = {
  expenseAccountId: string
  moneyAccountId: string
  amount: number
  description?: string
  date?: string
  employeeId?: string
}

export const expensesService = {
  list: (params?: Record<string, string>) => api.get('/expenses', { params }),
  create: (data: CreateExpensePayload) => api.post('/expenses', data),
  update: (id: string, data: { description?: string; date?: string }) => api.put(`/expenses/${id}`, data),
  remove: (id: string) => api.delete(`/expenses/${id}`)
}
