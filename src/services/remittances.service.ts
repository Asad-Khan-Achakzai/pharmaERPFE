import api from './api'

export const remittancesService = {
  list: (params?: any) => api.get('/remittances', { params }),
  getById: (id: string) => api.get(`/remittances/${id}`),
  preview: (data: any) => api.post('/remittances/preview', data),
  create: (data: any, clientUuid?: string) =>
    api.post('/remittances', data, {
      headers: clientUuid ? { 'X-Client-Uuid': clientUuid } : undefined
    }),
  reverse: (id: string, data?: { reversalReason?: string }) =>
    api.post(`/remittances/${id}/reverse`, data ?? {}),
  pharmacyOutstanding: (distributorId: string, params?: any) =>
    api.get(`/remittances/distributors/${distributorId}/pharmacy-outstanding`, { params }),
  unremittedCollections: (distributorId: string, params?: any) =>
    api.get(`/remittances/distributors/${distributorId}/unremitted-collections`, { params })
}
