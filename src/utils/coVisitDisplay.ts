/** Display helpers for co-visit plan items (today execution + week board). */

export function participantDisplayName(p: {
  name?: string | null
  employeeId?: { name?: string | null } | string | null
}): string | null {
  if (p.name?.trim()) return p.name.trim()
  const emp = p.employeeId
  if (emp && typeof emp === 'object' && emp.name?.trim()) return emp.name.trim()
  return null
}

export function isCoVisitItem(it: {
  coVisit?: boolean
  coVisitRole?: string
  isCoVisitParticipantView?: boolean
  participants?: unknown[]
}): boolean {
  return Boolean(
    it.coVisit ||
      it.coVisitRole === 'PARTICIPANT' ||
      it.isCoVisitParticipantView ||
      (it.participants?.length ?? 0) > 0
  )
}

export function coVisitWithLabel(it: {
  coVisit?: boolean
  coVisitRole?: string
  isCoVisitParticipantView?: boolean
  owner?: { name?: string | null }
  participants?: { name?: string | null; employeeId?: { name?: string | null } | string | null }[]
}): string | null {
  const isParticipant = it.coVisitRole === 'PARTICIPANT' || it.isCoVisitParticipantView
  if (isParticipant) {
    const owner = it.owner?.name?.trim()
    return owner ? `with ${owner}` : null
  }
  const partners = (it.participants ?? []).map(participantDisplayName).filter(Boolean) as string[]
  if (partners.length) return `with ${partners.join(', ')}`
  if (it.coVisit) return null
  return null
}

export function coVisitChipLabel(it: Parameters<typeof coVisitWithLabel>[0]): string {
  const withLabel = coVisitWithLabel(it)
  return withLabel ? `Co-visit · ${withLabel}` : 'Co-visit'
}

/** Tab filter — participants use lifecycle, owners use plan item status. */
export function planItemMatchesVisitTab(
  item: {
    status?: string
    coVisitRole?: string
    isCoVisitParticipantView?: boolean
    myLifecycleStatus?: string
  },
  tab: 'pending' | 'visited' | 'missed'
): boolean {
  const isParticipant = item.coVisitRole === 'PARTICIPANT' || item.isCoVisitParticipantView === true
  if (isParticipant) {
    const ls = item.myLifecycleStatus
    if (tab === 'pending') {
      return ls !== 'COMPLETED' && ls !== 'DECLINED' && ls !== 'MISSED'
    }
    if (tab === 'visited') return ls === 'COMPLETED'
    if (tab === 'missed') return ls === 'MISSED'
    return false
  }
  if (tab === 'pending') return item.status === 'PENDING'
  if (tab === 'visited') return item.status === 'VISITED'
  return item.status === 'MISSED'
}
