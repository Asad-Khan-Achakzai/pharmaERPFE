import api from './api'

export type ProductPacksTargetInput = { productId: string; packsTarget: number }

export type TargetPayload = {
  medicalRepId?: string
  month?: string
  salesTarget?: number
  packsTarget?: number
  productPacksTargets?: ProductPacksTargetInput[]
}

export const targetsService = {
  list: (params?: any) => api.get('/targets', { params }),
  create: (data: TargetPayload) => api.post('/targets', data),
  update: (id: string, data: TargetPayload) => api.put(`/targets/${id}`, data),
  remove: (id: string) => api.delete(`/targets/${id}`),
  getByRep: (id: string) => api.get(`/targets/rep/${id}`),
  packsBreakdown: (params: { medicalRepId: string; month: string }) => api.get('/targets/packs-breakdown', { params })
}
