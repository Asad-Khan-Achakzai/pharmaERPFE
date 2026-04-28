'use client'

import { memo } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import DashboardSupplierSection from '@/views/dashboard/DashboardSupplierSection'
import { useDashboardEngineFlags } from '../useDashboardEngineFlags'
import { useDashboardV3Data } from '../../core/dashboardDataOrchestrator'

export const SupplierWidget = memo(function SupplierWidget() {
  const d = useDashboardV3Data()
  const { isMobile } = useDashboardEngineFlags()
  const kpi = d.kpi as { ordersByStatus?: Record<string, number> } | null
  const embedded = isMobile

  const inner = (
    <DashboardSupplierSection
      canViewSuppliers={d.hasPermission('suppliers.view')}
      supplierPaymentsLoading={d.supplierPaymentsLoading}
      recentSupplierPayments={d.recentSupplierPayments as any[]}
      supplierPayablesLoading={d.supplierPayablesLoading}
      topSuppliersPayable={d.topSuppliersPayable as any[]}
      nonCriticalReady={d.nonCriticalReady}
      ordersByStatus={kpi?.ordersByStatus}
      embedded={embedded}
    />
  )

  if (!isMobile) {
    return inner
  }

  return (
    <Accordion defaultExpanded={false} disableGutters sx={{ borderRadius: 3, border: '1px solid var(--mui-palette-divider)' }}>
      <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
        <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
          Suppliers &amp; Payables
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1, sm: 2 }, py: 2, pt: 1 }}>{inner}</AccordionDetails>
    </Accordion>
  )
})
