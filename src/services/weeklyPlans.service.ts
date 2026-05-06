import api from './api'

export const weeklyPlansService = {
  list: (params?: any) => api.get('/weekly-plans', { params }),
  create: (data: any) => api.post('/weekly-plans', data),
  getById: (id: string) => api.get(`/weekly-plans/${id}`),
  update: (id: string, data: any) => api.put(`/weekly-plans/${id}`, data),
  getByRep: (id: string) => api.get(`/weekly-plans/rep/${id}`),
  bulkPlanItems: (weeklyPlanId: string, items: any[]) =>
    api.post(`/weekly-plans/${weeklyPlanId}/plan-items`, { items }),
  copyPreviousWeek: (weeklyPlanId: string) => api.post(`/weekly-plans/${weeklyPlanId}/copy-previous-week`),

  /** Phase 2B — approval workflow. */
  submit: (id: string) => api.post(`/weekly-plans/${id}/submit`),
  approve: (id: string) => api.post(`/weekly-plans/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/weekly-plans/${id}/reject`, { reason }),
  pendingApprovals: () => api.get('/weekly-plans/pending-approvals')
}
