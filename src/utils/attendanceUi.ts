/** Pure UI helpers for attendance — no API or business logic changes. */

export type AttendanceRequestTypeCode =
  | 'LATE_ARRIVAL'
  | 'MISSED_CHECKOUT'
  | 'TIME_CORRECTION'
  | 'MANUAL_EXCEPTION'

export function requestTypeLabel(type: string): string {
  switch (type) {
    case 'LATE_ARRIVAL':
      return 'Late arrival'
    case 'MISSED_CHECKOUT':
      return 'Missing checkout'
    case 'TIME_CORRECTION':
      return 'Time correction'
    case 'MANUAL_EXCEPTION':
      return 'Attendance exception'
    default:
      return type
  }
}

export function requestStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending'
    case 'APPROVED':
      return 'Approved'
    case 'REJECTED':
      return 'Rejected'
    case 'ESCALATED':
      return 'Higher approval'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status
  }
}

/** Maps approval step type to plain language (admin screens). */
export function approvalStepLabel(resolverType: string, depth?: number): string {
  switch (resolverType) {
    case 'DIRECT_MANAGER':
      return 'Direct manager'
    case 'MANAGER_AT_DEPTH':
      return depth != null ? `Manager level ${depth}` : 'Manager (hierarchy)'
    case 'ADMIN_QUEUE':
      return 'Company administrator'
    default:
      return 'Approval step'
  }
}

export function requestCategoryLabel(cat: string): string {
  if (cat === 'ALL' || !cat) return 'All request types'
  return requestTypeLabel(cat)
}

/** Convert minutes-from-midnight to HH:MM for time input (local day semantics on client). */
export function minutesToTimeInput(mins: number): string {
  const m = Math.max(0, Math.min(1439, Math.floor(mins)))
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Parse `<input type="time">` value to minutes from midnight. */
export function timeInputToMinutes(value: string): number | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null
  const [a, b] = value.split(':').map(Number)
  if (a < 0 || a > 23 || b < 0 || b > 59) return null
  return a * 60 + b
}

export function formatShiftRangeLabel(startMinutes: number, endMinutes: number, overnight: boolean): string {
  const s = minutesToTimeInput(startMinutes)
  const e = minutesToTimeInput(endMinutes)
  return overnight ? `${s} → ${e} (next day)` : `${s} – ${e}`
}

export function employeeStatusLabel(status: string): string {
  switch (status) {
    case 'PRESENT':
      return 'Present'
    case 'LATE_CHECKIN_PENDING':
      return 'Late check-in (pending)'
    case 'ABSENT':
      return 'Absent'
    case 'HALF_DAY':
      return 'Half day'
    case 'LEAVE':
      return 'Leave'
    case 'NOT_MARKED':
      return 'Not marked'
    default:
      return status
  }
}
