import api from './api'

export type DeviceBindingRow = {
  _id: string
  user: {
    _id: string
    name: string
    email?: string
    employeeCode?: string | null
    isActive?: boolean
  } | null
  deviceId: string
  platform?: string | null
  brand?: string | null
  model?: string | null
  osVersion?: string | null
  appVersion?: string | null
  boundAt?: string
  boundBy?: string
  lastSeenAt?: string
  hasPendingRequest?: boolean
}

export type DeviceChangeRequestRow = {
  _id: string
  userId: {
    _id: string
    name: string
    email?: string
    employeeCode?: string | null
  } | null
  currentDeviceId?: string | null
  requestedDeviceId: string
  requestedDevice?: {
    deviceId: string
    platform?: string | null
    brand?: string | null
    model?: string | null
    osVersion?: string | null
    appVersion?: string | null
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  reason?: string | null
  decidedBy?: { _id: string; name?: string; email?: string } | null
  decidedAt?: string | null
  decisionNote?: string | null
  createdAt?: string
}

export const deviceControlService = {
  listBindings: (params?: Record<string, string | number | undefined>) =>
    api.get('/device-control/bindings', { params }),
  forceRevoke: (userId: string) => api.post(`/device-control/bindings/${userId}/revoke`),
  listRequests: (params?: Record<string, string | number | undefined>) =>
    api.get('/device-control/requests', { params }),
  approveRequest: (id: string) => api.post(`/device-control/requests/${id}/approve`),
  rejectRequest: (id: string, body?: { note?: string }) =>
    api.post(`/device-control/requests/${id}/reject`, body ?? {})
}
