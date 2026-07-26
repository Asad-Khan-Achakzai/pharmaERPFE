'use client'

import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { aiCopilotService } from '@/services/aiCopilot.service'

type Props = {
  open: boolean
  toolName: string
  parameters: Record<string, unknown>
  description?: string
  onClose: () => void
  onSuccess: (result: unknown) => void
}

/** Confirmation gate for AI write tools (e.g. create_order). */
export function AiWriteToolConfirmDialog({
  open,
  toolName,
  parameters,
  description,
  onClose,
  onSuccess
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await aiCopilotService.executeConfirmedTool({
        toolName,
        parameters,
        confirmed: true
      })
      onSuccess(res.data?.data ?? res.data)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>Confirm AI action</DialogTitle>
      <DialogContent>
        <Typography variant='body2' gutterBottom>
          {description || `The copilot wants to run "${toolName}". This will change data in PharmaERP.`}
        </Typography>
        <Typography variant='caption' component='pre' sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1, overflow: 'auto' }}>
          {JSON.stringify(parameters, null, 2)}
        </Typography>
        {error && (
          <Typography variant='caption' color='error' display='block' sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant='contained' onClick={handleConfirm} disabled={loading}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}
