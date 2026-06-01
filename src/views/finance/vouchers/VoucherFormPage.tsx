'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { accountService } from '@/services/account.service'
import { voucherService } from '@/services/voucher.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import type { Account, VoucherType } from '@/types/accounting'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import FinancePageHeader from '@/components/finance/FinancePageHeader'

type LineDraft = { accountId: string; debit: string; credit: string; description: string }

const VoucherFormPage = () => {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [voucherType, setVoucherType] = useState<VoucherType>('JV')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' }
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void accountService.list().then(({ data: r }) => {
      setAccounts((r.data || []).filter((a) => !a.isGroup))
    })
  }, [])

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const addLine = () => setLines((prev) => [...prev, { accountId: '', debit: '', credit: '', description: '' }])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await voucherService.create({
        voucherType,
        date,
        narration,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description || undefined
        }))
      })
      showSuccess('Voucher posted')
      router.push('/finance/vouchers')
    } catch (err) {
      showApiError(err, 'Failed to post voucher')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title={ACCOUNTING_UX.manualTransactionAdvanced} />
      <div className='pli-6'>
        <FinancePageHeader title='' showAccountantBanner />
      </div>
      <Grid container spacing={3} className='pli-6 pbe-6'>
        <Grid size={{ xs: 12, md: 4 }}>
          <CustomTextField fullWidth select label='Voucher Type' value={voucherType} onChange={(e) => setVoucherType(e.target.value as VoucherType)}>
            {['JV', 'PV', 'RV', 'CV', 'SV', 'PURV'].map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </CustomTextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <CustomTextField fullWidth type='date' label='Date' value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <CustomTextField fullWidth label='Narration' value={narration} onChange={(e) => setNarration(e.target.value)} />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant='subtitle2' className='mbe-2'>
            Lines
          </Typography>
          {lines.map((line, idx) => (
            <Grid container spacing={2} key={idx} className='mbe-2' alignItems='center'>
              <Grid size={{ xs: 12, md: 4 }}>
                <CustomTextField fullWidth select label='Account' value={line.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })}>
                  <MenuItem value=''>Select</MenuItem>
                  {accounts.map((a) => (
                    <MenuItem key={a._id} value={a._id}>
                      {a.code} — {a.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <CustomTextField fullWidth label='Debit' type='number' value={line.debit} onChange={(e) => updateLine(idx, { debit: e.target.value, credit: '' })} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <CustomTextField fullWidth label='Credit' type='number' value={line.credit} onChange={(e) => updateLine(idx, { credit: e.target.value, debit: '' })} />
              </Grid>
              <Grid size={{ xs: 10, md: 3 }}>
                <CustomTextField fullWidth label='Description' value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 2, md: 1 }}>
                {lines.length > 2 && (
                  <IconButton color='error' onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                    <i className='tabler-trash' />
                  </IconButton>
                )}
              </Grid>
            </Grid>
          ))}
          <Button size='small' onClick={addLine}>
            Add line
          </Button>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography color={balanced ? 'success.main' : 'error.main'}>
            Total Debit: ₨ {totalDebit.toFixed(2)} | Total Credit: ₨ {totalCredit.toFixed(2)} {balanced ? '✓ Balanced' : '✗ Not balanced'}
          </Typography>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Button variant='contained' disabled={!balanced || saving} onClick={() => void handleSubmit()}>
            {saving ? 'Posting…' : 'Post Voucher'}
          </Button>
          <Button className='mis-2' onClick={() => router.push('/finance/vouchers')}>
            Cancel
          </Button>
        </Grid>
      </Grid>
    </Card>
  )
}

export default VoucherFormPage
