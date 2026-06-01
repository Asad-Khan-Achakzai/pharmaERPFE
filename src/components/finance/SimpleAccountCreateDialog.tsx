'use client'
import { useState, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import CustomTextField from '@core/components/mui/TextField'
import { accountService } from '@/services/account.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import { SIMPLE_ACCOUNT_TYPES, type SimpleAccountTypeId } from '@/constants/simpleAccountTypes'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
  /** Pre-select type (e.g. from Money Accounts page) */
  initialType?: SimpleAccountTypeId
  canCreateMoneyAccountOnly?: boolean
}

export const SimpleAccountCreateDialog = ({
  open,
  onClose,
  onCreated,
  initialType,
  canCreateMoneyAccountOnly = false
}: Props) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accountType, setAccountType] = useState<SimpleAccountTypeId | ''>(initialType || '')
  const [name, setName] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const availableTypes = useMemo(
    () =>
      SIMPLE_ACCOUNT_TYPES.filter(t =>
        canCreateMoneyAccountOnly ? !t.requiresFullManage : true
      ),
    [canCreateMoneyAccountOnly]
  )

  const selected = availableTypes.find(t => t.id === accountType)

  const reset = () => {
    setStep(initialType ? 2 : 1)
    setAccountType(initialType || '')
    setName('')
    setOpeningBalance('')
    setAccountNumber('')
    setNotes('')
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const handleOpen = () => {
    reset()
    if (initialType) setStep(2)
  }

  const goNext = () => {
    if (step === 1 && accountType) setStep(2)
    else if (step === 2 && name.trim()) setStep(3)
  }

  const handleSubmit = async () => {
    if (!accountType || !name.trim()) return
    setSaving(true)
    try {
      await accountService.createSimple({
        accountType,
        name: name.trim(),
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        accountNumber: accountNumber.trim() || undefined,
        notes: notes.trim() || undefined
      })
      showSuccess('Account created')
      handleClose()
      onCreated?.()
    } catch (err) {
      showApiError(err, 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='sm'
      fullWidth
      TransitionProps={{ onEnter: handleOpen }}
    >
      <DialogTitle>
        {step === 1 && 'What do you want to create?'}
        {step === 2 && 'Name your account'}
        {step === 3 && 'Optional details'}
      </DialogTitle>
      <DialogContent>
        {step === 1 && (
          <Grid container spacing={2} className='pbs-2'>
            <Grid size={{ xs: 12 }}>
              <Typography variant='body2' color='text.secondary'>
                {ACCOUNTING_UX.simpleModeHint}
              </Typography>
            </Grid>
            {availableTypes.map(t => (
              <Grid size={{ xs: 12, sm: 6 }} key={t.id}>
                <Paper
                  variant='outlined'
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    borderColor: accountType === t.id ? 'primary.main' : 'divider',
                    borderWidth: accountType === t.id ? 2 : 1,
                    height: '100%'
                  }}
                  onClick={() => setAccountType(t.id)}
                >
                  <Typography variant='h5' className='mbe-1'>
                    {t.icon}
                  </Typography>
                  <Typography fontWeight={600}>{t.title}</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {t.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {step === 2 && selected && (
          <Stack spacing={3} className='pbs-2'>
            <Alert severity='info' icon={<span>{selected.icon}</span>}>
              {selected.description}
            </Alert>
            {selected.notice && <Alert severity='warning'>{selected.notice}</Alert>}
            <CustomTextField
              required
              autoFocus
              fullWidth
              label='Name'
              placeholder={
                selected.id === 'BANK'
                  ? 'e.g. Meezan Bank'
                  : selected.id === 'CASH'
                    ? 'e.g. Petty Cash'
                    : 'e.g. Logistics Expense'
              }
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </Stack>
        )}

        {step === 3 && (
          <Stack spacing={3} className='pbs-2'>
            <CustomTextField
              fullWidth
              type='number'
              label='Opening balance (PKR)'
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              helperText='Leave empty if starting at zero'
            />
            {selected?.showAccountNumber && (
              <CustomTextField
                fullWidth
                label='Bank account number (optional)'
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
              />
            )}
            <CustomTextField
              fullWidth
              multiline
              minRows={2}
              label='Notes (optional)'
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        {step > 1 && (
          <Button onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={saving}>
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            variant='contained'
            disabled={(step === 1 && !accountType) || (step === 2 && !name.trim())}
            onClick={goNext}
          >
            Next
          </Button>
        ) : (
          <Button variant='contained' disabled={saving || !name.trim()} onClick={() => void handleSubmit()}>
            {saving ? 'Creating…' : ACCOUNTING_UX.createAccount}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
