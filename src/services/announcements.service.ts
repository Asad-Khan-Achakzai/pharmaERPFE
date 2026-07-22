import api from './api'

export type Announcement = {
  _id: string
  title: string
  body?: string
  publishedAt?: string | null
  publishedBy?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export const announcementsService = {
  feed: (params?: Record<string, string | number | undefined>) =>
    api.get('/announcements/feed', { params }),
  adminList: (params?: Record<string, string | number | undefined>) =>
    api.get('/announcements/admin', { params }),
  create: (data: { title: string; body: string; publish?: boolean }) =>
    api.post('/announcements', data),
  publish: (id: string) => api.post(`/announcements/${id}/publish`)
}
