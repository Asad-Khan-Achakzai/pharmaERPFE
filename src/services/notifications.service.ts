import api from './api'

export type NotificationItem = {
  _id: string
  title: string
  body?: string
  kind?: string
  read: boolean
  createdAt: string
  link?: string | null
}

export const notificationsService = {
  feed: (params?: Record<string, string | number | undefined>) =>
    api.get('/notifications/feed', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string, source: 'push_tap' | 'in_app' | 'other' = 'in_app') =>
    api.post(`/notifications/${id}/read`, { source }),
  markAllRead: () => api.post('/notifications/read-all', { source: 'in_app' }),
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data: {
    mutedCategories?: string[]
    muteInApp?: boolean
    pushEnabled?: boolean
  }) => api.put('/notifications/preferences', data)
}
