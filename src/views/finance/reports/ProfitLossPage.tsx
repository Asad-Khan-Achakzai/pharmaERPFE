'use client'
import { useState, useEffect, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CustomTextField from '@core/components/mui/TextField'
import { accountingReportService } from '@/services/accountingReport.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const ProfitLossPage = () => {
  const [data, setData] = useState<any>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await accountingReportService.profitLoss(params)
      setData(r.data)
    } catch (err) {
      showApiError(err, 'Failed to load P&L')
    }
  }, [from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <Card>
      <CardHeader title={ACCOUNTING_UX.profitReport} subheader='Income and expenses for the selected period' />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='From' value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='To' value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>
      {data && (
        <div className='pli-6 pbe-6'>
          <Typography variant='h6' className='mbe-4'>
            Net Profit: ₨ {(data.netProfit ?? 0).toFixed(2)}
          </Typography>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant='subtitle1' fontWeight={600} className='mbe-2'>
                Income
              </Typography>
              <table className={tableStyles.table}>
                <tbody>
                  {(data.income || []).map((r: any) => (
                    <tr key={r.accountId}>
                      <td>{r.code} {r.name}</td>
                      <td>₨ {Math.abs(r.closingBalance - r.openingBalance).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total Income</strong>
                    </td>
                    <td>
                      <strong>₨ {(data.totalIncome ?? 0).toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant='subtitle1' fontWeight={600} className='mbe-2'>
                Expenses
              </Typography>
              <table className={tableStyles.table}>
                <tbody>
                  {(data.expenses || []).map((r: any) => (
                    <tr key={r.accountId}>
                      <td>{r.code} {r.name}</td>
                      <td>₨ {Math.abs(r.closingBalance - r.openingBalance).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total Expenses</strong>
                    </td>
                    <td>
                      <strong>₨ {(data.totalExpense ?? 0).toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Grid>
          </Grid>
        </div>
      )}
    </Card>
  )
}

export default ProfitLossPage
