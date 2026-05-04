import api from './api'

export const doctorsService = {
  /** Dropdowns (auth + tenant only; no doctors.view) */
  lookup: (params?: any) => api.get('/doctors/lookup', { params }),
  list: (params?: any) => api.get('/doctors', { params }),
  create: (data: any) => api.post('/doctors', data),
  getById: (id: string) => api.get(`/doctors/${id}`),
  update: (id: string, data: any) => api.put(`/doctors/${id}`, data),
  remove: (id: string) => api.delete(`/doctors/${id}`),
  /** Bulk Excel import (additive — does not affect single-doctor create). */
  import: {
    preview: (data: { fileBase64: string; sheet?: string }) => api.post('/doctors/import/preview', data),
    commit: (data: {
      fileBase64: string
      mapping: Record<string, string | null>
      sheet?: string
      skipDuplicates?: boolean
    }) => api.post('/doctors/import/commit', data),
    template: () => api.get('/doctors/import/template', { responseType: 'blob' })
  }
}

export const doctorActivitiesService = {
  list: (params?: any) => api.get('/doctor-activities', { params }),
  create: (data: any) => api.post('/doctor-activities', data),
  getById: (id: string) => api.get(`/doctor-activities/${id}`),
  update: (id: string, data: any) => api.put(`/doctor-activities/${id}`, data),
  recalculate: (id: string) => api.post(`/doctor-activities/${id}/recalculate`),
  getByDoctor: (id: string) => api.get(`/doctor-activities/doctor/${id}`)
}
