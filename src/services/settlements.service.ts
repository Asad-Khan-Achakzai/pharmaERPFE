import api from './api'

export const settlementsService = {
  list: (params?: any) => api.get('/settlements', { params }),
  create: (data: any) => api.post('/settlements', data),
  getById: (id: string) => api.get(`/settlements/${id}`),
  update: (
    id: string,
    data: { date?: string; notes?: string; referenceNumber?: string }
  ) => api.patch(`/settlements/${id}`, data),
  reverse: (id: string, data?: { reversalReason?: string }) =>
    api.post(`/settlements/${id}/reverse`, data ?? {})
}
