'use client'

import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useMemo } from 'react'
import type { DashboardEngineFeatureFlags } from './widgetTypes'

const v3 = process.env.NEXT_PUBLIC_ENABLE_DASHBOARD_V3 === 'true'

export function useDashboardEngineFlags(): DashboardEngineFeatureFlags & { isMobile: boolean; useNewDashboardBundle: boolean } {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const useBundle = process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true'

  return useMemo(
    () => ({
      useUnifiedHome: process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true',
      mobileChartsAccordion: useBundle && isMobile,
      mobileActionsFirst: useBundle && isMobile,
      mobileKpiCompact: v3 && useBundle && isMobile,
      isMobile,
      useNewDashboardBundle: useBundle
    }),
    [isMobile, useBundle]
  )
}
