'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import { useExpandedOnDesktop } from '@/hooks/useExpandedOnDesktop'

const ProfitCostDashboardCharts = dynamic(
  () => import('@/views/dashboard/ProfitCostDashboardCharts'),
  { ssr: false, loading: () => <Skeleton variant='rounded' height={360} sx={{ m: 2 }} /> }
)
const InventoryDashboardCharts = dynamic(
  () => import('@/views/dashboard/InventoryDashboardCharts'),
  { ssr: false, loading: () => <Skeleton variant='rounded' height={360} sx={{ m: 2 }} /> }
)

const DashboardChartsSection = memo(function DashboardChartsSection({
  canViewReports,
  canViewInventory,
  nonCriticalReady
}: {
  canViewReports: boolean
  canViewInventory: boolean
  nonCriticalReady: boolean
}) {
  const { expanded: inventoryOpen, onChange: onInventoryAccordion } = useExpandedOnDesktop()

  if (!nonCriticalReady) return null
  return (
    <>
      {canViewReports && (
        <Grid size={{ xs: 12 }}>
          <ProfitCostDashboardCharts deferFetch />
        </Grid>
      )}
      {canViewInventory && (
        <Grid size={{ xs: 12 }}>
          <Accordion
            disableGutters
            expanded={inventoryOpen}
            onChange={onInventoryAccordion}
            sx={{ boxShadow: 'none', border: '1px solid var(--mui-palette-divider)', borderRadius: 3 }}
          >
            <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                Inventory overview
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 1, sm: 2 }, py: 2, pt: 1 }}>
              <InventoryDashboardCharts deferFetch />
            </AccordionDetails>
          </Accordion>
        </Grid>
      )}
    </>
  )
})

export default DashboardChartsSection
