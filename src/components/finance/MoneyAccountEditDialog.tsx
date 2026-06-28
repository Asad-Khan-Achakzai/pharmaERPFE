'use client'
import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import CustomTextField from '@core/components/mui/TextField'
import { accountService } from '@/services/account.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import type { Account } from '@/types/accounting'

type Props = {
  open: boolean
  account: Account | null
  onClose: () => void
  onSaved?: () => void
}

export const MoneyAccountEditDialog = ({ open, account, onClose, onSaved }: Props) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (account) {
      setName(account.name || '')
      setDescription(account.description || '')
    }
  }, [account])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleSubmit = async () => {
    if (!account || !name.trim()) return
    setSaving(true)
    try {
      await accountService.update(account._id, {
        name: name.trim(),
        description: description.trim() || null
      })
      showSuccess('Account updated')
      onClose()
      onSaved?.()
    } catch (err) {
      showApiError(err, 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>Edit account</DialogTitle>
      <DialogContent>
        <Stack spacing={3} className='pbs-2'>
          <CustomTextField
            required
            autoFocus
            fullWidth
            label='Name'
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <CustomTextField
            fullWidth
            multiline
            minRows={2}
            label='Notes (optional)'
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant='contained' disabled={saving || !name.trim()} onClick={() => void handleSubmit()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
