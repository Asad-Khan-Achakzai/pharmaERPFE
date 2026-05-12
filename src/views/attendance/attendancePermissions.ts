import type { User } from '@/contexts/AuthContext'

export type AttendancePermissionFlags = {
  canAccessMe: boolean
  canAccessTeam: boolean
  canAccessAdmin: boolean
  canGovernanceRequestQueue: boolean
  canSeeOversightQueue: boolean
  canEditOwnDelegation: boolean
  canViewReportOthers: boolean
  canSubmitRequest: boolean
  canApprove: boolean
  canEditRules: boolean
  canConfigureSchedules: boolean
  canSeeAlerts: boolean
  isAdminUser: boolean
}

export function getAttendancePermissionFlags(
  user: User | null | undefined,
  hasPermission: (p: string) => boolean
): AttendancePermissionFlags {
  const isAdminUser =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    hasPermission('admin.access')

  const canAccessMe = hasPermission('attendance.view') || hasPermission('attendance.mark')

  const canAccessTeam =
    hasPermission('admin.access') ||
    hasPermission('attendance.viewCompany') ||
    hasPermission('attendance.viewTeam') ||
    hasPermission('attendance.viewEscalations') ||
    hasPermission('attendance.approve') ||
    hasPermission('attendance.approve.direct') ||
    hasPermission('attendance.approve.escalated')

  const canAccessAdmin =
    hasPermission('admin.access') ||
    hasPermission('attendance.governance.view') ||
    hasPermission('attendance.matrix.manage')

  const canViewReportOthers =
    hasPermission('attendance.viewTeam') ||
    hasPermission('attendance.viewCompany') ||
    hasPermission('admin.access')

  const canSubmitRequest = hasPermission('attendance.request.create')

  const canApprove =
    hasPermission('admin.access') ||
    hasPermission('attendance.approve') ||
    hasPermission('attendance.approve.direct') ||
    hasPermission('attendance.approve.escalated')

  const canEditRules = hasPermission('admin.access')
  const canConfigureSchedules =
    hasPermission('admin.access') || hasPermission('attendance.matrix.manage')

  const canSeeAlerts =
    hasPermission('admin.access') ||
    hasPermission('attendance.governance.view') ||
    hasPermission('attendance.viewEscalations') ||
    hasPermission('attendance.viewTeam') ||
    hasPermission('attendance.viewCompany')

  const canGovernanceRequestQueue =
    hasPermission('admin.access') || hasPermission('attendance.governance.view')

  const canSeeOversightQueue =
    hasPermission('admin.access') ||
    hasPermission('attendance.approve.escalated') ||
    hasPermission('attendance.viewEscalations') ||
    hasPermission('attendance.viewCompany')

  const canEditOwnDelegation =
    hasPermission('admin.access') ||
    hasPermission('attendance.approve') ||
    hasPermission('attendance.approve.direct') ||
    hasPermission('attendance.approve.escalated')

  return {
    canAccessMe,
    canAccessTeam,
    canAccessAdmin,
    canGovernanceRequestQueue,
    canSeeOversightQueue,
    canEditOwnDelegation,
    canViewReportOthers,
    canSubmitRequest,
    canApprove,
    canEditRules,
    canConfigureSchedules,
    canSeeAlerts,
    isAdminUser
  }
}
