'use client'

import { Component, type ComponentType, type ErrorInfo, type ReactNode, Suspense } from 'react'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { WIDGET_ID } from './engine/widgetTypes'
import type { WidgetInstance, WidgetRendererProps } from './engine/widgetTypes'
import { useDashboardEngineFlags } from './engine/useDashboardEngineFlags'

const LazyFallback = () => <Skeleton variant='rounded' width='100%' height={200} />

function getInjectedProps(instance: WidgetInstance, ctx: { isMobile: boolean }): Record<string, unknown> {
  const id = instance.widgetId
  if (id === WIDGET_ID.QUICK_ACTIONS_WIDGET) {
    return {}
  }
  if (id === WIDGET_ID.ATTENDANCE_TEAM_WIDGET) {
    return {}
  }
  if (id === WIDGET_ID.SUPPLIER_WIDGET) {
    return { embedded: ctx.isMobile }
  }
  if (id === WIDGET_ID.PROFIT_CHART_WIDGET) {
    return {}
  }
  return {}
}

class WidgetErrorBoundaryClass extends Component<
  { widgetId: string; children: ReactNode },
  { hasError: boolean; message?: string }
> {
  state = { hasError: false, message: undefined as string | undefined }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message }
  }
  componentDidCatch(err: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error(`[dashboard widget ${this.props.widgetId}]`, err, errorInfo)
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <Alert severity='warning' variant='outlined' sx={{ borderRadius: 2 }}>
          Could not load this dashboard block{this.state.message ? ` (${this.state.message})` : ''}. Try again or
          contact support.
        </Alert>
      )
    }
    return this.props.children
  }
}

function WidgetErrorBoundary({ widgetId, children }: { widgetId: string; children: ReactNode }) {
  return <WidgetErrorBoundaryClass widgetId={widgetId}>{children}</WidgetErrorBoundaryClass>
}

/**
 * Renders a single registered widget with optional `React.lazy` + per-widget error boundary.
 */
export function WidgetRenderer({ instance }: WidgetRendererProps) {
  const { isMobile } = useDashboardEngineFlags()
  const C = instance.def.component as ComponentType<Record<string, unknown>>
  const injected = getInjectedProps(instance, { isMobile })
  const el = <C {...injected} />

  const inner = instance.def.lazy ? <Suspense fallback={<LazyFallback />}>{el}</Suspense> : el

  return (
    <WidgetErrorBoundary widgetId={instance.widgetId}>
      <div style={{ width: '100%' }} data-widget-id={instance.widgetId}>
        {inner}
      </div>
    </WidgetErrorBoundary>
  )
}
