'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

/**
 * Permission empty state when user can see neither weekly plan nor reporting KPIs.
 * Shown only via registry (`EXECUTION_HINT`) + EXECUTION mode.
 */
export function ExecutionHintWidget() {
  return (
    <Card sx={{ boxShadow: 'var(--shadow-xs)' }}>
      <CardContent sx={{ py: 4 }}>
        <Typography variant='body1' color='text.secondary'>
          Ask an administrator to grant <strong>weekly plans (view)</strong> to see today’s visit list, or{' '}
          <strong>reports (view)</strong> for business-wide KPIs.
        </Typography>
      </CardContent>
    </Card>
  )
}
