import api from './api'

export type OutstandingGroupBy = 'pharmacy' | 'medicalRep' | 'area' | 'zone' | 'invoice'

export type OutstandingListParams = {
  groupBy?: OutstandingGroupBy
  medicalRepId?: string
  pharmacyId?: string
  areaId?: string
  zoneId?: string
  search?: string
  page?: number | string
  limit?: number | string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

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
    api.post(`/collections/${id}/reverse`, data ?? {}),
  outstanding: (params?: OutstandingListParams) =>
    api.get('/collections/outstanding', { params }),
  outstandingPharmacy: (
    pharmacyId: string,
    params?: { medicalRepId?: string; historyLimit?: number }
  ) => api.get(`/collections/outstanding/pharmacies/${pharmacyId}`, { params })
}
