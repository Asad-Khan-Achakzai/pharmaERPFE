'use client'

import type { ReactNode } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'

export type SubLedgerEntry = {
  _id: string
  date: string
  referenceType: string
  description?: string
  category?: string
  debit: number
  credit: number
  runningBalance: number
}

export type SubLedgerStatement = {
  openingBalance: number
  closingBalance: number
  entries: SubLedgerEntry[]
}

const fmt = (n: number) => `₨ ${(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type SubLedgerStatementPageProps = {
  title: string
  subheader: string
  balanceHint: string
  subjectLabel: string
  subjectName?: string | null
  subjectSecondary?: string | null
  emptyMessage: string
  loading: boolean
  ready: boolean
  statement: SubLedgerStatement | null
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  filters?: ReactNode
  runningBalanceLabel?: string
}

const SubLedgerStatementPage = ({
  title,
  subheader,
  balanceHint,
  subjectLabel,
  subjectName,
  subjectSecondary,
  emptyMessage,
  loading,
  ready,
  statement,
  from,
  to,
  onFromChange,
  onToChange,
  filters,
  runningBalanceLabel = 'Balance'
}: SubLedgerStatementPageProps) => {
  const entryLabel = (e: SubLedgerEntry) => e.description || e.category?.replace(/_/g, ' ') || e.referenceType.replace(/_/g, ' ')

  return (
    <Card>
      <CardHeader title={title} subheader={subheader} />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        {filters}
        <Grid size={{ xs: 6, md: filters ? 3 : 6 }}>
          <CustomTextField
            fullWidth
            type='date'
            label='From'
            value={from}
            onChange={e => onFromChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 6, md: filters ? 3 : 6 }}>
          <CustomTextField
            fullWidth
            type='date'
            label='To'
            value={to}
            onChange={e => onToChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      {ready && statement && !loading && (
        <Grid container spacing={2} className='pli-6 pbe-4'>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Opening balance{(from || to) && ' (start of period)'}
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {fmt(statement.openingBalance)}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                Closing balance{(from || to) && ' (end of period)'}
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {fmt(statement.closingBalance)}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant='outlined' sx={{ p: 2, height: '100%' }}>
              <Typography variant='caption' color='text.secondary' display='block'>
                {subjectLabel}
              </Typography>
              <Typography fontWeight={600}>{subjectName}</Typography>
              {subjectSecondary ? (
                <Typography variant='caption' color='text.secondary' display='block'>
                  {subjectSecondary}
                </Typography>
              ) : null}
              <Typography variant='caption' color='text.secondary'>
                {balanceHint}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <div className='overflow-x-auto pli-6 pbe-6'>
        {!ready ? (
          <Typography color='text.secondary' className='p-6 text-center'>
            {emptyMessage}
          </Typography>
        ) : (
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>{runningBalanceLabel}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className='text-center p-6'>
                    <CircularProgress size={32} />
                  </td>
                </tr>
              ) : !statement ? (
                <tr>
                  <td colSpan={6} className='text-center p-6'>
                    No data
                  </td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td colSpan={5}>
                      <Typography component='span' variant='body2' color='text.secondary' fontWeight={600}>
                        Opening balance
                      </Typography>
                    </td>
                    <td>
                      <Typography component='span' fontWeight={600}>
                        {fmt(statement.openingBalance)}
                      </Typography>
                    </td>
                  </tr>
                  {statement.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className='text-center p-4'>
                        No transactions in this period
                      </td>
                    </tr>
                  ) : (
                    statement.entries.map(e => (
                      <tr key={e._id}>
                        <td>{new Date(e.date).toLocaleDateString()}</td>
                        <td>
                          <Chip label={e.referenceType.replace(/_/g, ' ')} size='small' variant='tonal' />
                        </td>
                        <td>{entryLabel(e)}</td>
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
                    <td colSpan={5}>
                      <Typography component='span' variant='body2' color='text.secondary' fontWeight={600}>
                        Closing balance
                      </Typography>
                    </td>
                    <td>
                      <Typography component='span' fontWeight={700}>
                        {fmt(statement.closingBalance)}
                      </Typography>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}

export default SubLedgerStatementPage
