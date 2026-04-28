import { lazy } from 'react'
import { WelcomeHeroWidget } from '../widgets/WelcomeHeroWidget'
import { KPIWidget } from '../widgets/KPIWidget'
import { QuickActionsWidget } from '../widgets/QuickActionsWidget'
import type { EngineWidgetDefinition } from './widgetTypes'
import { WIDGET_ID } from './widgetTypes'
import { MyAttendanceWidget } from './widgets/MyAttendanceWidget'
import { TodayPlanWidget } from './widgets/TodayPlanWidget'
import { TargetProgressWidget } from './widgets/TargetProgressWidget'
import { ExecutionHintWidget } from './widgets/ExecutionHintWidget'
import { OrdersStatusWidget } from './widgets/OrdersStatusWidget'
import { AttendanceTeamWidget } from './widgets/AttendanceTeamWidget'
import { SupplierWidget } from './widgets/SupplierWidget'

const ProfitChartsLazy = lazy(() =>
  import('./widgets/ProfitChartsWidget').then(m => ({ default: m.ProfitChartsWidget }))
)
const InventoryChartsLazy = lazy(() =>
  import('./widgets/InventoryChartsWidget').then(m => ({ default: m.InventoryChartsWidget }))
)

/** KPI hero = full-dashboard tier only (system DEFAULT_ADMIN / SUPER_ADMIN), not permission strings */
const gateKpiFullDashboard = (_has: (p: string) => boolean, ctx: { isFullDashboardUser: boolean }) =>
  ctx.isFullDashboardUser

const gateFullDashboardOnly = (_has: (p: string) => boolean, ctx: { isFullDashboardUser: boolean }) =>
  ctx.isFullDashboardUser

/**
 * Central Odoo-style registry: permissions + mode placements only — no layout JSX.
 */
export const WIDGET_REGISTRY: EngineWidgetDefinition[] = [
  {
    id: WIDGET_ID.WELCOME_HERO,
    component: WelcomeHeroWidget,
    permissions: [],
    allowedModes: ['EXECUTION', 'MONITORING', 'HYBRID'],
    priority: 1000,
    modeAxis: 'neutral',
    grid: { xs: 12, md: 4, lg: 3 },
    dataKeys: ['kpis', 'kpiLoading'],
    bandByMode: {
      EXECUTION: { band: 'HERO_SPLIT', zone: 'sidebar', order: 0 },
      MONITORING: { band: 'HERO_SPLIT', zone: 'sidebar', order: 0 },
      HYBRID: { band: 'HERO_SPLIT', zone: 'sidebar', order: 0 }
    }
  },
  {
    id: WIDGET_ID.MY_ATTENDANCE_CARD,
    component: MyAttendanceWidget,
    permissions: [],
    allowedModes: ['EXECUTION', 'MONITORING', 'HYBRID'],
    priority: 990,
    modeAxis: 'execution',
    grid: { xs: 12, md: 4, lg: 3 },
    dataKeys: ['attendance'],
    bandByMode: {
      EXECUTION: { band: 'HERO_SPLIT', zone: 'sidebar', order: 1 },
      MONITORING: { band: 'HERO_SPLIT', zone: 'sidebar', order: 1 },
      HYBRID: { band: 'HERO_SPLIT', zone: 'sidebar', order: 1 }
    }
  },
  {
    id: WIDGET_ID.KPI_WIDGET,
    component: KPIWidget,
    permissions: [],
    gate: gateKpiFullDashboard,
    allowedModes: ['MONITORING', 'HYBRID'],
    priority: 950,
    modeAxis: 'monitoring',
    grid: { xs: 12, md: 8, lg: 9 },
    dataKeys: ['kpis', 'kpiLoading'],
    bandByMode: {
      EXECUTION: null,
      MONITORING: { band: 'HERO_SPLIT', zone: 'main', order: 0 },
      HYBRID: { band: 'HERO_SPLIT', zone: 'main', order: 0 }
    }
  },
  {
    id: WIDGET_ID.EXECUTION_HINT,
    component: ExecutionHintWidget,
    permissions: [],
    /** Full-dashboard shell only — limited users rely on plan / target widgets, not this placeholder. */
    gate: (h, ctx) =>
      ctx.isFullDashboardUser &&
      !h('weeklyPlans.view') &&
      !h('targets.view') &&
      !h('orders.view'),
    allowedModes: ['EXECUTION'],
    priority: 920,
    modeAxis: 'execution',
    grid: { xs: 12, md: 8, lg: 9 },
    dataKeys: [],
    bandByMode: {
      EXECUTION: { band: 'HERO_SPLIT', zone: 'main', order: 0 },
      MONITORING: null,
      HYBRID: null
    }
  },
  {
    id: WIDGET_ID.TODAY_PLAN_WIDGET,
    component: TodayPlanWidget,
    permissions: ['weeklyPlans.view'],
    allowedModes: ['EXECUTION', 'HYBRID'],
    priority: 910,
    modeAxis: 'execution',
    grid: { xs: 12, md: 8, lg: 9 },
    dataKeys: ['planItems', 'kpiLoading'],
    bandByMode: {
      EXECUTION: { band: 'HERO_SPLIT', zone: 'main', order: 0 },
      MONITORING: null,
      HYBRID: { band: 'EXECUTION_FULL', zone: 'full', order: 0 }
    }
  },
  {
    id: WIDGET_ID.TARGET_PROGRESS_WIDGET,
    component: TargetProgressWidget,
    permissions: ['targets.view'],
    allowedModes: ['EXECUTION', 'HYBRID'],
    priority: 900,
    modeAxis: 'execution',
    grid: { xs: 12, md: 8, lg: 9 },
    dataKeys: ['targets', 'kpiLoading'],
    bandByMode: {
      EXECUTION: { band: 'HERO_SPLIT', zone: 'main', order: 1 },
      MONITORING: null,
      HYBRID: { band: 'EXECUTION_FULL', zone: 'full', order: 1 }
    }
  },
  {
    id: WIDGET_ID.ORDERS_WIDGET,
    component: OrdersStatusWidget,
    permissions: ['orders.view'],
    gate: gateFullDashboardOnly,
    allowedModes: ['EXECUTION', 'HYBRID'],
    priority: 880,
    modeAxis: 'execution',
    grid: { xs: 12, md: 8, lg: 9 },
    dataKeys: ['kpis', 'orders'],
    bandByMode: {
      EXECUTION: { band: 'HERO_SPLIT', zone: 'main', order: 2 },
      MONITORING: null,
      HYBRID: { band: 'EXECUTION_FULL', zone: 'full', order: 2 }
    }
  },
  {
    id: WIDGET_ID.QUICK_ACTIONS_WIDGET,
    component: QuickActionsWidget,
    permissions: [],
    allowedModes: ['EXECUTION', 'MONITORING', 'HYBRID'],
    priority: 500,
    modeAxis: 'neutral',
    grid: { xs: 12, md: 12, lg: 12 },
    dataKeys: ['kpis'],
    bandByMode: {
      EXECUTION: { band: 'QUICK', zone: 'full', order: 0 },
      MONITORING: { band: 'QUICK', zone: 'full', order: 0 },
      HYBRID: { band: 'QUICK', zone: 'full', order: 0 }
    }
  },
  {
    id: WIDGET_ID.PROFIT_CHART_WIDGET,
    component: ProfitChartsLazy,
    permissions: [],
    gate: (_h, ctx) => ctx.isFullDashboardUser,
    allowedModes: ['MONITORING', 'HYBRID'],
    priority: 400,
    modeAxis: 'monitoring',
    grid: { xs: 12, md: 12, lg: 12 },
    dataKeys: ['charts'],
    lazy: true,
    bandByMode: {
      EXECUTION: null,
      MONITORING: { band: 'PROFIT', zone: 'full', order: 0 },
      HYBRID: { band: 'PROFIT', zone: 'full', order: 0 }
    }
  },
  {
    id: WIDGET_ID.INVENTORY_WIDGET,
    component: InventoryChartsLazy,
    permissions: ['inventory.view'],
    gate: gateFullDashboardOnly,
    allowedModes: ['EXECUTION', 'MONITORING', 'HYBRID'],
    priority: 390,
    modeAxis: 'monitoring',
    grid: { xs: 12, md: 12, lg: 12 },
    dataKeys: ['charts'],
    lazy: true,
    bandByMode: {
      EXECUTION: { band: 'INVENTORY', zone: 'full', order: 0 },
      MONITORING: { band: 'INVENTORY', zone: 'full', order: 0 },
      HYBRID: { band: 'INVENTORY', zone: 'full', order: 0 }
    }
  },
  {
    id: WIDGET_ID.ATTENDANCE_TEAM_WIDGET,
    component: AttendanceTeamWidget,
    permissions: [],
    gate: (h, ctx) =>
      ctx.isFullDashboardUser && (h('attendance.view') || h('attendance.mark')),
    allowedModes: ['EXECUTION', 'MONITORING', 'HYBRID'],
    priority: 300,
    modeAxis: 'neutral',
    grid: { xs: 12, md: 12, lg: 12 },
    dataKeys: ['attendance'],
    bandByMode: {
      EXECUTION: { band: 'ATTENDANCE', zone: 'full', order: 0 },
      MONITORING: { band: 'ATTENDANCE', zone: 'full', order: 0 },
      HYBRID: { band: 'ATTENDANCE', zone: 'full', order: 0 }
    }
  },
  {
    id: WIDGET_ID.SUPPLIER_WIDGET,
    component: SupplierWidget,
    permissions: ['suppliers.view'],
    gate: gateFullDashboardOnly,
    allowedModes: ['EXECUTION', 'MONITORING', 'HYBRID'],
    priority: 200,
    modeAxis: 'monitoring',
    grid: { xs: 12, md: 12, lg: 12 },
    dataKeys: ['suppliers', 'kpis'],
    bandByMode: {
      EXECUTION: { band: 'SUPPLIERS', zone: 'full', order: 0 },
      MONITORING: { band: 'SUPPLIERS', zone: 'full', order: 0 },
      HYBRID: { band: 'SUPPLIERS', zone: 'full', order: 0 }
    }
  }
]
