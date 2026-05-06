import type { ComponentType, LazyExoticComponent, ReactNode } from 'react'
import type { User } from '@/contexts/AuthContext'
import type { DashboardMode } from '../core/dashboardTypes'

/** Stable widget IDs (Odoo-style registry keys). */
export const WIDGET_ID = {
  WELCOME_HERO: 'WELCOME_HERO',
  MY_ATTENDANCE_CARD: 'MY_ATTENDANCE_CARD',
  KPI_WIDGET: 'KPI_WIDGET',
  TODAY_PLAN_WIDGET: 'TODAY_PLAN_WIDGET',
  TARGET_PROGRESS_WIDGET: 'TARGET_PROGRESS_WIDGET',
  EXECUTION_HINT: 'EXECUTION_HINT',
  ORDERS_WIDGET: 'ORDERS_WIDGET',
  QUICK_ACTIONS_WIDGET: 'QUICK_ACTIONS_WIDGET',
  PROFIT_CHART_WIDGET: 'PROFIT_CHART_WIDGET',
  INVENTORY_WIDGET: 'INVENTORY_WIDGET',
  ATTENDANCE_TEAM_WIDGET: 'ATTENDANCE_TEAM_WIDGET',
  SUPPLIER_WIDGET: 'SUPPLIER_WIDGET',
  TEAM_SUMMARY_WIDGET: 'TEAM_SUMMARY_WIDGET'
} as const

export type WidgetId = (typeof WIDGET_ID)[keyof typeof WIDGET_ID]

export type LayoutBandId =
  | 'HERO_SPLIT'
  | 'EXECUTION_FULL'
  | 'QUICK'
  | 'PROFIT'
  | 'INVENTORY'
  | 'ATTENDANCE'
  | 'SUPPLIERS'

export type LayoutZone = 'sidebar' | 'main' | 'full'

/** Per-mode placement; `null` means widget is not mounted in that mode (after permission filter). */
export type BandPlacement = { band: LayoutBandId; zone: LayoutZone; order: number } | null

export type WidgetGrid = { xs: number; md: number; lg: number }

export type DashboardEngineFeatureFlags = {
  useUnifiedHome: boolean
  mobileChartsAccordion: boolean
  mobileActionsFirst: boolean
  mobileKpiCompact: boolean
}

/** Passed to registry `gate` for tier vs module decisions (dashboard experience layer). */
export type WidgetGateContext = {
  /** System Administrator tenant role or SUPER_ADMIN — not derived from permission strings */
  isFullDashboardUser: boolean
}

export type EngineWidgetDefinition = {
  id: WidgetId
  component: ComponentType<Record<string, unknown>> | LazyExoticComponent<ComponentType<Record<string, unknown>>>
  /**
   * All listed permissions must pass (AND). Use `gate` for OR / complex rules.
   * Empty array = no permission gate (still subject to `gate` if set).
   */
  permissions: string[]
  /** Optional extra gate module permissions (+ optional full-dashboard tier via `ctx`). */
  gate?: (has: (p: string) => boolean, ctx: WidgetGateContext) => boolean
  allowedModes: DashboardMode[]
  /** Higher = earlier within the same sort group. */
  priority: number
  /**
   * Sort bias: in EXECUTION mode, `execution` widgets sort before `monitoring`;
   * in MONITORING, the opposite. `neutral` uses priority only.
   */
  modeAxis: 'execution' | 'monitoring' | 'neutral'
  grid: WidgetGrid
  /** Data slices this widget reads from the orchestrator (documentation + optional future prefetch). */
  dataKeys: string[]
  lazy?: boolean
  bandByMode: Record<DashboardMode, BandPlacement>
  /** If present, widget is hidden when this returns false. */
  featureFlag?: (flags: DashboardEngineFeatureFlags) => boolean
}

export type WidgetInstance = {
  widgetId: WidgetId
  def: EngineWidgetDefinition
  /** Key for list reconciliation */
  key: string
  layout: { band: LayoutBandId; zone: LayoutZone; order: number; grid: WidgetGrid; lazy?: boolean }
}

export type ResolverInput = {
  user: User | null | undefined
  hasPermission: (p: string) => boolean
  /** Derived from resolvedRole (+ SUPER_ADMIN); never from admin.access/reports.view */
  isFullDashboardUser: boolean
  mode: DashboardMode
  featureFlags: DashboardEngineFeatureFlags
}

export type LayoutBand = {
  band: LayoutBandId
  variant: 'split' | 'full'
  /** Split row */
  sidebar: WidgetInstance[]
  main: WidgetInstance[]
  /** Full-bleed row(s) */
  full: WidgetInstance[]
  /** Mobile flex order (xs) for first item in this band, when actions-first. */
  mobileOrderBase?: number
}

export type WidgetLayoutRoot = {
  mode: DashboardMode
  featureFlags: DashboardEngineFeatureFlags
  bands: LayoutBand[]
}

/** Normalized contract over orchestrator slices (one source of truth). */
export type DashboardContextData = {
  kpis: unknown
  kpiLoading: boolean
  kpiError: boolean
  planItems: unknown[]
  monthTarget: unknown | null
  todayBoard: unknown | null
  meToday: unknown | null
  teamAttendanceLoading: boolean
  meTodayLoading: boolean
  recentSupplierPayments: unknown[]
  topSuppliersPayable: unknown[]
  supplierPaymentsLoading: boolean
  supplierPayablesLoading: boolean
  nonCriticalReady: boolean
  bundleLoading: boolean
  canSeeCompanyFinancials: boolean
  charts: { profitReady: boolean; inventoryReady: boolean }
}

export type DashboardEngineContextValue = {
  user: User
  hasPermission: (p: string) => boolean
  mode: DashboardMode
  data: DashboardContextData
  /** Optional widget-local cache (e.g. client-only UI state) — not a second API layer. */
  getWidgetState: (key: string) => unknown
  setWidgetState: (key: string, value: unknown) => void
}

export type WidgetRendererProps = {
  instance: WidgetInstance
}

export type EngineErrorBoundaryProps = { widgetId: string; children: ReactNode }
