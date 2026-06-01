'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import CustomTextField from '@core/components/mui/TextField'
import { accountingReportService } from '@/services/accountingReport.service'
import { accountService } from '@/services/account.service'
import { showApiError } from '@/utils/apiErrors'
import type { Account, GeneralLedgerEntry, GeneralLedgerAccountBucket } from '@/types/accounting'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const fmt = (n: number) => `₨ ${(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const GeneralLedgerReportPage = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [buckets, setBuckets] = useState<GeneralLedgerAccountBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    void accountService.list().then(({ data: r }) => setAccounts((r.data || []).filter(a => !a.isGroup)))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      if (accountId) params.accountId = accountId
      const { data: r } = await accountingReportService.generalLedger(params)
      setBuckets(r.data.accounts || [])
    } catch (err) {
      showApiError(err, 'Failed to load general ledger')
    } finally {
      setLoading(false)
    }
  }, [from, to, accountId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const selectedBucket = useMemo(
    () => (accountId ? buckets.find(b => String(b.account._id) === accountId) : null),
    [accountId, buckets]
  )

  const entries: GeneralLedgerEntry[] = useMemo(
    () => buckets.flatMap(b => b.entries),
    [buckets]
  )

  return (
    <Card>
      <CardHeader title={ACCOUNTING_UX.accountHistory} subheader='Detailed history of money movement by account' />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        <Grid size={{ xs: 12, md: 4 }}>
          <CustomTextField fullWidth select label='Account' value={accountId} onChange={e => setAccountId(e.target.value)}>
            <MenuItem value=''>All accounts</MenuItem>
            {accounts.map(a => (
              <MenuItem key={a._id} value={a._id}>
                {a.code} — {a.name}
              </MenuItem>
            ))}
          </CustomTextField>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <CustomTextField fullWidth type='date' label='From' value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <CustomTextField fullWidth type='date' label='To' value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>

      {selectedBucket && !loading && (
        <Grid container spacing={2} className='pli-6 pbe-4'>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Opening balance
                {(from || to) && ' (start of period)'}
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {fmt(selectedBucket.openingBalance)}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Closing balance
                {(from || to) && ' (end of period)'}
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {fmt(selectedBucket.closingBalance)}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant='outlined' sx={{ p: 2, height: '100%' }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Account
              </Typography>
              <Typography fontWeight={600}>
                {selectedBucket.account.code} — {selectedBucket.account.name}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {selectedBucket.entries.length} transaction{selectedBucket.entries.length === 1 ? '' : 's'} in view
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <div className='overflow-x-auto pli-6 pbe-6'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Voucher</th>
              {!accountId && <th>Account</th>}
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={accountId ? 5 : 6} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : accountId && selectedBucket ? (
              <>
                <tr>
                  <td colSpan={accountId ? 4 : 5}>
                    <Typography component='span' variant='body2' color='text.secondary' fontWeight={600}>
                      Opening balance
                    </Typography>
                  </td>
                  <td>
                    <Typography component='span' fontWeight={600}>
                      {fmt(selectedBucket.openingBalance)}
                    </Typography>
                  </td>
                </tr>
                {selectedBucket.entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='text-center p-4'>
                      No transactions in this period
                    </td>
                  </tr>
                ) : (
                  selectedBucket.entries.map((e, i) => (
                    <tr key={`${e.voucherId}-${i}`}>
                      <td>{new Date(e.date).toLocaleDateString()}</td>
                      <td>
                        <Stack spacing={0}>
                          <Typography component='span' fontWeight={500}>
                            {e.voucherNumber}
                          </Typography>
                          <Typography component='span' variant='caption' display='block'>
                            {e.voucherType}
                          </Typography>
                        </Stack>
                      </td>
                      <td>{e.debit > 0 ? fmt(e.debit) : '—'}</td>
                      <td>{e.credit > 0 ? fmt(e.credit) : '—'}</td>
                      <td>
                        <Typography component='span' fontWeight={500}>
                          {fmt(e.runningBalance)}
                        </Typography>
                      </td>
                    </tr>
                  ))
                )}
                <tr>
                  <td colSpan={4}>
                    <Typography component='span' variant='body2' color='text.secondary' fontWeight={600}>
                      Closing balance
                    </Typography>
                  </td>
                  <td>
                    <Typography component='span' fontWeight={700}>
                      {fmt(selectedBucket.closingBalance)}
                    </Typography>
                  </td>
                </tr>
              </>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className='text-center p-6'>
                  No entries
                </td>
              </tr>
            ) : (
              entries.map((e, i) => (
                <tr key={`${e.voucherId}-${i}`}>
                  <td>{new Date(e.date).toLocaleDateString()}</td>
                  <td>
                    <Stack spacing={0}>
                      <Typography component='span' fontWeight={500}>
                        {e.voucherNumber}
                      </Typography>
                      <Typography component='span' variant='caption' display='block'>
                        {e.voucherType}
                      </Typography>
                    </Stack>
                  </td>
                  <td>
                    {e.accountCode} {e.accountName}
                  </td>
                  <td>{e.debit > 0 ? fmt(e.debit) : '—'}</td>
                  <td>{e.credit > 0 ? fmt(e.credit) : '—'}</td>
                  <td>
                    <Typography component='span' fontWeight={500}>
                      {fmt(e.runningBalance)}
                    </Typography>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default GeneralLedgerReportPage
