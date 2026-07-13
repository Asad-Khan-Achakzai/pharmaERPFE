import api from './api'

export type TaxonomyKind = 'THERAPY' | 'AREA' | 'CLASS'

export type TaxonomyNode = {
  _id: string
  name: string
  code?: string | null
  kind: TaxonomyKind
  parentId?: string | null
  materializedPath?: string
  depth?: number
  sortOrder?: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type TaxonomyTreeNode = TaxonomyNode & { children: TaxonomyTreeNode[] }

export const productTaxonomyService = {
  lookup: (params?: { search?: string; kind?: TaxonomyKind; limit?: number }) =>
    api.get('/product-taxonomy/lookup', { params }),
  tree: () => api.get('/product-taxonomy/tree'),
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get('/product-taxonomy', { params }),
  create: (data: {
    name: string
    code?: string | null
    kind: TaxonomyKind
    parentId?: string | null
    sortOrder?: number
    isActive?: boolean
  }) => api.post('/product-taxonomy', data),
  getById: (id: string) => api.get(`/product-taxonomy/${id}`),
  update: (
    id: string,
    data: Partial<{
      name: string
      code: string | null
      parentId: string | null
      sortOrder: number
      isActive: boolean
    }>
  ) => api.put(`/product-taxonomy/${id}`, data),
  remove: (id: string) => api.delete(`/product-taxonomy/${id}`)
}
