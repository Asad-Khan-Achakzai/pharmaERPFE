import api from './api'
import type { PresentationSlide, ProductPresentation } from './presentations.service'

export type ProductRef = { _id: string; name?: string; code?: string | null }

export const productsService = {
  /** Dropdowns (auth + tenant only; no products.view) */
  lookup: (params?: any) => api.get('/products/lookup', { params }),
  list: (params?: any) => api.get('/products', { params }),
  create: (data: any) => api.post('/products', data),
  getById: (id: string) => api.get(`/products/${id}`),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  remove: (id: string) => api.delete(`/products/${id}`),

  compare: (params: { ids: string }) => api.get('/products/compare', { params }),
  sync: (params?: { sinceVersion?: number; limit?: number }) => api.get('/products/sync', { params }),
  catalogSync: (params?: { sinceVersion?: number; limit?: number }) =>
    api.get('/products/catalog-sync', { params }),

  getPresentations: (productId: string) => api.get(`/products/${productId}/presentations`),
  getDefaultPresentation: (productId: string) =>
    api.get(`/products/${productId}/presentations/default`),
  createPresentation: (
    productId: string,
    data: { title?: string; slides?: PresentationSlide[] }
  ) => api.post(`/products/${productId}/presentations`, data)
}

export type { ProductPresentation }
