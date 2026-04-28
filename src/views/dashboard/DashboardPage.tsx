'use client'

import LegacyDashboardView from './LegacyDashboardView'
import DashboardV3View from './dashboard/DashboardV3View'

/**
 * Feature flag: `NEXT_PUBLIC_ENABLE_DASHBOARD_V3=true` enables the permission-first composition engine.
 * When false, behavior matches the pre-V3 implementation (`LegacyDashboardView`) line-for-line.
 */
const ENABLE_DASHBOARD_V3 = process.env.NEXT_PUBLIC_ENABLE_DASHBOARD_V3 === 'true'

export default function DashboardPage() {
  if (ENABLE_DASHBOARD_V3) {
    return <DashboardV3View />
  }
  return <LegacyDashboardView />
}
