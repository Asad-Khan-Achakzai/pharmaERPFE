import api from './api'

export type ProductKit = {
  _id: string
  name: string
  code?: string | null
  description?: string | null
  productIds: string[]
  heroAssetId?: string | null
  isActive: boolean
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export const productKitsService = {
  lookup: (params?: { search?: string; limit?: number }) => api.get('/product-kits/lookup', { params }),
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get('/product-kits', { params }),
  create: (data: Partial<ProductKit> & { name: string; productIds: string[] }) =>
    api.post('/product-kits', data),
  getById: (id: string) => api.get(`/product-kits/${id}`),
  update: (id: string, data: Partial<ProductKit>) => api.put(`/product-kits/${id}`, data),
  remove: (id: string) => api.delete(`/product-kits/${id}`)
}
