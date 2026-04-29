'use client'

import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import DashboardSnapshotKpis from '@/views/dashboard/DashboardSnapshotKpis'
import { useDashboardV3Data } from '../core/dashboardDataOrchestrator'

const useBundle = process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true'
const v3 = process.env.NEXT_PUBLIC_ENABLE_DASHBOARD_V3 === 'true'

/** Full Statistics card — `admin.access` only (widget registry gate). */
export function KPIWidget() {
  const d = useDashboardV3Data()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (!d.canSeeCompanyFinancials || !d.canLoadDashboardKpis) return null

  return (
    <DashboardSnapshotKpis
      dashboardDataLoading={Boolean(
        d.canLoadDashboardKpis && (d.kpiLoading || d.bundleLoading) && !d.kpi
      )}
      loadError={d.kpiError}
      data={d.kpi}
      mobileCompact={v3 && useBundle && isMobile}
    />
  )
}
