'use client'

import { useState } from 'react'
import Fab from '@mui/material/Fab'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import { useAuth } from '@/contexts/AuthContext'
import AiCopilotPanel from './AiCopilotPanel'

export default function AiCopilotFab() {
  const { user, hasPermission } = useAuth()
  const [open, setOpen] = useState(false)

  const enabled =
    hasPermission('copilot.use') &&
    (user?.tenantCompanyFlags?.aiCopilotEnabled === true || user?.role === 'SUPER_ADMIN')

  if (!enabled) return null

  return (
    <>
      <Fab
        color='primary'
        aria-label='AI Copilot'
        onClick={() => setOpen(true)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300 }}
      >
        <i className='tabler-sparkles' />
      </Fab>
      <Drawer anchor='right' open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}>
        <Box sx={{ p: { xs: 0, sm: 2 }, pt: { xs: 0, sm: 2 } }}>
          <AiCopilotPanel onClose={() => setOpen(false)} />
        </Box>
      </Drawer>
    </>
  )
}
