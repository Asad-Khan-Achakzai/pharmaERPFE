/** Map mobile/in-app notification links to web dashboard routes. */
export function resolveWebHref(link?: string | null, kind?: string | null): string | null {
  if (!link) {
    if (kind === 'ATTENDANCE') return '/attendance/governance'
    if (kind === 'EXPENSE') return '/expenses/list'
    if (kind === 'WEEKLY_PLAN') return '/weekly-plans'
    if (kind === 'DEVICE') return '/device-control'
    if (kind === 'DOCTOR_LOCATION') return '/doctors/location-review'
    return null
  }
  if (link.includes('approvals')) return '/expenses/list'
  if (link.includes('attendance')) return '/attendance/governance'
  if (link.startsWith('/plan')) return '/weekly-plans'
  if (link.startsWith('/expenses')) return '/expenses/list'
  if (link.startsWith('/order/')) {
    const id = link.split('/')[2]
    return id ? `/orders/${id}` : '/orders/list'
  }
  if (link.startsWith('/doctor/')) {
    return '/doctors/list'
  }
  if (link === '/notifications') return null
  return null
}
