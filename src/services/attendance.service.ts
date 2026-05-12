import type { AxiosResponse } from 'axios'
import api from './api'

/**
 * Coalesce duplicate in-flight GETs (e.g. React Strict Mode double effect) when no AbortSignal.
 * Pass `{ signal }` from a caller that must cancel (we use this only for explicit cancel cases).
 */
let meTodayInFlight: Promise<AxiosResponse<unknown>> | null = null
let todayInFlight: Promise<AxiosResponse<unknown>> | null = null

export const attendanceService = {
  mark: (body?: { checkOutTime?: string; notes?: string }) => api.post('/attendance/mark', body ?? {}),
  checkIn: (body?: { reason?: string }) => api.post('/attendance/checkin', body ?? {}),
  checkOut: () => api.post('/attendance/checkout', {}),
  meToday: (config?: { signal?: AbortSignal }) => {
    if (config?.signal) {
      return api.get('/attendance/me/today', config)
    }
    if (!meTodayInFlight) {
      meTodayInFlight = api.get('/attendance/me/today').finally(() => {
        meTodayInFlight = null
      })
    }
    return meTodayInFlight
  },
  today: (config?: { signal?: AbortSignal }) => {
    if (config?.signal) {
      return api.get('/attendance/today', config)
    }
    if (!todayInFlight) {
      todayInFlight = api.get('/attendance/today').finally(() => {
        todayInFlight = null
      })
    }
    return todayInFlight
  },
  report: (params: { employeeId: string; startDate: string; endDate: string }) =>
    api.get('/attendance/report', { params }),
  monthlySummary: (params: { employeeId: string; month: string }) =>
    api.get('/attendance/monthly-summary', { params }),
  /** Admin only: mark employee absent for today (Pacific); clears mistaken check-in. */
  adminMarkAbsentToday: (body: { employeeId: string }) => api.post('/attendance/admin/mark-absent-today', body),
  /** Admin only: set today's status (Pacific) — present, absent, half-day, or leave. */
  adminSetTodayStatus: (body: { employeeId: string; status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' }) =>
    api.post('/attendance/admin/set-today-status', body),

  /** Governance (flags default off on the server). */
  governanceSettings: () => api.get('/attendance/governance/settings'),
  patchGovernanceSettings: (
    body: Partial<{
      attendanceGovernanceEnabled: boolean
      attendancePoliciesEnabled: boolean
      attendanceApprovalsEnabled: boolean
      strictLateBlocking: boolean
      allowCheckInWhenLate: boolean
      autoRequestOnLateCheckIn: boolean
      attendanceApprovalSlaHours: number | null
      attendanceSlaBreachAction: 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL'
      attendanceEodEscalationEnabled: boolean
      attendanceEodEscalationAction: 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL'
      attendanceOversightInterventionEnabled: boolean
      attendancePendingAutoRejectHours: number | null
    }>
  ) => api.patch('/attendance/governance/settings', body),
  listWorkShifts: () => api.get('/attendance/governance/work-shifts'),
  createWorkShift: (body: Record<string, unknown>) => api.post('/attendance/governance/work-shifts', body),
  deleteWorkShift: (id: string) => api.delete(`/attendance/governance/work-shifts/${id}`),
  listPolicies: () => api.get('/attendance/governance/policies'),
  createPolicy: (body: Record<string, unknown>) => api.post('/attendance/governance/policies', body),
  listPolicyAssignments: () => api.get('/attendance/governance/policy-assignments'),
  createPolicyAssignment: (body: Record<string, unknown>) => api.post('/attendance/governance/policy-assignments', body),
  bulkPolicyAssignments: (body: { policyId: string; employeeIds: string[] }) =>
    api.post('/attendance/governance/policy-assignments/bulk', body),
  deletePolicyAssignment: (id: string) => api.delete(`/attendance/governance/policy-assignments/${id}`),
  monitoringSummary: () => api.get('/attendance/governance/monitoring/summary'),
  governanceRequestQueue: (params?: { limit?: number; skip?: number; sort?: 'newest' | 'oldest' }) =>
    api.get('/attendance/governance/request-queue', { params }),
  patchMyApprovalDelegation: (body: { delegateUserId?: string | null; delegateUntil?: string | Date | null }) =>
    api.patch('/attendance/governance/my-approval-delegation', body),
  oversightAttendanceRequests: (params?: { limit?: number; sort?: 'newest' | 'oldest' }) =>
    api.get('/attendance/requests/oversight', { params }),
  listApprovalMatrices: () => api.get('/attendance/governance/approval-matrices'),
  createApprovalMatrix: (body: Record<string, unknown>) => api.post('/attendance/governance/approval-matrices', body),
  updateApprovalMatrix: (id: string, body: Record<string, unknown>) =>
    api.patch(`/attendance/governance/approval-matrices/${id}`, body),
  deleteApprovalMatrix: (id: string) => api.delete(`/attendance/governance/approval-matrices/${id}`),
  todayExceptions: () => api.get('/attendance/governance/exceptions/today'),
  submitAttendanceRequest: (body: { type: string; reason: string; attendanceId?: string; payload?: Record<string, unknown> }) =>
    api.post('/attendance/requests', body),
  attendanceInbox: (params?: { limit?: number; skip?: number; sort?: 'newest' | 'oldest' }) =>
    api.get('/attendance/requests/inbox', { params }),
  myAttendanceRequests: () => api.get('/attendance/requests/mine'),
  approveAttendanceRequest: (id: string, body?: { comment?: string }) =>
    api.post(`/attendance/requests/${id}/approve`, body ?? {}),
  rejectAttendanceRequest: (id: string, body?: { comment?: string }) =>
    api.post(`/attendance/requests/${id}/reject`, body ?? {}),
  escalateAttendanceRequest: (id: string, body?: { comment?: string }) =>
    api.post(`/attendance/requests/${id}/escalate`, body ?? {})
}
