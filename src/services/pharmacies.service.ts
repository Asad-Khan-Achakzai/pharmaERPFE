import api from './api'

export const pharmaciesService = {
  /** Dropdowns (auth + tenant only; no pharmacies.view) */
  lookup: (params?: any) => api.get('/pharmacies/lookup', { params }),
  list: (params?: any) => api.get('/pharmacies', { params }),
  create: (data: any) => api.post('/pharmacies', data),
  getById: (id: string) => api.get(`/pharmacies/${id}`),
  update: (id: string, data: any) => api.put(`/pharmacies/${id}`, data),
  remove: (id: string) => api.delete(`/pharmacies/${id}`)
}
