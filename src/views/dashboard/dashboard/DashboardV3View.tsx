'use client'

/**
 * V3 shell: composition is 100% registry + resolver + layout engine. No mode-based JSX here.
 */
import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { isFullDashboardUser as computeFullDashboard } from './engine/dashboardExperience'
import { DashboardV3DataProvider, useDashboardV3Data } from './core/dashboardDataOrchestrator'
import { DashboardEngineContextProvider } from './engine/dashboardContext'
import { useDashboardEngineFlags } from './engine/useDashboardEngineFlags'
import { resolveWidgets } from './engine/widgetResolver'
import { buildWidgetLayout } from './engine/widgetLayoutEngine'
import { WidgetGrid } from './WidgetGrid'

function DashboardV3Content() {
  const { user, hasPermission } = useAuth()
  const d = useDashboardV3Data()
  const featureFlags = useDashboardEngineFlags()

  const flags = useMemo(
    () => ({
      useUnifiedHome: featureFlags.useUnifiedHome,
      mobileChartsAccordion: featureFlags.mobileChartsAccordion,
      mobileActionsFirst: featureFlags.mobileActionsFirst,
      mobileKpiCompact: featureFlags.mobileKpiCompact
    }),
    [featureFlags]
  )

  const layout = useMemo(() => {
    if (!user) {
      return buildWidgetLayout([], d.mode, flags)
    }
    const instances = resolveWidgets({
      user,
      hasPermission,
      isFullDashboardUser: d.isFullDashboardUser,
      mode: d.mode,
      featureFlags: flags
    })
    return buildWidgetLayout(instances, d.mode, flags)
  }, [user, hasPermission, d.isFullDashboardUser, d.mode, flags])

  return <WidgetGrid layout={layout} />
}

function DashboardV3Shell() {
  return (
    <DashboardEngineContextProvider>
      <DashboardV3Content />
    </DashboardEngineContextProvider>
  )
}

export default function DashboardV3View() {
  const { user, hasPermission } = useAuth()
  if (!user) return null
  const isFullDashboardUser = computeFullDashboard(user)
  return (
    <DashboardV3DataProvider user={user} hasPermission={hasPermission} isFullDashboardUser={isFullDashboardUser}>
      <DashboardV3Shell />
    </DashboardV3DataProvider>
  )
}
