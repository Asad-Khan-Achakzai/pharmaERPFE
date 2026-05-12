/** Human-friendly copy for attendance approval workflow — no internal jargon. */

export type WorkflowTimelineEntry = {
  action: string
  at?: string
  source?: string
  comment?: string
  actorName?: string | null
}

function who(actorName: string | null | undefined, source?: string): string {
  if (source === 'POLICY') return 'Automatic rule'
  if (source === 'SYSTEM') return 'System'
  if (actorName && actorName.trim()) return actorName
  return 'User'
}

/** One line per timeline event for operators (field reps and managers). */
export function describeWorkflowStep(entry: WorkflowTimelineEntry): string {
  const actor = who(entry.actorName, entry.source)
  const a = String(entry.action || '').toUpperCase()
  switch (a) {
    case 'APPROVE':
      return `${actor} approved this step.`
    case 'APPROVE_OVERSIGHT':
      return `${actor} approved (senior manager oversight).`
    case 'REJECT':
      return `${actor} rejected the request.`
    case 'REJECT_OVERSIGHT':
      return `${actor} rejected (senior manager oversight).`
    case 'ESCALATE':
      return `${actor} moved the request to the next approval level.`
    case 'ESCALATE_TO_ADMIN':
      return `${actor} sent the request to the company admin queue.`
    case 'POLICY_ESCALATE_NEXT':
      return 'The request moved up automatically because a response deadline or schedule rule was reached.'
    case 'POLICY_ESCALATE_TO_ADMIN':
      return 'The request was sent to the company admin queue automatically (rule applied).'
    case 'POLICY_MOVE_TO_ADMIN':
      return 'The request was placed in the company admin queue automatically (rule applied).'
    case 'AUTO_REJECT_LATE_ARRIVAL':
      return 'The request was closed automatically after staying open too long (late check-in rule).'
    case 'ATTENDANCE_REQUEST_CREATED':
      return `${actor} submitted this request.`
    case 'REQUEST_APPLIED':
      return 'The approved change was applied to your attendance record.'
    case 'ATTENDANCE_REQUEST_APPROVED_STEP':
    case 'ATTENDANCE_REQUEST_FINAL_APPROVED':
      return `${actor} approved — this step is complete.`
    case 'ATTENDANCE_REQUEST_REJECTED':
    case 'LATE_CHECKIN_REQUEST_REJECTED':
      return `${actor} did not approve this request.`
    case 'ATTENDANCE_REQUEST_ESCALATED':
    case 'ATTENDANCE_REQUEST_ESCALATED_TO_ADMIN_POOL':
      return `${actor} moved the request to a higher level.`
    case 'ATTENDANCE_REQUEST_POLICY_ESCALATION':
      return 'The request moved automatically (response or end-of-day rule).'
    case 'POLICY_AUTO_REJECT':
    case 'ATTENDANCE_REQUEST_AUTO_REJECTED':
    case 'LATE_CHECKIN_REQUEST_AUTO_REJECTED':
      return 'The request was closed automatically after the waiting period.'
    case 'ADMIN_ATTENDANCE_OVERRIDE_APPROVE':
      return `${actor} approved using an admin override.`
    case 'ATTENDANCE_REQUEST_CLOSED_BY_ADMIN_OVERRIDE':
      return `${actor} closed this request (admin).`
    case 'ADMIN_ATTENDANCE_OVERRIDE_CANCEL':
    case 'ATTENDANCE_REQUEST_CANCELLED_BY_ADMIN_OVERRIDE':
      return `${actor} cancelled this request (admin).`
    default:
      if (a.startsWith('POLICY_')) {
        return `Automatic update: ${entry.action?.replace(/^POLICY_/, '').replace(/_/g, ' ').toLowerCase() || 'rule applied'}.`
      }
      return `${actor}: ${entry.action || 'Update'}.`
  }
}

export function formatWorkflowWhen(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return '—'
  }
}

export function slaSummaryLine(minutesRemaining: number | null | undefined): string | null {
  if (minutesRemaining == null || Number.isNaN(minutesRemaining)) return null
  if (minutesRemaining < 0) return `Response target was ${Math.abs(minutesRemaining)} minutes ago — please act or escalate.`
  if (minutesRemaining === 0) return 'Response target is now.'
  if (minutesRemaining < 60) return `About ${minutesRemaining} minutes left before the response target.`
  const h = Math.floor(minutesRemaining / 60)
  const m = minutesRemaining % 60
  return `About ${h}h ${m}m left before the response target.`
}
