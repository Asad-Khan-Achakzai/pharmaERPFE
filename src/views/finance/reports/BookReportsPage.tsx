'use client'
import { useState, useEffect, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import CustomTextField from '@core/components/mui/TextField'
import { accountingReportService } from '@/services/accountingReport.service'
import { showApiError } from '@/utils/apiErrors'
import type { GeneralLedgerEntry } from '@/types/accounting'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

type BookPageProps = { title: string; fetcher: (params?: Record<string, string>) => Promise<{ data: { data: { entries?: GeneralLedgerEntry[]; accounts?: { entries: GeneralLedgerEntry[] }[] } } }> }

const BookReportPage = ({ title, fetcher }: BookPageProps) => {
  const [entries, setEntries] = useState<GeneralLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await fetcher(params)
      const payload = r.data
      const flat =
        payload.entries ||
        (payload.accounts || []).flatMap((b: { entries: GeneralLedgerEntry[] }) => b.entries) ||
        []
      setEntries(flat)
    } catch (err) {
      showApiError(err, `Failed to load ${title}`)
    } finally {
      setLoading(false)
    }
  }, [fetcher, from, to, title])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <Card>
      <CardHeader title={title} />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='From' value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CustomTextField fullWidth type='date' label='To' value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>
      <div className='overflow-x-auto pli-6 pbe-6'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Voucher</th>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
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
                    <Typography fontWeight={500}>{e.voucherNumber}</Typography>
                  </td>
                  <td>{e.accountCode}</td>
                  <td>{e.debit > 0 ? `₨ ${e.debit.toFixed(2)}` : '—'}</td>
                  <td>{e.credit > 0 ? `₨ ${e.credit.toFixed(2)}` : '—'}</td>
                  <td>₨ {e.runningBalance?.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export const DayBookPage = () => <BookReportPage title={ACCOUNTING_UX.dailyActivity} fetcher={accountingReportService.dayBook} />
export const CashBookPage = () => <BookReportPage title={ACCOUNTING_UX.cashActivity} fetcher={accountingReportService.cashBook} />
export const BankBookPage = () => <BookReportPage title={ACCOUNTING_UX.bankActivity} fetcher={accountingReportService.bankBook} />

export default DayBookPage
