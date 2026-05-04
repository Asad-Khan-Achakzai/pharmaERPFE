import api from './api'

export const planItemsService = {
  listToday: (params?: { date?: string; employeeId?: string }) =>
    api.get('/plan-items/today', { params }),
  reorder: (body: { weeklyPlanId: string; date: string; orderedPlanItemIds: string[] }) =>
    api.put('/plan-items/reorder', body),
  update: (planItemId: string, data: { status?: string; notes?: string }) =>
    api.put(`/plan-items/${planItemId}`, data),
  markVisit: (planItemId: string, data: Record<string, unknown>) =>
    api.post(`/plan-items/${planItemId}/mark-visit`, data)
}
