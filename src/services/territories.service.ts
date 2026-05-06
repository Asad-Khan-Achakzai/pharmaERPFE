import api from './api'

export type TerritoryKind = 'ZONE' | 'AREA' | 'BRICK'

export type Territory = {
  _id: string
  companyId?: string
  name: string
  code?: string | null
  kind: TerritoryKind
  parentId?: string | null
  materializedPath?: string
  depth?: number
  isActive: boolean
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export type TerritoryNode = Territory & { children: TerritoryNode[] }

export type TerritoryTreeResponse = { roots: TerritoryNode[]; total: number }

export const territoriesService = {
  /** Tenant-scoped autocomplete (no `territories.view` required). */
  lookup: (params?: { search?: string; kind?: TerritoryKind; parentId?: string; limit?: number }) =>
    api.get('/territories/lookup', { params }),

  list: (params?: {
    page?: number
    limit?: number
    search?: string
    kind?: TerritoryKind
    parentId?: string | 'null'
    isActive?: boolean
  }) => api.get('/territories', { params }),

  tree: () => api.get<{ data: TerritoryTreeResponse }>('/territories/tree'),

  getById: (id: string) => api.get(`/territories/${id}`),

  create: (data: {
    name: string
    code?: string | null
    kind: TerritoryKind
    parentId?: string | null
    isActive?: boolean
    notes?: string | null
  }) => api.post('/territories', data),

  update: (
    id: string,
    data: Partial<{
      name: string
      code: string | null
      parentId: string | null
      isActive: boolean
      notes: string | null
    }>
  ) => api.put(`/territories/${id}`, data),

  remove: (id: string) => api.delete(`/territories/${id}`),

  import: {
    preview: (data: { fileBase64: string; sheet?: string }) => api.post('/territories/import/preview', data),
    commit: (data: {
      fileBase64: string
      mapping: Record<string, string | null>
      sheet?: string
      skipExisting?: boolean
    }) => api.post('/territories/import/commit', data),
    template: () => api.get('/territories/import/template', { responseType: 'blob' })
  }
}
