import api from './api'

export const distributorsService = {
  /** Dropdowns (auth + tenant only; no distributors.view) */
  lookup: (params?: any) => api.get('/distributors/lookup', { params }),
  list: (params?: any) => api.get('/distributors', { params }),
  create: (data: any) => api.post('/distributors', data),
  getById: (id: string) => api.get(`/distributors/${id}`),
  update: (id: string, data: any) => api.put(`/distributors/${id}`, data),
  remove: (id: string) => api.delete(`/distributors/${id}`)
}
