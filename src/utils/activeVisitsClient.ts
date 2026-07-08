import { visitsService } from '@/services/visits.service'

export type ActiveVisitForm = {
  notes?: string
  orderTaken?: boolean
  productIds?: string[]
  primaryProductId?: string
  samplesQty?: number
  followUpDate?: string
  outOfOrderReason?: string
  visitStarted?: boolean
}

export type ActiveVisitRecord = {
  clientUuid: string
  planItemId: string | null
  doctorId: string
  doctorName?: string | null
  employeeId?: string
  employeeName?: string | null
  startedAt: string
  updatedAt: string
  visitStarted: boolean
  payload: ActiveVisitForm
}

type UpsertInput = {
  clientUuid: string
  planItemId?: string | null
  doctorId: string
  startedAt: string
  visitStarted?: boolean
  payload: ActiveVisitForm
}

const CACHE_KEY = 'pharerp.activeVisits.cache.v1'
const PENDING_KEY = 'pharerp.activeVisits.pending.v1'

function parseListResponse(res: unknown): ActiveVisitRecord[] {
  const body = (res as { data?: { data?: { items?: ActiveVisitRecord[] } | ActiveVisitRecord[] } })?.data
  const payload = body?.data
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: ActiveVisitRecord[] }).items)) {
    return (payload as { items: ActiveVisitRecord[] }).items
  }
  if (Array.isArray(payload)) return payload
  return []
}

function parseUpsertResponse(res: unknown): ActiveVisitRecord | null {
  const payload = (res as { data?: { data?: ActiveVisitRecord } })?.data?.data
  return payload && typeof payload === 'object' && 'clientUuid' in payload ? payload : null
}

function readCache(): ActiveVisitRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActiveVisitRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCache(items: ActiveVisitRecord[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(items))
}

function readPending(): UpsertInput[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UpsertInput[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePending(rows: UpsertInput[]): void {
  if (typeof window === 'undefined') return
  if (!rows.length) {
    window.localStorage.removeItem(PENDING_KEY)
    return
  }
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(rows))
}

function draftKey(row: Pick<ActiveVisitRecord, 'planItemId' | 'doctorId' | 'clientUuid'>): string {
  return row.planItemId ? `plan:${row.planItemId}` : `doctor:${row.doctorId}:${row.clientUuid}`
}

function dedupe(items: ActiveVisitRecord[]): ActiveVisitRecord[] {
  const byKey = new Map<string, ActiveVisitRecord>()
  for (const row of items.filter(r => r.visitStarted !== false)) {
    const key = draftKey(row)
    const prev = byKey.get(key)
    const prevTs = prev ? new Date(prev.updatedAt || prev.startedAt).getTime() : 0
    const rowTs = new Date(row.updatedAt || row.startedAt).getTime()
    if (!prev || rowTs >= prevTs) byKey.set(key, row)
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime()
  )
}

function upsertIntoCache(cache: ActiveVisitRecord[], input: UpsertInput, doctorName?: string): ActiveVisitRecord[] {
  const now = new Date().toISOString()
  const record: ActiveVisitRecord = {
    clientUuid: input.clientUuid,
    planItemId: input.planItemId ?? null,
    doctorId: input.doctorId,
    doctorName: doctorName ?? null,
    startedAt: input.startedAt,
    updatedAt: now,
    visitStarted: input.visitStarted !== false,
    payload: input.payload
  }
  const next = cache.filter(r => draftKey(r) !== draftKey(record))
  next.unshift(record)
  return dedupe(next)
}

function enqueuePending(input: UpsertInput): void {
  const pending = readPending().filter(p => p.clientUuid !== input.clientUuid)
  pending.push(input)
  writePending(pending)
}

async function flushPending(): Promise<boolean> {
  const pending = readPending()
  if (!pending.length) return true
  const remaining: UpsertInput[] = []
  for (const row of pending) {
    try {
      await visitsService.upsertActive(row)
    } catch {
      remaining.push(row)
      break
    }
  }
  writePending(remaining)
  return remaining.length === 0
}

export const activeVisitsClient = {
  readCache,

  async list(params?: { employeeId?: string }): Promise<ActiveVisitRecord[]> {
    await flushPending()
    try {
      const res = await visitsService.listActive(params)
      const items = dedupe(parseListResponse(res))
      writeCache(items)
      return items
    } catch {
      return dedupe(readCache())
    }
  },

  async listTeam(params?: { employeeId?: string }): Promise<ActiveVisitRecord[]> {
    const res = await visitsService.listTeamActive(params)
    return dedupe(parseListResponse(res))
  },

  async upsert(
    input: UpsertInput,
    opts?: { doctorName?: string; optimistic?: boolean }
  ): Promise<ActiveVisitRecord> {
    const cache = readCache()
    const optimistic = upsertIntoCache(cache, input, opts?.doctorName)
    writeCache(optimistic)
    enqueuePending(input)

    const flushed = await flushPending()
    if (flushed) {
      try {
        const res = await visitsService.upsertActive(input)
        const saved = parseUpsertResponse(res)
        if (saved) {
          writeCache(upsertIntoCache(readCache(), input, saved.doctorName ?? opts?.doctorName))
          return saved
        }
      } catch {
        /* fall through to optimistic */
      }
      try {
        const items = await activeVisitsClient.list()
        const match =
          items.find(r => r.clientUuid === input.clientUuid) ??
          (input.planItemId ? items.find(r => r.planItemId === input.planItemId) : null)
        if (match) return match
      } catch {
        /* ignore */
      }
    }

    return optimistic.find(r => r.clientUuid === input.clientUuid) ?? optimistic[0]
  },

  async clear(clientUuid: string): Promise<void> {
    writeCache(readCache().filter(r => r.clientUuid !== clientUuid))
    writePending(readPending().filter(p => p.clientUuid !== clientUuid))
    try {
      await visitsService.clearActive(clientUuid)
    } catch {
      /* offline — cleared locally; server may retain until next successful clear */
    }
  },

  findByPlanItemId(items: ActiveVisitRecord[], planItemId: string): ActiveVisitRecord | null {
    return items.find(r => r.planItemId === planItemId) ?? null
  }
}
