'use client'
import { useState, useEffect, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import CustomTextField from '@core/components/mui/TextField'
import { accountingReportService } from '@/services/accountingReport.service'
import { showApiError } from '@/utils/apiErrors'
import type { TrialBalanceRow } from '@/types/accounting'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const TrialBalancePage = () => {
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [totals, setTotals] = useState<{ periodDebit: number; periodCredit: number; balanced: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await accountingReportService.trialBalance(params)
      setRows(r.data.rows || [])
      setTotals(r.data.totals)
    } catch (err) {
      showApiError(err, 'Failed to load trial balance')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <Card>
      <CardHeader title={ACCOUNTING_UX.financialSummaryCheck} subheader='Verify that all accounts balance for the selected period' />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='From' value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='To' value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>
      {totals && (
        <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap className='pli-6 pbe-2'>
          <Typography color={totals.balanced ? 'success.main' : 'error.main'} component='span'>
            Period Debit: ₨ {totals.periodDebit.toFixed(2)} | Credit: ₨ {totals.periodCredit.toFixed(2)}
          </Typography>
          {totals.balanced ? (
            <Chip label='Balanced' size='small' color='success' />
          ) : (
            <Chip label='Unbalanced' size='small' color='error' />
          )}
        </Stack>
      )}
      <div className='overflow-x-auto pli-6 pbe-6'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Opening</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Closing</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.accountId}>
                  <td>{r.code}</td>
                  <td>{r.name}</td>
                  <td>₨ {r.openingBalance.toFixed(2)}</td>
                  <td>₨ {r.periodDebit.toFixed(2)}</td>
                  <td>₨ {r.periodCredit.toFixed(2)}</td>
                  <td>
                    <Typography fontWeight={500}>₨ {r.closingBalance.toFixed(2)}</Typography>
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

export default TrialBalancePage
