import api from './api'

export const usersService = {
  /** Active company users for order assignment, etc. (auth + tenant only; no users.view) */
  assignable: () => api.get('/users/assignable'),
  list: (params?: any) => api.get('/users', { params }),
  create: (data: any) => api.post('/users', data),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  setStatus: (id: string, isActive: boolean) => api.patch(`/users/${id}/status`, { isActive })
}
