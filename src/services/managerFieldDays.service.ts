import api from './api'

export type ManagerFieldDayRep = { _id: string; name?: string }

export type PartnerListingsByYmd = Record<string, ManagerFieldDayRep[]>

export type ManagerFieldDay = {
  _id: string
  managerId: string | { _id: string; name?: string }
  date: string
  dateYmd: string
  medicalRepIds: ManagerFieldDayRep[] | string[]
  notes?: string
}

export const managerFieldDaysService = {
  list: (params: { from: string; to: string; managerId?: string }) =>
    api.get('/manager-field-days', { params }),
  partnerListings: (params: { from: string; to: string }) =>
    api.get('/manager-field-days/partner-listings', { params }),
  getMe: (date: string) => api.get('/manager-field-days/me', { params: { date } }),
  upsertMe: (data: { date: string; medicalRepIds: string[]; notes?: string; managerId?: string }) =>
    api.put('/manager-field-days/me', data),
  update: (id: string, data: { medicalRepIds?: string[]; notes?: string }) =>
    api.put(`/manager-field-days/${id}`, data),
  remove: (id: string) => api.delete(`/manager-field-days/${id}`)
}
