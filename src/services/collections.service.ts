import api from './api'

export const collectionsService = {
  list: (params?: any) => api.get('/collections', { params }),
  create: (data: any) => api.post('/collections', data),
  getById: (id: string) => api.get(`/collections/${id}`),
  getByPharmacy: (id: string) => api.get(`/collections/pharmacy/${id}`),
  update: (
    id: string,
    data: { date?: string; notes?: string; referenceNumber?: string }
  ) => api.patch(`/collections/${id}`, data),
  reverse: (id: string, data?: { reversalReason?: string }) =>
    api.post(`/collections/${id}/reverse`, data ?? {})
}
