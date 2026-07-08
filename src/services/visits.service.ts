import api from './api'

export const visitsService = {
  unplanned: (data: Record<string, unknown>) => api.post('/visits/unplanned', data),
  listActive: (params?: { employeeId?: string }) => api.get('/visits/active', { params }),
  listTeamActive: (params?: { employeeId?: string }) => api.get('/visits/active/team', { params }),
  upsertActive: (data: Record<string, unknown>) => api.put('/visits/active', data),
  clearActive: (clientUuid: string) => api.delete(`/visits/active/${clientUuid}`)
}
