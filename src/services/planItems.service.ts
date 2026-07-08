import api from './api'

export type AssignableUser = { _id: string; name: string; email?: string }

export type CoVisitAvailabilityRow = {
  userId: string
  name: string
  availabilityTier: 'AVAILABLE' | 'WARNING' | 'CONFLICT'
  summary: string
  reasons: { code: string; message: string; severity: string }[]
  sameDayVisits: unknown[]
}

export const planItemsService = {
  listToday: (params?: { date?: string; employeeId?: string }) =>
    api.get('/plan-items/today', { params }),
  listTeamVisits: (params?: { date?: string; employeeId?: string }) =>
    api.get('/plan-items/team-visits', { params }),
  reorder: (body: { weeklyPlanId: string; date: string; orderedPlanItemIds: string[] }) =>
    api.put('/plan-items/reorder', body),
  update: (planItemId: string, data: { status?: string; notes?: string; participantUserIds?: string[] }) =>
    api.put(`/plan-items/${planItemId}`, data),
  markVisit: (planItemId: string, data: Record<string, unknown>) =>
    api.post(`/plan-items/${planItemId}/mark-visit`, data),
  checkCoVisitAvailability: async (params: {
    date: string
    doctorId?: string
    plannedTime?: string
    candidateUserIds: string
    excludePlanItemId?: string
  }) => {
    const res = await api.get('/plan-items/co-visit/availability', { params })
    return (res.data.data || []) as CoVisitAvailabilityRow[]
  }
}
