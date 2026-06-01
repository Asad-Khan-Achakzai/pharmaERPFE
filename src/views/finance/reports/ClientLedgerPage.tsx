'use client'
import { useState, useEffect, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { ledgerService } from '@/services/ledger.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

type ClientType = 'PHARMACY' | 'DISTRIBUTOR'

type ClientLedgerEntry = {
  _id: string
  date: string
  type: string
  referenceType: string
  description?: string
  debit: number
  credit: number
  runningBalance: number
  enrich?: {
    primaryLabel?: string | null
    orderNumber?: string | null
    invoiceNumber?: string | null
    collectionRef?: string | null
  }
}

type ClientStatement = {
  clientType: ClientType
  clientId: string
  clientName: string
  openingBalance: number
  closingBalance: number
  entries: ClientLedgerEntry[]
}

const fmt = (n: number) => `₨ ${(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ClientLedgerPage = () => {
  const [clientType, setClientType] = useState<ClientType>('PHARMACY')
  const [selectedClient, setSelectedClient] = useState<any | null>(null)
  const [clientId, setClientId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [statement, setStatement] = useState<ClientStatement | null>(null)

  const handleClientTypeChange = (next: ClientType) => {
    setClientType(next)
    setSelectedClient(null)
    setClientId('')
    setStatement(null)
  }

  const fetchData = useCallback(async () => {
    if (!clientId) {
      setStatement(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, string> = { clientType, clientId }
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await ledgerService.clientStatement(params)
      setStatement(r.data as ClientStatement)
    } catch (err) {
      showApiError(err, 'Failed to load client ledger')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }, [clientType, clientId, from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const clientTypeLabel = clientType === 'PHARMACY' ? 'Pharmacy' : 'Distributor'
  const balanceHint =
    clientType === 'PHARMACY'
      ? 'Positive balance = amount owed to you by the pharmacy'
      : 'Positive balance = net clearing (distributor owes company); negative = company owes distributor'

  const entryLabel = (e: ClientLedgerEntry) =>
    e.enrich?.primaryLabel || e.description || e.referenceType.replace(/_/g, ' ')

  return (
    <Card>
      <CardHeader
        title={ACCOUNTING_UX.clientLedger}
        subheader='Receivable and clearing history for pharmacies and distributors'
      />
      <Grid container spacing={2} className='pli-6 pbe-4'>
        <Grid size={{ xs: 12, md: 3 }}>
          <CustomTextField
            fullWidth
            select
            label='Client type'
            value={clientType}
            onChange={e => handleClientTypeChange(e.target.value as ClientType)}
          >
            <MenuItem value='PHARMACY'>Pharmacy</MenuItem>
            <MenuItem value='DISTRIBUTOR'>Distributor</MenuItem>
          </CustomTextField>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <LookupAutocomplete
            key={clientType}
            value={selectedClient}
            onChange={v => {
              setSelectedClient(v)
              setClientId(v ? String(v._id) : '')
              if (!v) setStatement(null)
            }}
            fetchOptions={search =>
              clientType === 'PHARMACY'
                ? pharmaciesService.lookup({ limit: 25, ...(search ? { search } : {}) }).then(r => r.data.data || [])
                : distributorsService
                    .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                    .then(r => r.data.data || [])
            }
            label={clientTypeLabel}
            placeholder={`Search ${clientTypeLabel.toLowerCase()}…`}
            required
            fetchErrorMessage={`Failed to load ${clientTypeLabel.toLowerCase()}s`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <CustomTextField fullWidth type='date' label='From' value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <CustomTextField fullWidth type='date' label='To' value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
      </Grid>

      {clientId && statement && !loading && (
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
                {clientTypeLabel}
              </Typography>
              <Typography fontWeight={600}>{statement.clientName}</Typography>
              <Typography variant='caption' color='text.secondary'>
                {balanceHint}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <div className='overflow-x-auto pli-6 pbe-6'>
        {!clientId ? (
          <Typography color='text.secondary' className='p-6 text-center'>
            Select a {clientTypeLabel.toLowerCase()} to view their ledger
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

export default ClientLedgerPage
