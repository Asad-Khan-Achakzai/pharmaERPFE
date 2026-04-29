'use client'

import type { ReactNode } from 'react'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { FIN_LAYERS } from '@/constants/financialLabels'

type LayerKind = 'sales' | 'cost' | 'profit'

const ACCENT: Record<LayerKind, { border: string; title: string }> = {
  sales: { border: 'primary.main', title: 'primary.main' },
  cost: { border: 'info.main', title: 'info.main' },
  profit: { border: 'success.main', title: 'success.main' }
}

type Props = {
  layer: LayerKind
  children: ReactNode
  /** Optional override for overline text */
  titleOverride?: string
}

export function FinancialLayerSection({ layer, children, titleOverride }: Props) {
  const a = ACCENT[layer]
  const title = titleOverride ?? FIN_LAYERS[layer]

  return (
    <Paper
      variant='outlined'
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 1,
        borderLeft: 4,
        borderLeftColor: a.border,
        borderTopColor: 'divider',
        borderRightColor: 'divider',
        borderBottomColor: 'divider'
      }}
    >
      <Typography variant='overline' sx={{ color: a.title, letterSpacing: 0.6, display: 'block', mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  )
}
