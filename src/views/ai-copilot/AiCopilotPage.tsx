'use client'

import AiCopilotPanel from '@/components/ai-copilot/AiCopilotPanel'
import Box from '@mui/material/Box'

export default function AiCopilotPage() {
  return (
    <Box sx={{ mx: -2, mt: -2 }}>
      <AiCopilotPanel fullPage />
    </Box>
  )
}
