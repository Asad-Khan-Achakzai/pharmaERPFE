import api from './api'

export const usersService = {
  /** Active company users for order assignment, etc. (auth + tenant only; no users.view) */
  assignable: (params?: Record<string, unknown>) => api.get('/users/assignable', { params }),
  list: (params?: any) => api.get('/users', { params }),
  create: (data: any) => api.post('/users', data),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  setStatus: (id: string, isActive: boolean) => api.patch(`/users/${id}/status`, { isActive }),

  /** MRep team hierarchy (Phase 1). */
  team: (params?: { managerId?: string; isActive?: boolean; search?: string; includeSelf?: boolean }) =>
    api.get('/users/team', { params }),
  reports: (id: string) => api.get(`/users/${id}/reports`),
  setManager: (id: string, managerId: string | null) =>
    api.patch(`/users/${id}/manager`, { managerId: managerId ?? null }),
  setTerritory: (id: string, territoryId: string | null) =>
    api.patch(`/users/${id}/territory`, { territoryId: territoryId ?? null })
}
