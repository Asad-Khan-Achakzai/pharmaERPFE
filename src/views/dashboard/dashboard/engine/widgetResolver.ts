import type { User } from '@/contexts/AuthContext'
import type { DashboardMode } from '../core/dashboardTypes'
import { WIDGET_REGISTRY } from './widgetRegistry'
import type {
  DashboardEngineFeatureFlags,
  EngineWidgetDefinition,
  ResolverInput,
  WidgetId,
  WidgetInstance,
  WidgetGateContext
} from './widgetTypes'

/**
 * Dashboard mode from experience tier (`isFullDashboardUser`) + operational weeklyPlans — not permission proxies for executive UI.
 */
export function resolveDashboardMode(has: (p: string) => boolean, isFullDashboardUser: boolean): DashboardMode {
  const hasWeekly = has('weeklyPlans.view')
  if (isFullDashboardUser && hasWeekly) return 'HYBRID'
  if (isFullDashboardUser) return 'MONITORING'
  return 'EXECUTION'
}

function zoneRank(zone: string): number {
  if (zone === 'sidebar') return 0
  if (zone === 'main') return 1
  return 2
}

function defaultGate(has: (p: string) => boolean, perms: string[]): boolean {
  if (perms.length === 0) return true
  return perms.every(p => has(p))
}

/**
 * Returns ordered widget instances for the current user/mode. No layout yet — see `buildWidgetLayout`.
 */
export function resolveWidgets(input: ResolverInput): WidgetInstance[] {
  const { user, hasPermission: has, isFullDashboardUser, mode, featureFlags } = input
  if (!user) return []

  const gateCtx: WidgetGateContext = { isFullDashboardUser }

  const out: WidgetInstance[] = []
  const bandOrder: Record<string, number> = {
    HERO_SPLIT: 0,
    EXECUTION_FULL: 1,
    QUICK: 2,
    PROFIT: 3,
    INVENTORY: 4,
    ATTENDANCE: 5,
    SUPPLIERS: 6
  }

  for (const def of WIDGET_REGISTRY) {
    if (def.featureFlag && !def.featureFlag(featureFlags)) continue
    if (!def.allowedModes.includes(mode)) continue
    if (!defaultGate(has, def.permissions)) continue
    if (def.gate && !def.gate(has, gateCtx)) continue
    const placement = def.bandByMode[mode]
    if (placement == null) continue

    out.push({
      widgetId: def.id,
      def,
      key: def.id,
      layout: { ...placement, grid: def.grid, lazy: def.lazy }
    })
  }

  out.sort((a, b) => {
    const ba = bandOrder[a.layout.band] - bandOrder[b.layout.band]
    if (ba !== 0) return ba
    const za = zoneRank(a.layout.zone) - zoneRank(b.layout.zone)
    if (za !== 0) return za
    if (a.layout.order !== b.layout.order) return a.layout.order - b.layout.order
    const modeBoost = (d: EngineWidgetDefinition) => {
      if (mode === 'EXECUTION' && d.modeAxis === 'execution') return 1000
      if (mode === 'MONITORING' && d.modeAxis === 'monitoring') return 1000
      if (mode === 'HYBRID') return 0
      return 0
    }
    const diff = modeBoost(b.def) + b.def.priority - (modeBoost(a.def) + a.def.priority)
    if (diff !== 0) return diff
    return b.def.grid.lg * 100 - a.def.grid.lg * 100
  })

  return out
}

export type { User }
