/** Browser-local in-progress visit drafts (parity with mobile SQLite visit_drafts). */

export type WebVisitDraftForm = {
  notes: string
  orderTaken: boolean
  productIds: string[]
  primaryProductId: string
  samplesQty: number
  followUpDate: string
  outOfOrderReason: string
}

export type WebVisitDraft = {
  clientUuid: string
  planItemId: string | null
  doctorId: string
  doctorName?: string
  startedAt: string
  updatedAt: number
  visitStarted: boolean
  form: WebVisitDraftForm
}

const STORAGE_KEY = 'pharerp.visitDrafts.v1'

function readAll(): WebVisitDraft[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WebVisitDraft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(rows: WebVisitDraft[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function draftKey(d: WebVisitDraft): string {
  return d.planItemId ? `plan:${d.planItemId}` : `doctor:${d.doctorId}`
}

function dedupeActive(rows: WebVisitDraft[]): WebVisitDraft[] {
  const started = rows.filter(r => r.visitStarted)
  const byKey = new Map<string, WebVisitDraft>()
  for (const row of started) {
    const key = draftKey(row)
    const prev = byKey.get(key)
    if (!prev || row.updatedAt > prev.updatedAt) byKey.set(key, row)
  }
  return [...byKey.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export const visitDraftStorage = {
  listActive(): WebVisitDraft[] {
    const all = readAll()
    const active = dedupeActive(all)
    const keepIds = new Set(active.map(d => d.clientUuid))
    const pruned = all.filter(d => !d.visitStarted || keepIds.has(d.clientUuid))
    if (pruned.length !== all.length) writeAll(pruned)
    return active
  },

  loadByPlanItemId(planItemId: string): WebVisitDraft | null {
    return (
      visitDraftStorage
        .listActive()
        .find(d => d.planItemId === planItemId) ?? null
    )
  },

  save(draft: WebVisitDraft): void {
    const key = draftKey(draft)
    const withoutSameVisit = readAll().filter(d => draftKey(d) !== key)
    writeAll([...withoutSameVisit, { ...draft, updatedAt: Date.now() }])
  },

  clear(clientUuid: string): void {
    writeAll(readAll().filter(d => d.clientUuid !== clientUuid))
  }
}
