'use client'

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { useDashboardV3Data, type DashboardV3DataContextValue } from '../core/dashboardDataOrchestrator'
import type { DashboardContextData, DashboardEngineContextValue } from './widgetTypes'

export function buildDashboardContextData(d: DashboardV3DataContextValue): DashboardContextData {
  return {
    kpis: d.kpi,
    kpiLoading: d.kpiLoading,
    kpiError: d.kpiError,
    planItems: d.planItems,
    monthTarget: d.monthTarget,
    todayBoard: d.todayBoard,
    meToday: d.meToday,
    teamAttendanceLoading: d.teamAttendanceLoading,
    meTodayLoading: d.meTodayLoading,
    recentSupplierPayments: d.recentSupplierPayments,
    topSuppliersPayable: d.topSuppliersPayable,
    supplierPaymentsLoading: d.supplierPaymentsLoading,
    supplierPayablesLoading: d.supplierPayablesLoading,
    nonCriticalReady: d.nonCriticalReady,
    bundleLoading: d.bundleLoading,
    canSeeCompanyFinancials: d.canSeeCompanyFinancials,
    charts: { profitReady: d.nonCriticalReady, inventoryReady: d.nonCriticalReady }
  }
}

const DashboardEngineContext = createContext<DashboardEngineContextValue | null>(null)

/**
 * Sits under `DashboardV3DataProvider`: normalized data contract + optional widget-local cache.
 */
export function DashboardEngineContextProvider({ children }: { children: ReactNode }) {
  const d = useDashboardV3Data()
  const data = useMemo(() => buildDashboardContextData(d), [d])
  const [cache, setCache] = useState<Record<string, unknown>>({})

  const getWidgetState = useCallback(
    (key: string) => cache[key],
    [cache]
  )
  const setWidgetState = useCallback((key: string, value: unknown) => {
    setCache(c => ({ ...c, [key]: value }))
  }, [])

  const value = useMemo(
    () =>
      ({
        user: d.user,
        hasPermission: d.hasPermission,
        mode: d.mode,
        data,
        getWidgetState,
        setWidgetState
      }) satisfies DashboardEngineContextValue,
    [d.user, d.hasPermission, d.mode, data, getWidgetState, setWidgetState]
  )

  return <DashboardEngineContext.Provider value={value}>{children}</DashboardEngineContext.Provider>
}

export function useDashboardEngineContext(): DashboardEngineContextValue {
  const c = useContext(DashboardEngineContext)
  if (!c) throw new Error('useDashboardEngineContext must be used under DashboardEngineContextProvider')
  return c
}
