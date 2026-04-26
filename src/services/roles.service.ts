import api from './api'

export type Role = {
  _id: string
  companyId: string
  name: string
  code: string | null
  permissions: string[]
  isSystem: boolean
  userCount?: number
  createdAt?: string
  updatedAt?: string
}

export const rolesService = {
  list: (params?: { page?: number; limit?: number; search?: string }) => api.get('/roles', { params }),
  getById: (id: string) => api.get(`/roles/${id}`),
  create: (data: { name: string; code?: string; permissions: string[] }) => api.post('/roles', data),
  update: (id: string, data: Partial<{ name: string; code: string | null; permissions: string[] }>) =>
    api.put(`/roles/${id}`, data),
  remove: (id: string) => api.delete(`/roles/${id}`)
}
