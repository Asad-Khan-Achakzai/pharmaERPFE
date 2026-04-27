import api from './api'

export const platformService = {
  dashboard: (params?: { days?: number; companies?: string }) => api.get('/platform/dashboard', { params })
}
