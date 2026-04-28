'use client'

import { useMemo } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import RepExecutionSection, { type RepExecutionPrefetch } from '@/views/dashboard/RepExecutionSection'
import { useDashboardV3Data } from '../../core/dashboardDataOrchestrator'

const USE_BUNDLE = process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true'

export function TargetProgressWidget() {
  const d = useDashboardV3Data()
  const { user, hasPermission } = d
  const prefetch = useMemo((): RepExecutionPrefetch | undefined => {
    if (!user?._id) return undefined
    return {
      planItems: (d.planItems || []) as RepExecutionPrefetch['planItems'],
      monthTarget: (d.monthTarget as RepExecutionPrefetch['monthTarget']) || null
    }
  }, [d.planItems, d.monthTarget, user?._id])

  if (!user?._id) return null
  if (!hasPermission('targets.view')) return null

  if (USE_BUNDLE && d.bundleLoading) {
    return (
      <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
        <CardContent>
          <Skeleton width='50%' height={32} />
          <Skeleton width='100%' height={100} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    )
  }

  return (
    <RepExecutionSection
      repUserId={String(user._id)}
      canViewTargets
      prefetch={prefetch}
      showPlan={false}
      showTargets
    />
  )
}
