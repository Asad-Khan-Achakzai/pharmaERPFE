'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import type { ApexOptions } from 'apexcharts'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import { dashboardService } from '@/services/dashboard.service'
import { mapDashboardFinancial } from '@/utils/financialMapper'
import type { DashboardHomePayload } from '@/types/dashboardHome'
import type { RepExecutionPrefetch } from '@/views/dashboard/RepExecutionSection'
import { attendanceService } from '@/services/attendance.service'
import { supplierService } from '@/services/supplier.service'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminLike } from '@/utils/roleHelpers'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { isAxiosError } from 'axios'
import { currentMonthRange } from '@/utils/currentMonthRange'
import DashboardSnapshotKpis from '@/views/dashboard/DashboardSnapshotKpis'
import DashboardWelcomeColumn from '@/views/dashboard/DashboardWelcomeColumn'
import MyAttendanceCard from '@/views/dashboard/MyAttendanceCard'
import DashboardChartsSection from '@/views/dashboard/DashboardChartsSection'
import DashboardSupplierSection from '@/views/dashboard/DashboardSupplierSection'
import DashboardAttendanceSection from '@/views/dashboard/DashboardAttendanceSection'
import DashboardQuickActions, { type QuickAction } from '@/views/dashboard/DashboardQuickActions'
import RepExecutionSection from '@/views/dashboard/RepExecutionSection'
import { TeamSummaryWidget } from '@/views/dashboard/dashboard/engine/widgets/TeamSummaryWidget'
import { orderQuickActions, resolveDashboardLayout } from '@/views/dashboard/dashboardLayout'
import { isFullDashboardUser } from '@/views/dashboard/dashboard/engine/dashboardExperience'
import type { TodayBoard, TodayEmployee } from '@/views/dashboard/dashboard.types'

function isAbortError(e: unknown): boolean {
  return isAxiosError(e) && e.code === 'ERR_CANCELED'
}

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const donutColors = ['#00d4bd', '#ffa1a1', '#826bf8', '#32baff']

/** Set `window.__DASH_DEBUG__ = true` in the browser console to enable logs outside development. */
function dashDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    process.env.NODE_ENV === 'development' ||
    (window as unknown as { __DASH_DEBUG__?: boolean }).__DASH_DEBUG__ === true
  )
}

function dashLog(phase: string, data?: Record<string, unknown>) {
  if (!dashDebugEnabled()) return
  const ms = Math.round(performance.now())
  if (data && Object.keys(data).length > 0) {
    console.log(`[Dashboard +${ms}ms] ${phase}`, data)
  } else {
    console.log(`[Dashboard +${ms}ms] ${phase}`)
  }
}

let dashboardKpiCache: any = null

/** Set NEXT_PUBLIC_ENABLE_NEW_DASHBOARD=true and backend ENABLE_NEW_DASHBOARD=true to use one GET /dashboard/home. */
const USE_HOME_BUNDLE = process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true'

/** Pre–V3 dashboard implementation; kept for ENABLE_DASHBOARD_V3=false. */
const LegacyDashboardView = () => {
  const { user, hasPermission } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  /**
   * Use resolved permissions (same as API), not legacy `user.role`.
   * Users with `roleId` may still have `role: 'MEDICAL_REP'` in the user record while permissions come only from the Role document.
   */
  const attendanceScope = useMemo(() => {
    if (!user) return { team: false }
    /** “Employees working today” is executive dashboard only; My attendance stays for everyone */
    return {
      team: hasPermission('admin.access') && hasPermission('attendance.view')
    }
  }, [user, hasPermission])

  const showCompanyAttendance = attendanceScope.team
  /** Show “my attendance” for every signed-in user; check-in/out still require `attendance.mark`. */
  const showMyAttendance = Boolean(user)
  const [data, setData] = useState<any>(dashboardKpiCache)
  const [loadError, setLoadError] = useState(false)
  const [dashboardDataLoading, setDashboardDataLoading] = useState(!dashboardKpiCache)
  const [todayBoard, setTodayBoard] = useState<TodayBoard | null>(null)
  /** Start true so team card does not flash the error state before the first fetch. */
  const [teamAttendanceLoading, setTeamAttendanceLoading] = useState(true)
  const [meToday, setMeToday] = useState<any>(null)
  const [meTodayLoading, setMeTodayLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [markAbsentConfirmOpen, setMarkAbsentConfirmOpen] = useState(false)
  const [pendingAbsent, setPendingAbsent] = useState<{ employeeId: string; name: string } | null>(null)
  const [adminAttendanceBusy, setAdminAttendanceBusy] = useState(false)
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null)
  const [statusMenuEmployee, setStatusMenuEmployee] = useState<{ employeeId: string; name: string } | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const textSecondary = 'var(--mui-palette-text-secondary)'
  const canViewInventory = useMemo(() => hasPermission('inventory.view'), [hasPermission])

  const canViewSuppliers = useMemo(() => hasPermission('suppliers.view'), [hasPermission])

  const showStatsKpis = useMemo(() => hasPermission('dashboard.view'), [hasPermission])

  const [homeBundle, setHomeBundle] = useState<DashboardHomePayload | null>(null)
  const [homeBundleFailed, setHomeBundleFailed] = useState(false)
  const bundleLoading = USE_HOME_BUNDLE && Boolean(user) && !homeBundle && !homeBundleFailed

  const layout = useMemo(
    () =>
      user ? resolveDashboardLayout(hasPermission, isFullDashboardUser(user)) : null,
    [user, hasPermission]
  )

  const repPrefetch = useMemo((): RepExecutionPrefetch | undefined => {
    if (!USE_HOME_BUNDLE || !homeBundle || !layout?.showExecutionPanel) return undefined
    return {
      planItems: (homeBundle.today?.pendingPlanItems || []) as RepExecutionPrefetch['planItems'],
      monthTarget: (homeBundle.targets?.currentMonth as RepExecutionPrefetch['monthTarget']) || null
    }
  }, [USE_HOME_BUNDLE, homeBundle, layout?.showExecutionPanel])

  const quickFirst = isMobile && USE_HOME_BUNDLE

  useEffect(() => {
    if (!USE_HOME_BUNDLE || !user) return
    let cancelled = false
    setHomeBundle(null)
    setHomeBundleFailed(false)
    setDashboardDataLoading(true)
    dashboardService
      .home({ params: currentMonthRange() })
      .then(r => {
        if (cancelled) return
        const raw = (r.data as { data: DashboardHomePayload }).data
        setHomeBundle(raw)
        if (raw.kpis) {
          const mapped = mapDashboardFinancial(raw.kpis)
          setData(mapped)
          dashboardKpiCache = mapped
          setLoadError(false)
        } else {
          setData(null)
          setLoadError(false)
        }
        setDashboardDataLoading(false)
        if (raw.attendance?.team) {
          setTodayBoard(raw.attendance.team as TodayBoard)
        } else {
          setTodayBoard(null)
        }
        setTeamAttendanceLoading(false)
        setMeToday(raw.attendance?.me ?? null)
        setMeTodayLoading(false)
        if (raw.suppliers?.recentPayments) {
          const rp = (raw.suppliers.recentPayments as { docs?: unknown[] })?.docs ?? []
          setRecentSupplierPayments(Array.isArray(rp) ? rp : [])
        } else {
          setRecentSupplierPayments([])
        }
        if (raw.suppliers?.balances) {
          const rows = (raw.suppliers.balances as { rows?: unknown[] })?.rows ?? []
          setTopSuppliersPayable(Array.isArray(rows) ? rows.slice(0, 8) : [])
        } else {
          setTopSuppliersPayable([])
        }
        setSupplierPaymentsLoading(false)
        setSupplierPayablesLoading(false)
        setNonCriticalReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setHomeBundleFailed(true)
          setDashboardDataLoading(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [USE_HOME_BUNDLE, user?._id])

  const isAdmin = isAdminLike(user?.role)

  /**
   * Profit/inventory charts use `next/dynamic` with local skeletons; supplier cards use
   * `supplierPaymentsLoading` / `supplierPayablesLoading` (separate fetches, same pattern as attendance).
   */

  const [supplierPaymentsLoading, setSupplierPaymentsLoading] = useState(true)
  const [supplierPayablesLoading, setSupplierPayablesLoading] = useState(true)
  const [recentSupplierPayments, setRecentSupplierPayments] = useState<any[]>([])
  const [topSuppliersPayable, setTopSuppliersPayable] = useState<any[]>([])
  /**
   * Non-critical widgets are mounted only after critical KPIs render + main thread is idle.
   * This improves TTI by reducing first-paint CPU and request fan-out.
   */
  const [nonCriticalReady, setNonCriticalReady] = useState(false)

  /**
   * Overlapping attendance fetches (Strict Mode, or attendanceScope updating) used to leave
   * `meTodayLoading` stuck true: an older request's `finally` could run after a newer request
   * set loading true, or two `set(false)` calls raced with a third `set(true)`. Only the latest
   * generation may clear loading or apply results.
   */
  const teamAttendanceFetchGenRef = useRef(0)
  const meTodayFetchGenRef = useRef(0)
  const teamAttendanceLoadRunRef = useRef(0)
  const meAttendanceLoadRunRef = useRef(0)

  /**
   * Team and me are loaded in **separate** effects. A slow `/attendance/me/today` must not delay
   * the team card: previously one `loadAttendanceWidgets` + shared `tRunStart` / `Promise.all`
   * made logs and mental model couple the two; `/me/today` can take 10s+ while `/today` returns in
   * under ~1s (server/DB variance + connection limits). In-flight GET dedupe still applies per service.
   */
  const loadTeamAttendanceWidgets = useCallback((): Promise<void> => {
    const runId = ++teamAttendanceLoadRunRef.current
    const tRunStart = performance.now()
    const canCompany = attendanceScope.team

    if (!canCompany) {
      teamAttendanceFetchGenRef.current += 1
      setTodayBoard(null)
      setTeamAttendanceLoading(false)
      dashLog('loadAttendanceWidgets:invalidateTeam', { runId, teamGenNow: teamAttendanceFetchGenRef.current })
      return Promise.resolve()
    }

    const teamGen = ++teamAttendanceFetchGenRef.current
    setTeamAttendanceLoading(true)
    dashLog('loadAttendanceWidgets:teamFetchScheduled', { runId, teamGen })

    return (async () => {
      const t0 = performance.now()
      let committedSuccessWithData = false
      try {
        const r = await attendanceService.today()
        const elapsed = Math.round(performance.now() - t0)
        const currentGen = teamAttendanceFetchGenRef.current
        const applied = teamGen === currentGen
        dashLog('attendance:team:response', {
          runId,
          teamGen,
          currentGen,
          ms: elapsed,
          appliedData: applied
        })
        if (applied) {
          const board = r.data.data as TodayBoard
          setTodayBoard(board)
          setTeamAttendanceLoading(false)
          committedSuccessWithData = true
        } else {
          dashLog('attendance:team:staleIgnored', { runId, teamGen, currentGen })
        }
      } catch (err) {
        if (isAbortError(err)) {
          dashLog('attendance:team:aborted', { runId, teamGen })
          return
        }
        showApiError(err, 'Failed to load team attendance')
        const currentGen = teamAttendanceFetchGenRef.current
        const applied = teamGen === currentGen
        dashLog('attendance:team:error', { runId, teamGen, currentGen, applied })
        if (applied) {
          setTodayBoard(null)
        }
      } finally {
        const currentGen = teamAttendanceFetchGenRef.current
        const willClear = teamGen === currentGen
        dashLog('attendance:team:finally', {
          runId,
          teamGen,
          currentGen,
          willClearTeamLoading: willClear,
          sinceRunStartMs: Math.round(performance.now() - tRunStart)
        })
        if (willClear && !committedSuccessWithData) {
          setTeamAttendanceLoading(false)
        }
      }
    })()
  }, [attendanceScope.team])

  const loadMyAttendanceWidget = useCallback((): Promise<void> => {
    const runId = ++meAttendanceLoadRunRef.current
    const tRunStart = performance.now()
    const meGen = ++meTodayFetchGenRef.current
    setMeTodayLoading(true)
    dashLog('loadAttendanceWidgets:meFetchScheduled', { runId, meGen })

    return (async () => {
      const t0 = performance.now()
      let committedSuccessWithData = false
      try {
        const m = await attendanceService.meToday()
        const elapsed = Math.round(performance.now() - t0)
        const currentGen = meTodayFetchGenRef.current
        const applied = meGen === currentGen
        dashLog('attendance:meToday:response', {
          runId,
          meGen,
          currentGen,
          ms: elapsed,
          appliedData: applied
        })
        if (applied) {
          const payload = m.data.data
          setMeToday(payload)
          setMeTodayLoading(false)
          committedSuccessWithData = true
        } else {
          dashLog('attendance:meToday:staleIgnored', { runId, meGen, currentGen })
        }
      } catch (err) {
        if (isAbortError(err)) {
          dashLog('attendance:meToday:aborted', { runId, meGen })
          return
        }
        showApiError(err, 'Failed to load my attendance')
        const currentGen = meTodayFetchGenRef.current
        const applied = meGen === currentGen
        dashLog('attendance:meToday:error', { runId, meGen, currentGen, applied })
        if (applied) {
          setMeToday(null)
        }
      } finally {
        const currentGen = meTodayFetchGenRef.current
        const willClear = meGen === currentGen
        dashLog('attendance:meToday:finally', {
          runId,
          meGen,
          currentGen,
          willClearMeLoading: willClear,
          sinceRunStartMs: Math.round(performance.now() - tRunStart)
        })
        if (willClear && !committedSuccessWithData) {
          setMeTodayLoading(false)
        }
      }
    })()
  }, [user])

  /** Check-in / admin tools: refresh both resources and await completion. */
  const loadAttendanceWidgets = useCallback(async () => {
    dashLog('loadAttendanceWidgets:refreshBoth', {
      teamGen: teamAttendanceFetchGenRef.current,
      meGen: meTodayFetchGenRef.current
    })
    await Promise.all([loadTeamAttendanceWidgets(), loadMyAttendanceWidget()])
  }, [loadTeamAttendanceWidgets, loadMyAttendanceWidget])

  useEffect(() => {
    const ac = new AbortController()
    if (!user || !layout) {
      return () => ac.abort()
    }
    if (USE_HOME_BUNDLE && !homeBundleFailed) {
      if (!homeBundle) return () => ac.abort()
      return () => ac.abort()
    }
    if (!showStatsKpis) {
      setData(null)
      setLoadError(false)
      setDashboardDataLoading(false)
      return () => ac.abort()
    }
    if (dashboardKpiCache) {
      setData(dashboardKpiCache)
      setLoadError(false)
      setDashboardDataLoading(false)
      return () => ac.abort()
    }
    const fetchKpis = async () => {
      const runId = `kpi-${Math.random().toString(36).slice(2, 9)}`
      const t0 = performance.now()
      dashLog('dashboardKPI:fetch:start', { runId })
      setDashboardDataLoading(true)
      setLoadError(false)
      let ok = false
      try {
        const { data: res } = await reportsService.dashboard({
          params: currentMonthRange(),
          signal: ac.signal
        })
        if (ac.signal.aborted) return
        const mapped = mapDashboardFinancial(res.data)
        dashboardKpiCache = mapped
        setData(mapped)
        ok = true
      } catch (err) {
        if (isAbortError(err)) {
          dashLog('dashboardKPI:fetch:aborted', { runId })
          return
        }
        showApiError(err, 'Failed to load dashboard')
        setLoadError(true)
        setData(null)
      } finally {
        if (!ac.signal.aborted) {
          setDashboardDataLoading(false)
          dashLog('dashboardKPI:fetch:done', {
            runId,
            ok,
            ms: Math.round(performance.now() - t0)
          })
        }
      }
    }
    void fetchKpis()
    return () => ac.abort()
  }, [user, layout, homeBundle, homeBundleFailed, showStatsKpis])

  useEffect(() => {
    if (USE_HOME_BUNDLE && !homeBundleFailed) {
      if (homeBundle) setNonCriticalReady(true)
      return
    }
    if (dashboardDataLoading || nonCriticalReady) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    const markReady = () => {
      if (!cancelled) setNonCriticalReady(true)
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(markReady, { timeout: 500 })
    } else {
      timeoutId = setTimeout(markReady, 120)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [USE_HOME_BUNDLE, homeBundle, homeBundleFailed, dashboardDataLoading, nonCriticalReady])

  const teamAttendanceEffectRunRef = useRef(0)
  useEffect(() => {
    if (USE_HOME_BUNDLE && !homeBundleFailed) return
    teamAttendanceEffectRunRef.current += 1
    dashLog('effect:teamAttendance', { runCount: teamAttendanceEffectRunRef.current })
    void loadTeamAttendanceWidgets()
  }, [loadTeamAttendanceWidgets, USE_HOME_BUNDLE, homeBundleFailed])

  const myAttendanceEffectRunRef = useRef(0)
  useEffect(() => {
    if (USE_HOME_BUNDLE && !homeBundleFailed) return
    myAttendanceEffectRunRef.current += 1
    dashLog('effect:myAttendance', { runCount: myAttendanceEffectRunRef.current })
    void loadMyAttendanceWidget()
  }, [loadMyAttendanceWidget, USE_HOME_BUNDLE, homeBundleFailed])

  /** Recent payments and balances in **separate** effects so a slow balances call does not block the payments table. */
  useEffect(() => {
    if (USE_HOME_BUNDLE && !homeBundleFailed) {
      return
    }
    if (!canViewSuppliers || !nonCriticalReady) {
      dashLog('supplierWidgets:payments:skip', { reason: !canViewSuppliers ? 'noPermission' : 'deferred' })
      return
    }
    const ac = new AbortController()
    const runId = `sup-pay-${Math.random().toString(36).slice(2, 9)}`
    const t0 = performance.now()
    dashLog('supplierWidgets:payments:fetch:start', { runId })
    setSupplierPaymentsLoading(true)
    ;(async () => {
      try {
        const r = await supplierService.recentPayments({ limit: 8, signal: ac.signal })
        if (ac.signal.aborted) return
        const rp = (r.data as any)?.data?.docs ?? (r.data as any)?.docs ?? []
        setRecentSupplierPayments(Array.isArray(rp) ? rp : [])
      } catch (e) {
        if (isAbortError(e)) {
          dashLog('supplierWidgets:payments:aborted', { runId })
          return
        }
        setRecentSupplierPayments([])
      } finally {
        if (!ac.signal.aborted) {
          setSupplierPaymentsLoading(false)
          dashLog('supplierWidgets:payments:done', { runId, ms: Math.round(performance.now() - t0) })
        }
      }
    })()
    return () => ac.abort()
  }, [canViewSuppliers, nonCriticalReady, USE_HOME_BUNDLE, homeBundleFailed])

  useEffect(() => {
    if (USE_HOME_BUNDLE && !homeBundleFailed) {
      return
    }
    if (!canViewSuppliers || !nonCriticalReady) {
      dashLog('supplierWidgets:payables:skip', { reason: !canViewSuppliers ? 'noPermission' : 'deferred' })
      return
    }
    const ac = new AbortController()
    const runId = `sup-bal-${Math.random().toString(36).slice(2, 9)}`
    const t0 = performance.now()
    dashLog('supplierWidgets:payables:fetch:start', { runId })
    setSupplierPayablesLoading(true)
    ;(async () => {
      try {
        const b = await supplierService.balancesSummary({ signal: ac.signal })
        if (ac.signal.aborted) return
        const rows = (b.data as any)?.data?.rows ?? (b.data as any)?.rows ?? []
        setTopSuppliersPayable(Array.isArray(rows) ? rows.slice(0, 8) : [])
      } catch (e) {
        if (isAbortError(e)) {
          dashLog('supplierWidgets:payables:aborted', { runId })
          return
        }
        setTopSuppliersPayable([])
      } finally {
        if (!ac.signal.aborted) {
          setSupplierPayablesLoading(false)
          dashLog('supplierWidgets:payables:done', { runId, ms: Math.round(performance.now() - t0) })
        }
      }
    })()
    return () => ac.abort()
  }, [canViewSuppliers, nonCriticalReady, USE_HOME_BUNDLE, homeBundleFailed])

  const formatPstHm = (iso: string | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      await attendanceService.checkIn()
      showSuccess('Checked in')
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      await attendanceService.checkOut()
      showSuccess('Checked out')
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not check out')
    } finally {
      setCheckingOut(false)
    }
  }

  const openMarkAbsentConfirm = (employeeId: string, name: string) => {
    setPendingAbsent({ employeeId, name })
    setMarkAbsentConfirmOpen(true)
  }

  const closeMarkAbsentConfirm = () => {
    if (adminAttendanceBusy) return
    setMarkAbsentConfirmOpen(false)
    setPendingAbsent(null)
  }

  const openStatusMenu = (e: MouseEvent<HTMLElement>, row: TodayEmployee) => {
    setStatusMenuAnchor(e.currentTarget)
    setStatusMenuEmployee({ employeeId: row.employeeId, name: row.name })
  }

  const closeStatusMenu = () => {
    setStatusMenuAnchor(null)
    setStatusMenuEmployee(null)
  }

  const applyAdminStatusFromMenu = async (status: 'PRESENT' | 'HALF_DAY' | 'LEAVE' | 'ABSENT') => {
    if (!statusMenuEmployee) return
    const { employeeId, name } = statusMenuEmployee
    if (status === 'ABSENT') {
      closeStatusMenu()
      openMarkAbsentConfirm(employeeId, name)
      return
    }
    setAdminAttendanceBusy(true)
    try {
      await attendanceService.adminSetTodayStatus({ employeeId, status })
      showSuccess('Attendance updated')
      closeStatusMenu()
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not update attendance')
    } finally {
      setAdminAttendanceBusy(false)
    }
  }

  const handleConfirmMarkAbsent = async () => {
    if (!pendingAbsent) return
    setAdminAttendanceBusy(true)
    try {
      await attendanceService.adminSetTodayStatus({ employeeId: pendingAbsent.employeeId, status: 'ABSENT' })
      showSuccess('Employee marked absent for today')
      setMarkAbsentConfirmOpen(false)
      setPendingAbsent(null)
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not update attendance')
    } finally {
      setAdminAttendanceBusy(false)
    }
  }

  const tableRows = useMemo(() => {
    if (!todayBoard?.employees?.length) return []
    let list = [...todayBoard.employees]
    if (filterStatus) list = list.filter(e => e.status === filterStatus)
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name)
      return dir * a.status.localeCompare(b.status)
    })
    return list
  }, [todayBoard, sortBy, sortDir, filterStatus])

  const donutOptions: ApexOptions = useMemo(() => {
    const d = todayBoard?.distribution
    const labels = ['Present', 'Absent', 'Half-Day', 'Leave']
    const series = d
      ? [d.Present ?? 0, d.Absent ?? 0, d['Half-Day'] ?? 0, d.Leave ?? 0]
      : [0, 0, 0, 0]
    const total = series.reduce((s, n) => s + n, 0)

    return {
      stroke: { width: 0 },
      labels,
      colors: donutColors,
      dataLabels: {
        enabled: true,
        formatter: (val: string) => `${Math.round(parseFloat(val))}%`
      },
      legend: {
        fontSize: '13px',
        position: 'bottom',
        labels: { colors: textSecondary },
        itemMargin: { horizontal: 8 }
      },
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              name: { fontSize: '0.95rem' },
              value: {
                fontSize: '1rem',
                color: textSecondary,
                formatter: (val: string) => `${val}`
              },
              total: {
                show: true,
                fontSize: '1rem',
                label: 'Total',
                formatter: () => `${total}`,
                color: 'var(--mui-palette-text-primary)'
              }
            }
          }
        }
      },
      chart: { toolbar: { show: false } },
      responsive: [
        {
          breakpoint: 576,
          options: { chart: { height: 260 }, legend: { position: 'bottom' } }
        }
      ]
    }
  }, [todayBoard?.distribution, textSecondary])

  const donutSeries = useMemo(() => {
    const d = todayBoard?.distribution
    if (!d) return [0, 0, 0, 0]
    return [d.Present ?? 0, d.Absent ?? 0, d['Half-Day'] ?? 0, d.Leave ?? 0]
  }, [todayBoard?.distribution])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const businessHealthSummary = useMemo(() => {
    if (!layout) return 'Loading…'
    if (!layout.canSeeCompanyFinancials) {
      return 'Open visits, orders, and attendance from the shortcuts below. Net sales (TP) for this month is above.'
    }
    if (!data) return 'Loading current business health indicators.'
    const net = Number(data.netProfit || 0)
    const outstanding = Number(data.totalOutstanding || 0)
    if (net >= 0 && outstanding <= Number(data.totalSales || 0) * 0.3) {
      return 'Profit is positive and outstanding exposure is within a stable range.'
    }
    if (net < 0)
      return 'Net sales are active, but net profit is negative and needs attention.'
    return 'Net sales are steady while cashflow pressure remains on outstanding balances.'
  }, [data, layout, bundleLoading, dashboardDataLoading])

  const welcomeHighlight = useMemo(() => {
    if (!showStatsKpis || !data || loadError) return undefined
    const tp = Number(data.totalGrossSalesTp ?? 0)
    return (
      <>
        <Typography variant='caption' color='text.secondary' display='block'>
          Net sales (TP) · this month
        </Typography>
        <Typography variant='h4' color='primary.main' className='mbe-1'>
          {formatPKR(tp)}
        </Typography>
      </>
    )
  }, [showStatsKpis, data, loadError])

  const quickActions = useMemo<QuickAction[]>(() => {
    if (!user || !layout) return []
    const has = (permission: string) => hasPermission(permission)
    const actionCatalog: QuickAction[] = [
      { key: 'orders', label: 'Orders', href: '/orders/list', icon: 'tabler-clipboard-list' },
      { key: 'visits', label: 'Visits', href: '/visits/today', icon: 'tabler-map-pin' },
      { key: 'attendance', label: 'Attendance', href: '/attendance', icon: 'tabler-calendar-check' },
      { key: 'targets', label: 'Targets', href: '/targets', icon: 'tabler-target' },
      { key: 'reports', label: 'Reports', href: '/reports', icon: 'tabler-chart-line' },
      { key: 'inventory', label: 'Inventory', href: '/inventory', icon: 'tabler-packages' },
      { key: 'suppliers', label: 'Suppliers', href: '/suppliers/list', icon: 'tabler-building-store' },
      { key: 'payments', label: 'Payments', href: '/payments/list', icon: 'tabler-cash' }
    ]
    const permissionMap: Record<string, string> = {
      orders: 'orders.view',
      /** Same scope as “Today’s plan” (plan items list) */
      visits: 'weeklyPlans.view',
      targets: 'targets.view',
      reports: 'reports.view',
      inventory: 'inventory.view',
      suppliers: 'suppliers.view',
      payments: 'payments.view'
    }
    const allowed = actionCatalog.filter(a => {
      if (a.key === 'attendance') return has('attendance.view') || has('attendance.mark')
      return has(permissionMap[a.key] || '')
    })
    return orderQuickActions(allowed, layout.preferExecutionActionOrder)
  }, [user, hasPermission, layout])

  return (
    <>
    <Grid container spacing={4}>
      <Grid
        size={{ xs: 12, md: 4 }}
        sx={{ alignSelf: { md: 'flex-start' }, order: { xs: quickFirst ? 2 : 0, md: 0 } }}
      >
        <Stack spacing={2.5} sx={{ width: '100%', minHeight: 0 }}>
          <DashboardWelcomeColumn
            greeting={greeting}
            name={user?.name || 'Team'}
            summary={
              showStatsKpis && (dashboardDataLoading || bundleLoading) && !data
                ? 'Loading this month’s sales…'
                : businessHealthSummary
            }
            highlight={welcomeHighlight}
          />
          {showMyAttendance ? (
            <MyAttendanceCard
              meTodayLoading={meTodayLoading}
              meToday={meToday}
              checkingIn={checkingIn}
              checkingOut={checkingOut}
              handleCheckIn={handleCheckIn}
              handleCheckOut={handleCheckOut}
              formatPstHm={formatPstHm}
            />
          ) : null}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: quickFirst ? 3 : 0, md: 0 } }}>
        <Stack spacing={2.5}>
          {layout?.canSeeCompanyFinancials && showStatsKpis ? (
            <DashboardSnapshotKpis
              dashboardDataLoading={Boolean((dashboardDataLoading || bundleLoading) && !data)}
              loadError={loadError}
              data={data}
              mobileCompact={USE_HOME_BUNDLE && isMobile}
            />
          ) : null}
          {!layout?.canSeeCompanyFinancials && layout?.showExecutionPanel && user?._id ? (
            bundleLoading ? (
              <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
                <CardContent>
                  <Skeleton width='50%' height={32} />
                  <Skeleton width='100%' height={120} sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            ) : (
              <RepExecutionSection
                repUserId={String(user._id)}
                canViewTargets={hasPermission('targets.view')}
                prefetch={repPrefetch}
              />
            )
          ) : null}
          {hasPermission('team.view') ? <TeamSummaryWidget /> : null}
          {!showStatsKpis && !(layout?.showExecutionPanel && user?._id) ? (
            <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
              <CardContent sx={{ py: 4 }}>
                <Typography variant='body1' color='text.secondary'>
                  Ask an administrator to grant <strong>dashboard (view)</strong> for your sales summary in the welcome
                  card, or <strong>weekly plans (view)</strong> for today’s visits.
                </Typography>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Grid>
      {layout?.canSeeCompanyFinancials && layout?.showExecutionPanel && user?._id ? (
        <Grid size={{ xs: 12 }} sx={{ order: { xs: quickFirst ? 4 : 0, md: 0 } }}>
          {bundleLoading ? (
            <Card variant='outlined' sx={{ borderRadius: 3 }}>
              <CardContent>
                <Skeleton width='40%' height={28} />
                <Skeleton width='100%' height={100} sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          ) : (
            <RepExecutionSection
              repUserId={String(user._id)}
              canViewTargets={hasPermission('targets.view')}
              prefetch={repPrefetch}
            />
          )}
        </Grid>
      ) : null}
      <DashboardQuickActions
        actions={quickActions}
        sx={{ order: { xs: quickFirst ? 1 : 0, md: 0 } }}
      />
      <DashboardChartsSection
        canViewReports={Boolean(layout?.canSeeCompanyFinancials)}
        canViewInventory={Boolean(layout?.canSeeCompanyFinancials && canViewInventory)}
        nonCriticalReady={nonCriticalReady}
        profitChartsMobileAccordion={USE_HOME_BUNDLE && isMobile}
        sectionOrderSx={{ order: { xs: quickFirst ? 5 : 0, md: 0 } }}
      />
      {isMobile ? (
        <Grid size={{ xs: 12 }} sx={{ order: { xs: quickFirst ? 6 : 0, md: 0 } }}>
          <Accordion defaultExpanded={false} disableGutters sx={{ borderRadius: 3, border: '1px solid var(--mui-palette-divider)' }}>
            <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                Attendance
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 1, sm: 2 }, py: 2, pt: 1 }}>
              <DashboardAttendanceSection
                showCompanyAttendance={showCompanyAttendance}
                showMyAttendance={showMyAttendance}
                meTodayLoading={meTodayLoading}
                meToday={meToday}
                checkingIn={checkingIn}
                checkingOut={checkingOut}
                handleCheckIn={handleCheckIn}
                handleCheckOut={handleCheckOut}
                teamAttendanceLoading={teamAttendanceLoading}
                todayBoard={todayBoard}
                isAdmin={isAdmin}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortDir={sortDir}
                setSortDir={setSortDir}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                tableRows={tableRows}
                adminAttendanceBusy={adminAttendanceBusy}
                openStatusMenu={openStatusMenu}
                donutOptions={donutOptions}
                donutSeries={donutSeries}
                formatPstHm={formatPstHm}
                splitMyAttendance={showMyAttendance}
                embedded
              />
            </AccordionDetails>
          </Accordion>
        </Grid>
      ) : (
        <Grid size={{ xs: 12 }} sx={{ order: { md: 0 } }}>
          <DashboardAttendanceSection
            showCompanyAttendance={showCompanyAttendance}
            showMyAttendance={showMyAttendance}
            meTodayLoading={meTodayLoading}
            meToday={meToday}
            checkingIn={checkingIn}
            checkingOut={checkingOut}
            handleCheckIn={handleCheckIn}
            handleCheckOut={handleCheckOut}
            teamAttendanceLoading={teamAttendanceLoading}
            todayBoard={todayBoard}
            isAdmin={isAdmin}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortDir={sortDir}
            setSortDir={setSortDir}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            tableRows={tableRows}
            adminAttendanceBusy={adminAttendanceBusy}
            openStatusMenu={openStatusMenu}
            donutOptions={donutOptions}
            donutSeries={donutSeries}
            formatPstHm={formatPstHm}
            splitMyAttendance={showMyAttendance}
          />
        </Grid>
      )}
      {layout?.canSeeCompanyFinancials ? (
        isMobile ? (
          <Grid size={{ xs: 12 }} sx={{ order: { xs: quickFirst ? 7 : 0, md: 0 } }}>
            <Accordion defaultExpanded={false} disableGutters sx={{ borderRadius: 3, border: '1px solid var(--mui-palette-divider)' }}>
              <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                  Suppliers & Payables
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 1, sm: 2 }, py: 2, pt: 1 }}>
                <DashboardSupplierSection
                  canViewSuppliers={canViewSuppliers}
                  supplierPaymentsLoading={supplierPaymentsLoading}
                  recentSupplierPayments={recentSupplierPayments}
                  supplierPayablesLoading={supplierPayablesLoading}
                  topSuppliersPayable={topSuppliersPayable}
                  nonCriticalReady={nonCriticalReady}
                  ordersByStatus={data?.ordersByStatus}
                  embedded
                />
              </AccordionDetails>
            </Accordion>
          </Grid>
        ) : (
          <DashboardSupplierSection
            canViewSuppliers={canViewSuppliers}
            supplierPaymentsLoading={supplierPaymentsLoading}
            recentSupplierPayments={recentSupplierPayments}
            supplierPayablesLoading={supplierPayablesLoading}
            topSuppliersPayable={topSuppliersPayable}
            nonCriticalReady={nonCriticalReady}
            ordersByStatus={data?.ordersByStatus}
          />
        )
      ) : null}
    </Grid>

    <Menu
      anchorEl={statusMenuAnchor}
      open={Boolean(statusMenuAnchor)}
      onClose={closeStatusMenu}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 200 } } }}
    >
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('PRESENT')}
      >
        Mark present
      </MenuItem>
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('HALF_DAY')}
      >
        Half-day
      </MenuItem>
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('LEAVE')}
      >
        Leave
      </MenuItem>
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('ABSENT')}
        sx={{ color: 'warning.main' }}
      >
        Mark absent…
      </MenuItem>
    </Menu>

    <ConfirmDialog
      open={markAbsentConfirmOpen}
      onClose={closeMarkAbsentConfirm}
      onConfirm={handleConfirmMarkAbsent}
      title='Mark employee absent?'
      description={
        pendingAbsent
          ? `Mark ${pendingAbsent.name} as absent for today? Their check-in will be removed if it was recorded by mistake.`
          : ''
      }
      confirmText='Yes, mark absent'
      cancelText='Cancel'
      confirmColor='warning'
      icon='tabler-user-x'
      loading={adminAttendanceBusy}
    />
    </>
  )
}

export default LegacyDashboardView
