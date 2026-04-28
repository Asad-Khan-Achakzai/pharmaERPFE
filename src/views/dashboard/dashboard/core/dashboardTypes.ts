import type { ComponentType } from 'react'

/**
 * MONITORING/HYBRID shells require full dashboard tier (system DEFAULT_ADMIN / SUPER_ADMIN); see dashboardExperience.
 */
export type DashboardMode = 'EXECUTION' | 'MONITORING' | 'HYBRID'

/** Stable widget IDs for the composition registry. */
export const DASHBOARD_WIDGET_ID = {
  WELCOME_HERO: 'WELCOME_HERO',
  QUICK_ACTIONS: 'QUICK_ACTIONS',
  MY_ATTENDANCE_CARD: 'MY_ATTENDANCE_CARD',
  KPI: 'KPI',
  /** Plan + target stack (orchestrated prefetch). */
  EXECUTION_STACK: 'EXECUTION_STACK',
  ATTENDANCE_TEAM: 'ATTENDANCE_TEAM',
  CHARTS: 'CHARTS',
  SUPPLIERS: 'SUPPLIERS'
} as const

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_ID)[keyof typeof DASHBOARD_WIDGET_ID]

/**
 * A widget is mountable in the grid when `satisfies` returns true
 * and mode is in allowedModes (if set).
 * Permissions must never be read inside the widget; only here at resolve time.
 */
export type RegistryWidget = {
  id: DashboardWidgetId
  /** Lower runs first in vertical stack (within the same row group, layout may group). */
  priority: number
  /** If omitted, all modes. */
  allowedModes?: DashboardMode[]
  /**
   * Permission-first gate. Use only `has` — no role string checks
   * (SUPER_ADMIN is already expanded to all permissions in AuthContext).
   */
  satisfies: (has: (p: string) => boolean) => boolean
  /**
   * Widget component; receives only serializable / context-driven props
   * (no services imported for data — data comes from DashboardDataContext).
   */
  /** Zero-prop surface; all data via DashboardV3DataContext. */
  component: ComponentType
  /** If true, widget is expected to defer network (e.g. chart bundles). */
  lazyData?: boolean
}

export type ResolvedLayout = {
  mode: DashboardMode
  /** Ordered, permission-filtered widget definitions (registry entries). */
  widgets: RegistryWidget[]
}

export type DashboardFeatureFlags = {
  /** Unified GET /dashboard/home (server + NEXT_PUBLIC). */
  useUnifiedHome: boolean
  /** Mobile: profit charts collapsed in accordion. */
  mobileChartsAccordion: boolean
  /** Mobile: quick actions first in flex order. */
  mobileActionsFirst: boolean
  /** Mobile: KPI card row compact. */
  mobileKpiCompact: boolean
}
