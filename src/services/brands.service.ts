import api from './api'

export type Brand = {
  _id: string
  name: string
  code?: string | null
  description?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export const brandsService = {
  lookup: (params?: { search?: string; limit?: number }) => api.get('/brands/lookup', { params }),
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get('/brands', { params }),
  create: (data: Partial<Brand>) => api.post('/brands', data),
  getById: (id: string) => api.get(`/brands/${id}`),
  update: (id: string, data: Partial<Brand>) => api.put(`/brands/${id}`, data),
  remove: (id: string) => api.delete(`/brands/${id}`)
}
