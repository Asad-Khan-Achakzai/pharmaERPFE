import api from './api'

export type CallPoint = {
  _id: string
  name: string
  latitude: number
  longitude: number
  isActive: boolean
  createdBy?: { _id: string; name?: string } | string | null
  createdAt?: string
  updatedAt?: string
}

export const callPointsService = {
  /** Active-only dropdown source for weekly plan day-CP selection (auth + tenant only). */
  lookup: (params?: any) => api.get('/call-points/lookup', { params }),
  list: (params?: any) => api.get('/call-points', { params }),
  create: (data: any) => api.post('/call-points', data),
  getById: (id: string) => api.get(`/call-points/${id}`),
  update: (id: string, data: any) => api.put(`/call-points/${id}`, data),
  remove: (id: string) => api.delete(`/call-points/${id}`)
}
