import api from './api'

export type CampaignType = 'FEATURED' | 'NEW_LAUNCH' | 'SEASONAL' | 'COLLECTION' | 'CUSTOM'

export type CatalogCampaign = {
  _id: string
  name: string
  code?: string | null
  type: CampaignType
  description?: string | null
  bannerAssetId?: string | null
  productIds?: string[]
  startAt?: string | null
  endAt?: string | null
  isActive: boolean
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export const catalogCampaignsService = {
  listActive: (params?: Record<string, string | number | undefined>) =>
    api.get('/catalog-campaigns/active', { params }),
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get('/catalog-campaigns', { params }),
  create: (data: Partial<CatalogCampaign>) => api.post('/catalog-campaigns', data),
  getById: (id: string) => api.get(`/catalog-campaigns/${id}`),
  update: (id: string, data: Partial<CatalogCampaign>) => api.put(`/catalog-campaigns/${id}`, data),
  remove: (id: string) => api.delete(`/catalog-campaigns/${id}`)
}
