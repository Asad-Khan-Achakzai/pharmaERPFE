'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError } from '@/utils/apiErrors'
import { collectionsService } from '@/services/collections.service'
import tableStyles from '@core/styles/table.module.css'

const formatPKR = (v: number | null | undefined) =>
  `PKR ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString()
  } catch {
    return '—'
  }
}

const statusColor = (s: string | null | undefined) => {
  if (s === 'PAID') return 'success'
  if (s === 'PARTIALLY_PAID') return 'warning'
  if (s === 'UNPAID') return 'error'
  return 'default'
}

type DetailPayload = {
  pharmacy: {
    _id: string
    name: string
    city?: string
    phone?: string
    address?: string
  }
  outstanding: number
  invoiceCount: number
  medicalRepCount: number
  invoices: Array<{
    deliveryId: string
    invoiceNumber?: string | null
    orderId: string
    orderNumber?: string | null
    medicalRepName?: string
    deliveredAt?: string | null
    dueDate?: string | null
    invoiceAmount: number
    outstanding: number
    paymentStatus?: string | null
  }>
  collectionHistory: Array<{
    _id: string
    amount: number
    paymentMethod: string
    collectorType: string
    date: string
    referenceNumber?: string | null
    notes?: string | null
    collectedBy?: { name?: string } | null
  }>
  methodologyNote?: string
}

const OutstandingPharmacyDetailPage = () => {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const pharmacyId = String(params?.id || '')
  const medicalRepId = searchParams.get('medicalRepId') || undefined
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payments.create')

  const [data, setData] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchSeq = useRef(0)

  const fetchData = useCallback(async () => {
    if (!pharmacyId) return
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const { data: res } = await collectionsService.outstandingPharmacy(pharmacyId, {
        medicalRepId,
        historyLimit: 30
      })
      if (seq !== fetchSeq.current) return
      setData(res.data)
    } catch (e) {
      if (seq !== fetchSeq.current) return
      showApiError(e, 'Failed to load pharmacy outstanding detail')
      setData(null)
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [pharmacyId, medicalRepId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <Stack alignItems='center' py={8}>
        <CircularProgress />
      </Stack>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <Typography color='text.secondary' mb={2}>
            Pharmacy outstanding detail is not available in your scope.
          </Typography>
          <Button onClick={() => router.push('/payments/outstanding')}>Back</Button>
        </CardContent>
      </Card>
    )
  }

  const { pharmacy } = data

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title={pharmacy.name}
          subheader={[pharmacy.city, pharmacy.phone].filter(Boolean).join(' · ') || 'Pharmacy'}
          action={
            <Stack direction='row' spacing={1}>
              <Button variant='outlined' onClick={() => router.push('/payments/outstanding')}>
                Back
              </Button>
              {canCreate ? (
                <Button
                  variant='contained'
                  onClick={() => router.push(`/payments/add?pharmacyId=${pharmacy._id}`)}
                >
                  Record Collection
                </Button>
              ) : null}
            </Stack>
          }
        />
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mb={2}>
            <BoxStat label='Scoped outstanding' value={formatPKR(data.outstanding)} />
            <BoxStat label='Open invoices' value={String(data.invoiceCount)} />
            <BoxStat label='Medical reps' value={String(data.medicalRepCount)} />
          </Stack>
          {data.methodologyNote ? (
            <Typography variant='caption' color='text.secondary'>
              {data.methodologyNote}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title='Outstanding invoices' />
        <CardContent>
          {data.invoices.length === 0 ? (
            <Typography color='text.secondary'>No open invoices.</Typography>
          ) : (
            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Order</th>
                    <th>Rep</th>
                    <th>Invoice date</th>
                    <th>Due date</th>
                    <th style={{ textAlign: 'right' }}>Invoice</th>
                    <th style={{ textAlign: 'right' }}>Open</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map(inv => (
                    <tr key={String(inv.deliveryId)}>
                      <td>{inv.invoiceNumber || '—'}</td>
                      <td>
                        <Button
                          size='small'
                          onClick={() => router.push(`/orders/${inv.orderId}`)}
                        >
                          {inv.orderNumber || 'Order'}
                        </Button>
                      </td>
                      <td>{inv.medicalRepName || '—'}</td>
                      <td>{formatDate(inv.deliveredAt)}</td>
                      <td>{formatDate(inv.dueDate)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(inv.invoiceAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(inv.outstanding)}</td>
                      <td>
                        <Chip
                          size='small'
                          color={statusColor(inv.paymentStatus) as any}
                          label={inv.paymentStatus || '—'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title='Collection history' />
        <CardContent>
          {data.collectionHistory.length === 0 ? (
            <Typography color='text.secondary'>No collections recorded yet.</Typography>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.5}>
              {data.collectionHistory.map(c => (
                <Stack
                  key={c._id}
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent='space-between'
                  spacing={1}
                >
                  <div>
                    <Typography fontWeight={600}>{formatPKR(c.amount)}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {formatDate(c.date)} · {c.paymentMethod} · {c.collectorType}
                      {c.collectedBy?.name ? ` · ${c.collectedBy.name}` : ''}
                    </Typography>
                    {c.referenceNumber || c.notes ? (
                      <Typography variant='caption' color='text.secondary'>
                        {[c.referenceNumber, c.notes].filter(Boolean).join(' — ')}
                      </Typography>
                    ) : null}
                  </div>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

function BoxStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack>
      <Typography variant='overline' color='text.secondary'>
        {label}
      </Typography>
      <Typography variant='h5'>{value}</Typography>
    </Stack>
  )
}

export default OutstandingPharmacyDetailPage
