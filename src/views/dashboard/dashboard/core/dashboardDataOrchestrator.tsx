'use client'

/**
 * Single data plane for the V3 dashboard: one `load` coordinates all slices.
 * Unified: GET /dashboard/home (NEXT_PUBLIC_ENABLE_NEW_DASHBOARD + server flag).
 * Fallback: one parallel batch (or second batch after bundle failure) — no per-widget fetches.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { reportsService } from '@/services/reports.service'
import { dashboardService } from '@/services/dashboard.service'
import { planItemsService } from '@/services/planItems.service'
import { targetsService } from '@/services/targets.service'
import { attendanceService } from '@/services/attendance.service'
import { supplierService } from '@/services/supplier.service'
import { mapDashboardFinancial } from '@/utils/financialMapper'
import type { DashboardHomePayload } from '@/types/dashboardHome'
import type { User } from '@/contexts/AuthContext'
import type { TodayBoard } from '@/views/dashboard/dashboard.types'
import { showApiError } from '@/utils/apiErrors'
import { currentMonthRange } from '@/utils/currentMonthRange'
import { resolveDashboardMode } from '../engine/widgetResolver'
import type { DashboardMode } from './dashboardTypes'
import { parseTodayExecutionResponse, type TodayExecutionPayload } from '@/utils/planExecutionPayload'

const USE_UNIFIED_HOME = process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true'

let kpiClientCache: unknown = null

function isAbort(e: unknown) {
  return isAxiosError(e) && e.code === 'ERR_CANCELED'
}

export type DashboardV3DataContextValue = {
  user: User
  hasPermission: (p: string) => boolean
  /** System Administrator dashboard tier — attendance team shell, etc. */
  isFullDashboardUser: boolean
  mode: DashboardMode
  kpi: ReturnType<typeof mapDashboardFinancial> | null
  kpiLoading: boolean
  kpiError: boolean
  /** Charts, company supplier widgets, full P&L context — `admin.access` */
  canSeeCompanyFinancials: boolean
  /** Dashboard slice (current month) for order counts + greeting TP — `dashboard.view` */
  canLoadDashboardKpis: boolean
  home: DashboardHomePayload | null
  bundleFailed: boolean
  bundleLoading: boolean
  planItems: unknown[]
  monthTarget: unknown | null
  todayBoard: TodayBoard | null
  meToday: unknown | null
  teamAttendanceLoading: boolean
  meTodayLoading: boolean
  recentSupplierPayments: unknown[]
  topSuppliersPayable: unknown[]
  supplierPaymentsLoading: boolean
  supplierPayablesLoading: boolean
  nonCriticalReady: boolean
  refetch: () => void
  /** Today’s route execution bundle (GET /plan-items/today shape) when `weeklyPlans.view` */
  todayExecution: TodayExecutionPayload | null
}

const DashboardV3DataContext = createContext<DashboardV3DataContextValue | null>(null)

export function useDashboardV3Data(): DashboardV3DataContextValue {
  const c = useContext(DashboardV3DataContext)
  if (!c) throw new Error('useDashboardV3Data must be used under DashboardV3DataProvider')
  return c
}

type ProviderProps = {
  user: User
  hasPermission: (p: string) => boolean
  isFullDashboardUser: boolean
  children: ReactNode
}

const ym = () =>
  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

export function DashboardV3DataProvider({
  user,
  hasPermission: has,
  isFullDashboardUser,
  children
}: ProviderProps) {
  const canSeeCompanyFinancials = has('admin.access')
  const canLoadDashboardKpis = has('dashboard.view')
  const canWeekly = has('weeklyPlans.view')
  const canTargets = has('targets.view')
  /** Team “who’s in” — company admins with attendance visibility */
  const canTeam =
    canSeeCompanyFinancials && (has('attendance.view') || has('attendance.viewTeam'))
  /** Load “my today” for every signed-in user so the dashboard card can show read-only status without `attendance.mark`. */
  const canLoadMeToday = Boolean(user?._id)
  const canSup = canSeeCompanyFinancials && has('suppliers.view')
  const mode = useMemo(() => resolveDashboardMode(has, isFullDashboardUser), [has, isFullDashboardUser])

  const [kpi, setKpi] = useState<ReturnType<typeof mapDashboardFinancial> | null>(null)
  const [kpiLoading, setKpiLoading] = useState(() => Boolean(canSeeCompanyFinancials && canLoadDashboardKpis))
  const [kpiError, setKpiError] = useState(false)
  const [home, setHome] = useState<DashboardHomePayload | null>(null)
  const [bundleFailed, setBundleFailed] = useState(false)
  const [bundleLoading, setBundleLoading] = useState(USE_UNIFIED_HOME)
  const [planItems, setPlanItems] = useState<unknown[]>([])
  const [todayExecution, setTodayExecution] = useState<TodayExecutionPayload | null>(null)
  const [monthTarget, setMonthTarget] = useState<unknown | null>(null)
  const [todayBoard, setTodayBoard] = useState<TodayBoard | null>(null)
  const [meToday, setMeToday] = useState<unknown | null>(null)
  const [teamLoad, setTeamLoad] = useState(true)
  const [meLoad, setMeLoad] = useState(true)
  const [recPay, setRecPay] = useState<unknown[]>([])
  const [topPay, setTopPay] = useState<unknown[]>([])
  const [spLoad, setSpLoad] = useState(true)
  const [sbLoad, setSbLoad] = useState(true)
  const [nonCriticalReady, setNonCriticalReady] = useState(false)
  const gen = useRef(0)

  const runLegacyBatch = useCallback(
    async (runId: number) => {
      const mp = currentMonthRange()
      const settled = await Promise.allSettled([
        canSeeCompanyFinancials ? reportsService.dashboard({ params: mp }) : Promise.resolve(null),
        canWeekly ? planItemsService.listToday() : Promise.resolve(null),
        canTargets && user?._id ? targetsService.getByRep(String(user._id)) : Promise.resolve(null),
        canTeam ? attendanceService.today() : Promise.resolve(null),
        canLoadMeToday ? attendanceService.meToday() : Promise.resolve(null)
      ])
      if (runId !== gen.current) return

      const kRes = settled[0]
      if (kRes.status === 'fulfilled' && kRes.value && canSeeCompanyFinancials) {
        const ax = kRes.value as { data: { data?: unknown } & { success?: boolean } }
        const raw = ax.data && 'data' in ax.data && ax.data.data != null ? ax.data.data : ax.data
        const m = mapDashboardFinancial(raw)
        kpiClientCache = m
        setKpi(m)
        setKpiError(false)
      } else if (canSeeCompanyFinancials) {
        setKpiError(true)
      } else {
        setKpi(null)
      }
      setKpiLoading(false)

      if (settled[1].status === 'fulfilled' && settled[1].value) {
        const ax = settled[1].value as { data: { data?: unknown } }
        const exec = parseTodayExecutionResponse(ax)
        setTodayExecution(exec)
        const pend = exec?.items.filter(i => (i as { status?: string })?.status === 'PENDING') ?? []
        setPlanItems(pend)
      } else {
        setTodayExecution(null)
        setPlanItems([])
      }

      if (settled[2].status === 'fulfilled' && settled[2].value && canTargets) {
        const rawB = (settled[2].value as { data: { data: { month?: string }[] } }).data?.data
        const list = Array.isArray(rawB) ? rawB : []
        const y = ym()
        setMonthTarget((list as { month?: string }[]).find((x) => x.month === y) ?? list[0] ?? null)
      } else setMonthTarget(null)

      if (settled[3].status === 'fulfilled' && settled[3].value && canTeam) {
        const board = (settled[3].value as { data: { data: TodayBoard } })?.data?.data
        setTodayBoard(board ?? null)
      } else setTodayBoard(null)
      setTeamLoad(false)

      if (settled[4].status === 'fulfilled' && settled[4].value && canLoadMeToday) {
        const p = (settled[4].value as { data: { data: unknown } })?.data?.data
        setMeToday(p ?? null)
      } else setMeToday(null)
      setMeLoad(false)

      if (canSup) {
        setSpLoad(true)
        setSbLoad(true)
        const [p1, p2] = await Promise.allSettled([
          supplierService.recentPayments({ limit: 8 }),
          supplierService.balancesSummary()
        ])
        if (runId !== gen.current) return
        if (p1.status === 'fulfilled') {
          const rp = (p1.value as { data: { data?: { docs?: unknown[] } } })?.data?.data?.docs
          setRecPay(Array.isArray(rp) ? rp : [])
        } else setRecPay([])
        if (p2.status === 'fulfilled') {
          const rows = (p2.value as { data: { data?: { rows?: unknown[] } } })?.data?.data?.rows
          setTopPay(Array.isArray(rows) ? rows.slice(0, 8) : [])
        } else setTopPay([])
        setSpLoad(false)
        setSbLoad(false)
      } else {
        setRecPay([])
        setTopPay([])
        setSpLoad(false)
        setSbLoad(false)
      }
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => setNonCriticalReady(true), { timeout: 500 })
      } else {
        setTimeout(() => setNonCriticalReady(true), 120)
      }
    },
    [canSeeCompanyFinancials, canWeekly, canTargets, canTeam, canLoadMeToday, canSup, user?._id]
  )

  const load = useCallback(async () => {
    const runId = ++gen.current
    setBundleFailed(false)
    if (!canSeeCompanyFinancials) {
      setKpi(null)
      setKpiLoading(false)
      setKpiError(false)
    }
    if (USE_UNIFIED_HOME) {
      setBundleLoading(true)
      if (canSeeCompanyFinancials) setKpiLoading(true)
    } else if (canSeeCompanyFinancials) {
      setKpiLoading(true)
    }
    try {
      if (USE_UNIFIED_HOME) {
        try {
          const r = await dashboardService.home({ params: currentMonthRange() })
          if (runId !== gen.current) return
          const raw = (r.data as { data: DashboardHomePayload }).data
          setHome(raw)
          if (canSeeCompanyFinancials && raw.kpis) {
            const m = mapDashboardFinancial(raw.kpis)
            kpiClientCache = m
            setKpi(m)
            setKpiError(false)
          } else if (canSeeCompanyFinancials) {
            setKpi(null)
            setKpiError(true)
          } else {
            setKpi(null)
            setKpiError(false)
          }
          const ex = raw.today?.execution
          if (ex && typeof ex === 'object' && 'items' in ex && Array.isArray((ex as TodayExecutionPayload).items)) {
            setTodayExecution(ex as TodayExecutionPayload)
          } else {
            setTodayExecution(null)
          }
          if (raw.today?.pendingPlanItems?.length) setPlanItems(raw.today.pendingPlanItems as unknown[])
          else if (Array.isArray(raw.today?.visits) && raw.today.visits.length)
            setPlanItems(raw.today.visits as unknown[])
          else setPlanItems([])
          setMonthTarget(raw.targets?.currentMonth ?? null)
          if (canTeam && raw.attendance?.team) setTodayBoard(raw.attendance.team as TodayBoard)
          else setTodayBoard(null)
          setMeToday(raw.attendance?.me ?? null)
          if (canSup && raw.suppliers?.recentPayments) {
            const d = (raw.suppliers.recentPayments as { docs?: unknown[] })?.docs
            setRecPay(Array.isArray(d) ? d : [])
          } else setRecPay([])
          if (canSup && raw.suppliers?.balances) {
            const rows = (raw.suppliers.balances as { rows?: unknown[] })?.rows
            setTopPay(Array.isArray(rows) ? rows.slice(0, 8) : [])
          } else setTopPay([])
          setSpLoad(false)
          setSbLoad(false)
          setTeamLoad(false)
          setMeLoad(false)
          setBundleLoading(false)
          setKpiLoading(false)
          setNonCriticalReady(true)
          return
        } catch (e) {
          if (isAbort(e)) return
          if (runId !== gen.current) return
          setBundleFailed(true)
        }
      }
      await runLegacyBatch(runId)
    } catch (e) {
      if (!isAbort(e)) showApiError(e, 'Dashboard load')
    }
  }, [canSeeCompanyFinancials, canTeam, canSup, user?._id, runLegacyBatch])

  useEffect(() => {
    if (!user) return
    void load()
  }, [user?._id, load])

  const refetch = useCallback(() => {
    void load()
  }, [load])

  const value: DashboardV3DataContextValue = {
    user,
    hasPermission: has,
    isFullDashboardUser,
    mode,
    kpi,
    kpiLoading,
    kpiError,
    canSeeCompanyFinancials,
    canLoadDashboardKpis,
    home,
    bundleFailed,
    bundleLoading,
    planItems,
    todayExecution,
    monthTarget,
    todayBoard,
    meToday,
    teamAttendanceLoading: teamLoad,
    meTodayLoading: meLoad,
    recentSupplierPayments: recPay,
    topSuppliersPayable: topPay,
    supplierPaymentsLoading: spLoad,
    supplierPayablesLoading: sbLoad,
    nonCriticalReady,
    refetch
  }

  return <DashboardV3DataContext.Provider value={value}>{children}</DashboardV3DataContext.Provider>
}
