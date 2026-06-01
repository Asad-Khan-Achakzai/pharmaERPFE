'use client'
import { useState, useEffect, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import CustomTextField from '@core/components/mui/TextField'
import { accountingReportService } from '@/services/accountingReport.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const BalanceSheetPage = () => {
  const [data, setData] = useState<any>(null)
  const [to, setTo] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (to) params.to = to
      const { data: r } = await accountingReportService.balanceSheet(params)
      setData(r.data)
    } catch (err) {
      showApiError(err, 'Failed to load balance sheet')
    }
  }, [to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const renderSection = (title: string, rows: any[], total: number) => (
    <div className='mbe-6'>
      <Typography variant='subtitle1' fontWeight={600} className='mbe-2'>
        {title}
      </Typography>
      <table className={tableStyles.table}>
        <tbody>
          {(rows || []).map((r: any) => (
            <tr key={r.accountId}>
              <td>{r.code} {r.name}</td>
              <td>₨ {r.closingBalance.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Total {title}</strong>
            </td>
            <td>
              <strong>₨ {(total ?? 0).toFixed(2)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  return (
    <Card>
      <CardHeader
        title={ACCOUNTING_UX.businessPositionReport}
        subheader='What your business owns and owes'
        action={data?.balanced != null && <Chip label={data.balanced ? 'Balanced' : 'Check figures'} color={data.balanced ? 'success' : 'warning'} size='small' />}
      />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='As of' value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>
      {data && (
        <div className='pli-6 pbe-6'>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>{renderSection('Assets', data.assets, data.totalAssets)}</Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              {renderSection('Liabilities', data.liabilities, data.totalLiabilities)}
              {renderSection('Equity', data.equity, data.totalEquity)}
              <Typography fontWeight={600}>Total L + E: ₨ {(data.totalLiabilitiesAndEquity ?? 0).toFixed(2)}</Typography>
            </Grid>
          </Grid>
        </div>
      )}
    </Card>
  )
}

export default BalanceSheetPage
