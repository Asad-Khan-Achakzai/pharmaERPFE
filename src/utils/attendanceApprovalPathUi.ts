/** Business labels for approval-matrix steps (no “resolver” jargon). */

export type ApprovalStepSnapshot = {
  order?: number
  resolverType?: string
  depth?: number
  requiredPermission?: string
}

export function approvalStepRoleLabel(step: ApprovalStepSnapshot | undefined | null): string {
  if (!step) return 'Approval step'
  const rt = String(step.resolverType || '')
  const d = typeof step.depth === 'number' ? step.depth : null
  switch (rt) {
    case 'DIRECT_MANAGER':
      return 'Line manager'
    case 'MANAGER_AT_DEPTH':
      if (d === 1) return 'Second-line manager'
      if (d != null && d > 1) return `Manager level ${d + 1}`
      return 'Senior manager'
    case 'ADMIN_QUEUE':
      return 'Company administrator'
    default:
      return 'Approval step'
  }
}

/** Short line for “who is next” from the frozen path. */
export function nextStepHint(
  steps: ApprovalStepSnapshot[] | null | undefined,
  currentStepIndex: number | null | undefined
): string | null {
  const list = Array.isArray(steps) ? steps : []
  if (!list.length) return null
  const idx = typeof currentStepIndex === 'number' ? currentStepIndex : 0
  const next = list[idx + 1]
  if (!next) return 'Final step — no further level in this path.'
  return `Next when escalated: ${approvalStepRoleLabel(next)}.`
}

export function escalationExplainer(
  steps: ApprovalStepSnapshot[] | null | undefined,
  currentStepIndex: number | null | undefined
): string {
  const hint = nextStepHint(steps, currentStepIndex)
  if (!hint) {
    return 'The request will move to the next person in your company approval path, or to the administrator queue if that is the next step.'
  }
  return `${hint} If nobody acts in time, your company rules may move it automatically.`
}
