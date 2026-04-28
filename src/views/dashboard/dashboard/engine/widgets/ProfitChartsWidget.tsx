'use client'

import { memo } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import dynamic from 'next/dynamic'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import { useDashboardEngineFlags } from '../useDashboardEngineFlags'
import { useDashboardV3Data } from '../../core/dashboardDataOrchestrator'

const ProfitCostDashboardCharts = dynamic(
  () => import('@/views/dashboard/ProfitCostDashboardCharts'),
  { ssr: false, loading: () => <Skeleton variant='rounded' height={360} sx={{ m: 2 }} /> }
)

type Props = { sectionOrderSx?: SxProps<Theme> }

export const ProfitChartsWidget = memo(function ProfitChartsWidget({ sectionOrderSx }: Props) {
  const d = useDashboardV3Data()
  const { mobileChartsAccordion: profitChartsMobileAccordion } = useDashboardEngineFlags()

  if (!d.nonCriticalReady) return null

  const profitBlock = <ProfitCostDashboardCharts deferFetch />

  return (
    <Grid size={{ xs: 12 }} sx={sectionOrderSx}>
      {!profitChartsMobileAccordion && (
        <Grid size={{ xs: 12 }} sx={{ order: { md: 0 } }}>
          {profitBlock}
        </Grid>
      )}
      {profitChartsMobileAccordion && (
        <Grid size={{ xs: 12 }} sx={{ order: { md: 0 } }}>
          <Accordion
            defaultExpanded={false}
            disableGutters
            sx={{ boxShadow: 'none', border: '1px solid var(--mui-palette-divider)', borderRadius: 3 }}
          >
            <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                Revenue &amp; profit charts
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 0, sm: 1 }, py: 1, pt: 0 }}>{profitBlock}</AccordionDetails>
          </Accordion>
        </Grid>
      )}
    </Grid>
  )
})
