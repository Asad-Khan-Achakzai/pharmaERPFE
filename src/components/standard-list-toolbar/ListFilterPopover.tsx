'use client'

import type { ReactNode } from 'react'
import Popover from '@mui/material/Popover'

type Props = {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  children: ReactNode
}

/** Same paper / placement as Orders filter popover (wide enough for two-month picker). */
export function ListFilterPopover({ open, anchorEl, onClose, children }: Props) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          elevation: 8,
          sx: {
            mt: 1,
            width: { xs: 'min(calc(100vw - 24px), 640px)', sm: 640 },
            maxWidth: '100%',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'visible'
          }
        }
      }}
    >
      {children}
    </Popover>
  )
}
