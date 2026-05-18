import api from './api'

export const onboardingService = {
  session: () => api.get('/onboarding/session'),
  start: (data?: { currentStep?: string; metadata?: Record<string, unknown> }) => api.post('/onboarding/start', data || {}),
  updateStep: (data: { step: string; status: string; note?: string; currentStep?: string }) => api.patch('/onboarding/steps', data),
  goLive: () => api.post('/onboarding/go-live'),

  imports: {
    list: (params?: Record<string, unknown>) => api.get('/onboarding/imports', { params }),
    getById: (id: string) => api.get(`/onboarding/imports/${id}`),
    rollback: (id: string, data?: { reason?: string }) => api.post(`/onboarding/imports/${id}/rollback`, data || {}),
    preview: (data: { entityType: string; fileBase64: string; sheet?: string | null }) =>
      api.post('/onboarding/imports/preview', data),
    commit: (data: {
      entityType: string
      fileBase64: string
      sheet?: string | null
      mapping: Record<string, string | null>
      mode: 'DRY_RUN' | 'COMMIT'
      skipDuplicates?: boolean
      options?: Record<string, unknown>
    }) => api.post('/onboarding/imports/commit', data)
  },

  reconciliations: {
    list: (params?: Record<string, unknown>) => api.get('/onboarding/reconciliations', { params })
  },

  ops: {
    summary: () => api.get('/onboarding/ops/summary')
  },

  historical: {
    preview: (data: {
      entityType: string
      fileBase64: string
      sheet?: string | null
      fromDate: string
      toDate: string
    }) => api.post('/onboarding/historical/preview', data),
    archive: (data: {
      entityType: string
      fileBase64: string
      sheet?: string | null
      fromDate: string
      toDate: string
      archiveMode?: 'ARCHIVE_ONLY' | 'ARCHIVE_PLUS_SUMMARY'
      file?: { originalName?: string; mimeType?: string; sizeBytes?: number }
    }) => api.post('/onboarding/historical/archive', data),
    listArchives: (params?: Record<string, unknown>) => api.get('/onboarding/historical/archives', { params })
  }
}
