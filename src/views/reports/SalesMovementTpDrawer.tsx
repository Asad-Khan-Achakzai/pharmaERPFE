'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TablePagination from '@mui/material/TablePagination'
import { reportsService } from '@/services/reports.service'
import { showApiError } from '@/utils/apiErrors'
import type { TpEventsBucket, TpEventsResponse } from '@/types/monthlySummary'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const BUCKET_LABELS: Record<string, string> = {
  grossDeliveries: 'Gross Deliveries (TP)',
  returnsCurrentPeriod: 'Returns – Current-Period Deliveries',
  returnsPriorPeriod: 'Returns – Prior-Period Deliveries',
  amendmentsCurrentPeriod: 'Amendments – Current-Period Deliveries',
  amendmentsPriorPeriod: 'Amendments – Prior-Period Deliveries',
  netTpSales: 'Net TP Sales'
}

type Props = {
  open: boolean
  onClose: () => void
  month: string
  monthLabel?: string
  bucket: TpEventsBucket
  fiscalYearStart: number
}

const SalesMovementTpDrawer = ({ open, onClose, month, monthLabel, bucket, fiscalYearStart }: Props) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TpEventsResponse | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [orderNumber, setOrderNumber] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [q, setQ] = useState('')
  const [eventDateFrom, setEventDateFrom] = useState('')
  const [eventDateTo, setEventDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!open || !month) return
    setLoading(true)
    try {
      const res = await reportsService.monthlySummaryTpEvents({
        month,
        fiscalYearStart: String(fiscalYearStart),
        bucket,
        orderNumber: orderNumber || undefined,
        invoiceNumber: invoiceNumber || undefined,
        q: q || undefined,
        eventDateFrom: eventDateFrom || undefined,
        eventDateTo: eventDateTo || undefined,
        page: page + 1,
        limit: rowsPerPage
      })
      setData(res.data.data)
    } catch (e) {
      showApiError(e, 'Failed to load TP events')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [
    open,
    month,
    fiscalYearStart,
    bucket,
    orderNumber,
    invoiceNumber,
    q,
    eventDateFrom,
    eventDateTo,
    page,
    rowsPerPage
  ])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (open) {
      setPage(0)
      setOrderNumber('')
      setInvoiceNumber('')
      setQ('')
      setEventDateFrom('')
      setEventDateTo('')
    }
  }, [open, month, bucket])

  const exportExcel = async () => {
    setExporting(true)
    try {
      const res = await reportsService.monthlySummaryTpEventsExcel({
        month,
        fiscalYearStart: String(fiscalYearStart),
        bucket,
        orderNumber: orderNumber || undefined,
        invoiceNumber: invoiceNumber || undefined,
        q: q || undefined,
        eventDateFrom: eventDateFrom || undefined,
        eventDateTo: eventDateTo || undefined,
        page: 1,
        limit: 200
      })
      const blob = res.data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tp-events-${month}-${bucket}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showApiError(e, 'Failed to export TP events')
    } finally {
      setExporting(false)
    }
  }

  const summary = data?.summary

  return (
    <Drawer
      anchor='right'
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 720, md: 800 }, maxWidth: '100%' } }}
    >
      <Box className='flex flex-col h-full'>
        <Box className='flex items-start justify-between gap-2 p-4 border-b'>
          <Box>
            <Typography variant='h6' fontWeight={700}>
              {BUCKET_LABELS[bucket] || bucket}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {monthLabel || month} · Sales Movement (TP)
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label='Close'>
            <i className='tabler-x' />
          </IconButton>
        </Box>

        <Box className='p-4 flex flex-col gap-4 overflow-auto flex-1'>
          <Grid container spacing={2}>
            {[
              { label: 'Total TP', value: formatPKR(summary?.totalTp || 0) },
              { label: 'Orders', value: String(summary?.orderCount || 0) },
              { label: 'Invoices', value: String(summary?.invoiceCount || 0) },
              { label: 'Packs', value: String(summary?.packCount || 0) },
              { label: 'Products', value: String(summary?.productCount || 0) }
            ].map(card => (
              <Grid key={card.label} size={{ xs: 6, sm: 4, md: 2 }}>
                <Card variant='outlined' sx={{ height: '100%' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant='caption' color='text.secondary'>
                      {card.label}
                    </Typography>
                    <Typography fontWeight={700} variant='body1'>
                      {card.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} alignItems='flex-end'>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                size='small'
                fullWidth
                label='Order number'
                value={orderNumber}
                onChange={e => {
                  setOrderNumber(e.target.value)
                  setPage(0)
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                size='small'
                fullWidth
                label='Invoice number'
                value={invoiceNumber}
                onChange={e => {
                  setInvoiceNumber(e.target.value)
                  setPage(0)
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                size='small'
                fullWidth
                label='Search'
                value={q}
                onChange={e => {
                  setQ(e.target.value)
                  setPage(0)
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
              <TextField
                size='small'
                fullWidth
                type='date'
                label='From'
                InputLabelProps={{ shrink: true }}
                value={eventDateFrom}
                onChange={e => {
                  setEventDateFrom(e.target.value)
                  setPage(0)
                }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 1.5 }}>
              <TextField
                size='small'
                fullWidth
                type='date'
                label='To'
                InputLabelProps={{ shrink: true }}
                value={eventDateTo}
                onChange={e => {
                  setEventDateTo(e.target.value)
                  setPage(0)
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className='flex gap-2'>
              <Button variant='outlined' size='small' onClick={() => void load()} disabled={loading}>
                Apply
              </Button>
              <Button variant='contained' size='small' onClick={() => void exportExcel()} disabled={exporting}>
                {exporting ? 'Exporting…' : 'Export'}
              </Button>
            </Grid>
          </Grid>

          {loading ? (
            <Box className='flex justify-center py-10'>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant='outlined' sx={{ maxHeight: 480 }}>
                <Table stickyHeader size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Order Number</TableCell>
                      <TableCell>Invoice Number</TableCell>
                      <TableCell>Delivery Date</TableCell>
                      <TableCell>Return / Amendment Date</TableCell>
                      <TableCell>Pharmacy</TableCell>
                      <TableCell>Medical Rep</TableCell>
                      <TableCell>Products</TableCell>
                      <TableCell align='right'>Quantity</TableCell>
                      <TableCell align='right'>TP Impact</TableCell>
                      <TableCell>Order Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!data?.rows?.length ? (
                      <TableRow>
                        <TableCell colSpan={10} align='center'>
                          <Typography color='text.secondary' className='py-6'>
                            No orders for this selection.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.rows.map(row => {
                        const deliveryDate =
                          row.eventType === 'DELIVERY'
                            ? row.eventAt
                            : row.sourceDeliveredAt
                        const returnAmendDate = row.eventType === 'DELIVERY' ? null : row.eventAt
                        return (
                          <TableRow key={`${row.eventType}-${row.eventId}-${row.classification}`} hover>
                            <TableCell>
                              <Link href={`/orders/${row.orderId}`} className='text-primary font-medium'>
                                {row.orderNumber || row.orderId}
                              </Link>
                            </TableCell>
                            <TableCell>{row.invoiceNumber || '—'}</TableCell>
                            <TableCell>
                              {deliveryDate
                                ? new Date(deliveryDate).toLocaleString('en-PK', { dateStyle: 'medium' })
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {returnAmendDate
                                ? new Date(returnAmendDate).toLocaleString('en-PK', {
                                    dateStyle: 'medium'
                                  })
                                : '—'}
                            </TableCell>
                            <TableCell>{row.pharmacyName || '—'}</TableCell>
                            <TableCell>{row.medicalRepName || '—'}</TableCell>
                            <TableCell>{row.productsLabel || '—'}</TableCell>
                            <TableCell align='right'>
                              {(row.packs || 0).toLocaleString('en-PK')}
                            </TableCell>
                            <TableCell align='right'>{formatPKR(row.tpAmount)}</TableCell>
                            <TableCell>
                              <Chip size='small' label={row.orderStatus || '—'} />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component='div'
                count={data?.totalCount || 0}
                page={page}
                onPageChange={(_e, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={e => {
                  setRowsPerPage(parseInt(e.target.value, 10))
                  setPage(0)
                }}
                rowsPerPageOptions={[25, 50, 100, 200]}
              />
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  )
}

export default SalesMovementTpDrawer
export { BUCKET_LABELS }
