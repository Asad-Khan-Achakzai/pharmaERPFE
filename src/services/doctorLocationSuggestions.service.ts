import api from './api'

export type DoctorLocationSuggestionRow = {
  _id: string
  doctorId: {
    _id: string
    name: string
    specialization?: string
    locationStatus?: string
    latitude?: number | null
    longitude?: number | null
    address?: string
    city?: string
  }
  submittedByEmployeeId: {
    _id: string
    name: string
    email?: string
    employeeCode?: string | null
  }
  latitude: number
  longitude: number
  gpsAccuracy?: number | null
  source: string
  status: string
  submittedAt: string
  distanceFromExistingVerifiedMeters?: number | null
}

export const doctorLocationSuggestionsService = {
  list: (params?: Record<string, string | number | undefined>) =>
    api.get('/doctor-location-suggestions', { params }),
  approve: (id: string) => api.post(`/doctor-location-suggestions/${id}/approve`),
  reject: (id: string, body?: { rejectionReason?: string }) =>
    api.post(`/doctor-location-suggestions/${id}/reject`, body ?? {})
}
