'use client'
import { useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CustomTextField from '@core/components/mui/TextField'
import { MoneyAccountSelect } from '@/components/finance/MoneyAccountSelect'
import { voucherService } from '@/services/voucher.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'

const FundTransferPage = () => {
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await voucherService.fundTransfer({
        fromMoneyAccountId: fromAccountId,
        toMoneyAccountId: toAccountId,
        amount: parseFloat(amount),
        date,
        narration: notes || 'Money transfer'
      })
      showSuccess('Transfer completed successfully')
      setAmount('')
      setNotes('')
    } catch (err) {
      showApiError(err, 'Failed to complete transfer')
    } finally {
      setSaving(false)
    }
  }

  const valid = fromAccountId && toAccountId && fromAccountId !== toAccountId && parseFloat(amount) > 0

  return (
    <Card>
      <CardHeader title={ACCOUNTING_UX.transferMoney} subheader={ACCOUNTING_UX.transferHint} />
      <Grid container spacing={3} className='pli-6 pbe-6' maxWidth='md'>
        <Grid size={{ xs: 12 }}>
          <Alert severity='info'>{ACCOUNTING_UX.noDebitCreditNeeded}</Alert>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <MoneyAccountSelect
            required
            showBalance
            label='Move money from'
            value={fromAccountId}
            onChange={setFromAccountId}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <MoneyAccountSelect
            required
            label='Move money to'
            value={toAccountId}
            onChange={setToAccountId}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CustomTextField fullWidth type='number' label='Amount (PKR)' value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CustomTextField fullWidth type='date' label='Date' value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <CustomTextField fullWidth label='Notes (optional)' value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='e.g. Deposited to bank' />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Button variant='contained' disabled={!valid || saving} onClick={() => void handleSubmit()}>
            {saving ? 'Processing…' : 'Complete Transfer'}
          </Button>
        </Grid>
      </Grid>
    </Card>
  )
}

export default FundTransferPage
