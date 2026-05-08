'use client'

import { useState, useEffect, use, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import api from '@/services/api'
import { ordersService } from '@/services/orders.service'
import { inventoryService } from '@/services/inventory.service'
import { lineTotalQuantity } from '@/utils/bonus'
import { FinancialLayerSection } from '@/components/financial/FinancialLayerSection'
import { FinInfoTip } from '@/components/financial/FinInfoTip'
import { FIN_LABELS, FIN_TOOLTIPS } from '@/constants/financialLabels'
import { OrderVisitLinkPanel } from '@/components/orders/OrderVisitLinkPanel'

const statusColors: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
  PENDING: 'warning', PARTIALLY_DELIVERED: 'info', DELIVERED: 'success', PARTIALLY_RETURNED: 'warning', RETURNED: 'error', CANCELLED: 'default'
}

const OrderDetailPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const router = useRouter()
  const params = use(paramsPromise)
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'))
  const [order, setOrder] = useState<any>(null)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [deliverItems, setDeliverItems] = useState<any[]>([])
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [loadError, setLoadError] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [returning, setReturning] = useState(false)
  const [invAvgByProduct, setInvAvgByProduct] = useState<Record<string, number>>({})
  const [invAvgLoaded, setInvAvgLoaded] = useState(false)
  const { hasPermission } = useAuth()
  const hasDeliverPerm = hasPermission('orders.deliver')
  const hasReturnPerm = hasPermission('orders.return')
  const hasEditPerm = hasPermission('orders.edit')
  /** Order-level gross profit / margin — same gate as company financials elsewhere */
  const canSeeOrderProfitLayer = hasPermission('admin.access')

  const fetchOrder = async () => {
    try {
      const { data: res } = await ordersService.getById(params.id)
      setOrder(res.data)
      setLoadError(false)
    } catch (err) {
      setLoadError(true)
      showApiError(err, 'Failed to load order')
    }
  }

  const openDeliveryInvoice = async (deliveryId: string) => {
    try {
      const res = await api.get(`/orders/${params.id}/deliveries/${deliveryId}/invoice`, {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (err: unknown) {
      showApiError(err, 'Could not open invoice PDF')
    }
  }

  useEffect(() => { fetchOrder() }, [params.id])

  useEffect(() => {
    const distRaw = order?.distributorId
    if (!distRaw) {
      setInvAvgByProduct({})
      setInvAvgLoaded(true)
      return
    }
    const distId = typeof distRaw === 'object' ? distRaw._id : distRaw
    if (!distId) {
      setInvAvgByProduct({})
      setInvAvgLoaded(true)
      return
    }
    let cancelled = false
    setInvAvgLoaded(false)
    inventoryService
      .getAll({ distributorId: distId, limit: 500 })
      .then(res => {
        const rows = res.data?.data ?? []
        const m: Record<string, number> = {}
        for (const r of rows) {
          const pid = String(r.productId?._id ?? r.productId ?? '')
          if (!pid) continue
          const av = Number(r.avgCostPerUnit)
          if (!Number.isNaN(av)) m[pid] = av
        }
        if (!cancelled) setInvAvgByProduct(m)
      })
      .catch(() => {
        if (!cancelled) setInvAvgByProduct({})
      })
      .finally(() => {
        if (!cancelled) setInvAvgLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [order?._id, order?.distributorId])

  const profitEstimate = useMemo(() => {
    if (!order?.items?.length) {
      return {
        netSalesCompany: 0,
        netSalesCustomer: 0,
        missing: true,
        profit: null as number | null,
        marginPct: null as number | null,
        weightedAvgCost: null as number | null,
        basisLabel: '',
        eligibleUnits: 0,
        totalAvgCogs: 0,
        loading: false
      }
    }
    const netSalesCompany = Number(order.finalCompanyRevenue) || 0
    const netSalesCustomer = Number(order.amountAfterPharmacyDiscount) || 0
    const sumDelivered = order.items.reduce((s: number, i: any) => s + (Number(i.deliveredQty) || 0), 0)
    const useDeliveredBasis = sumDelivered > 0
    const basisLabel = useDeliveredBasis ? 'delivered quantity' : 'paid quantity'

    if (!invAvgLoaded) {
      return {
        netSalesCompany,
        netSalesCustomer,
        missing: true,
        profit: null,
        marginPct: null,
        weightedAvgCost: null,
        basisLabel,
        eligibleUnits: 0,
        totalAvgCogs: 0,
        loading: true
      }
    }

    let totalAvgCogs = 0
    let eligibleUnits = 0
    let missing = false
    for (const item of order.items) {
      const pid = String(item.productId?._id ?? item.productId ?? '')
      const u = useDeliveredBasis ? Number(item.deliveredQty) || 0 : Number(item.quantity) || 0
      if (u <= 0) continue
      eligibleUnits += u
      if (!pid || !Object.prototype.hasOwnProperty.call(invAvgByProduct, pid)) {
        missing = true
        continue
      }
      const av = invAvgByProduct[pid]
      if (typeof av !== 'number' || Number.isNaN(av)) {
        missing = true
        continue
      }
      totalAvgCogs += u * av
    }

    if (eligibleUnits <= 0) missing = true

    const roundedCogs = Math.round(totalAvgCogs * 100) / 100
    const profit = missing ? null : Math.round((netSalesCompany - roundedCogs) * 100) / 100
    const marginPct =
      profit != null && netSalesCompany > 0 ? Math.round((profit / netSalesCompany) * 10000) / 100 : null
    const weightedAvgCost =
      eligibleUnits > 0 ? Math.round((roundedCogs / eligibleUnits) * 10000) / 10000 : null

    return {
      netSalesCompany,
      netSalesCustomer,
      missing,
      profit,
      marginPct,
      weightedAvgCost,
      basisLabel,
      eligibleUnits,
      totalAvgCogs: roundedCogs,
      loading: false
    }
  }, [order, invAvgByProduct, invAvgLoaded])

  const openDeliver = () => {
    const items = order.items
      .filter((i: any) => {
        const lineMax = lineTotalQuantity(i.quantity, i.bonusQuantity ?? 0)
        return i.deliveredQty < lineMax
      })
      .map((i: any) => {
        const lineMax = lineTotalQuantity(i.quantity, i.bonusQuantity ?? 0)
        const remaining = lineMax - i.deliveredQty
        return {
          productId: i.productId?._id || i.productId,
          productName: i.productName,
          maxQty: remaining,
          quantity: remaining
        }
      })
    setDeliverItems(items)
    setDeliverOpen(true)
  }

  const openReturn = () => {
    const items = order.items.filter((i: any) => i.deliveredQty > i.returnedQty).map((i: any) => ({ productId: i.productId?._id || i.productId, productName: i.productName, maxQty: i.deliveredQty - i.returnedQty, quantity: 0, reason: '' }))
    setReturnItems(items)
    setReturnOpen(true)
  }

  const handleDeliver = async () => {
    const validItems = deliverItems.filter(i => i.quantity > 0).map(i => ({ productId: i.productId, quantity: i.quantity }))
    if (validItems.length === 0) { showApiError(null, 'Select items to deliver'); return }
    setDelivering(true)
    try {
      await ordersService.deliver(params.id, { items: validItems })
      showSuccess('Delivery recorded'); setDeliverOpen(false); fetchOrder()
    } catch (err) { showApiError(err, 'Delivery failed') }
    finally { setDelivering(false) }
  }

  const handleReturn = async () => {
    const validItems = returnItems.filter(i => i.quantity > 0).map(i => ({ productId: i.productId, quantity: i.quantity, reason: i.reason }))
    if (validItems.length === 0) { showApiError(null, 'Select items to return'); return }
    setReturning(true)
    try {
      await ordersService.returnOrder(params.id, { items: validItems })
      showSuccess('Return recorded'); setReturnOpen(false); fetchOrder()
    } catch (err) { showApiError(err, 'Return failed') }
    finally { setReturning(false) }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className='flex flex-col gap-4'>
          <Button variant='text' startIcon={<i className='tabler-arrow-left' />} onClick={() => router.push('/orders/list')}>
            Back to orders
          </Button>
          <Typography color='error'>Failed to load order. It may not exist or you may not have access.</Typography>
        </CardContent>
      </Card>
    )
  }
  if (!order) return <Card><CardContent className='flex justify-center items-center min-bs-[200px]'><CircularProgress /></CardContent></Card>

  const canDeliver = hasDeliverPerm && ['PENDING', 'PARTIALLY_DELIVERED'].includes(order.status)
  const canReturn = hasReturnPerm && ['DELIVERED', 'PARTIALLY_DELIVERED', 'PARTIALLY_RETURNED'].includes(order.status)
  const canEditPending = hasEditPerm && order.status === 'PENDING'

  const pk = (n: number | null | undefined) =>
    n != null && !Number.isNaN(n)
      ? `₨ ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—'
  const hasOrderFinancialSnap =
    order.finalCompanyRevenue != null ||
    order.pharmacyDiscountAmount != null ||
    order.totalAmount != null
  const grossTotal = order.totalAmount ?? order.totalOrderedAmount

  const statRow = (label: ReactNode, value: ReactNode) => (
    <Stack direction='row' justifyContent='space-between' alignItems='flex-start' gap={1} sx={{ py: 0.5 }}>
      <Typography variant='body2' color='text.secondary' component='div' sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography variant='body2' fontWeight={600} sx={{ textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  )

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12, md: 8 }}>
        <OrderVisitLinkPanel order={order} />
        <Card>
          <CardHeader
            title={
              <div className='flex items-center gap-1'>
                <IconButton
                  aria-label='Back to orders list'
                  onClick={() => router.push('/orders/list')}
                  size='small'
                  className='-mis-1'
                >
                  <i className='tabler-arrow-left' />
                </IconButton>
                <Typography component='span' variant='h5'>
                  Order {order.orderNumber}
                </Typography>
              </div>
            }
            action={
              <div className='flex flex-wrap gap-2'>
                {canEditPending && (
                  <Button component={Link} href={`/orders/${params.id}/edit`} variant='outlined'>
                    Edit order
                  </Button>
                )}
                {canDeliver && <Button variant='contained' color='success' onClick={openDeliver}>Deliver</Button>}
                {canReturn && <Button variant='outlined' color='error' onClick={openReturn}>Return</Button>}
              </div>
            }
          />
          <CardContent>
            <div className='flex flex-wrap gap-4 mbe-4 items-center'>
              <Chip label={order.status} color={statusColors[order.status] || 'default'} />
              <Typography>
                Order date: {new Date(order.orderDate ?? order.createdAt).toLocaleDateString()}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Recorded: {new Date(order.createdAt).toLocaleString()}
              </Typography>
            </div>
            {hasOrderFinancialSnap ? (
              <Box className='mbe-4'>
                <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
                  Order financial snapshot (at order time)
                </Typography>
                <Stack spacing={2}>
                  <FinancialLayerSection layer='sales'>
                    {statRow(
                      <>
                        {FIN_LABELS.grossSalesTp} <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                      </>,
                      pk(grossTotal)
                    )}
                    {statRow(FIN_LABELS.pharmacyDiscount, pk(order.pharmacyDiscountAmount))}
                    {statRow(
                      <>
                        {FIN_LABELS.netSalesCustomer} <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                      </>,
                      pk(order.amountAfterPharmacyDiscount)
                    )}
                    {statRow(FIN_LABELS.distributorCommission, pk(order.distributorCommissionAmount))}
                    {statRow(
                      <>
                        {FIN_LABELS.netSalesCompany} <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                      </>,
                      <Typography component='span' fontWeight={600} color='primary.main'>
                        {pk(order.finalCompanyRevenue)}
                      </Typography>
                    )}
                    {order.totalBonusQuantity != null &&
                      order.totalBonusQuantity > 0 &&
                      statRow(
                        <>
                          Bonus units (order) <FinInfoTip title={FIN_TOOLTIPS.bonusCostVsRevenue} />
                        </>,
                        order.totalBonusQuantity
                      )}
                  </FinancialLayerSection>

                  <FinancialLayerSection layer='cost'>
                    {order.totalCastingCost != null ? (
                      statRow(
                        <>
                          {FIN_LABELS.estimatedCostStandard}{' '}
                          <FinInfoTip title={FIN_TOOLTIPS.standardVsAvg} />
                        </>,
                        pk(order.totalCastingCost)
                      )
                    ) : (
                      <Typography variant='body2' color='text.secondary'>
                        No estimated catalog (casting) total on this order.
                      </Typography>
                    )}
                    {statRow(
                      <>
                        {FIN_LABELS.inventoryCostAvg} ({profitEstimate.basisLabel || '—'})
                        <FinInfoTip title={FIN_TOOLTIPS.standardVsAvg} />
                      </>,
                      profitEstimate.loading
                        ? '…'
                        : profitEstimate.missing || profitEstimate.weightedAvgCost == null
                          ? 'Not available'
                          : `${pk(profitEstimate.weightedAvgCost)} / unit`
                    )}
                    {!profitEstimate.loading &&
                      !profitEstimate.missing &&
                      profitEstimate.eligibleUnits > 0 && (
                        <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                          {FIN_LABELS.inventoryCostAvgCogs}: {pk(profitEstimate.totalAvgCogs)}
                        </Typography>
                      )}
                  </FinancialLayerSection>

                  {canSeeOrderProfitLayer ? (
                    <FinancialLayerSection layer='profit'>
                      <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                        {FIN_LABELS.estimatedGrossProfitCompany}. {FIN_TOOLTIPS.estimatedGrossProfitCompany}
                      </Typography>
                      {profitEstimate.loading ? (
                        <Typography variant='body2' color='text.secondary'>
                          Loading inventory averages…
                        </Typography>
                      ) : profitEstimate.missing ? (
                        <Typography variant='body2' color='text.secondary'>
                          {FIN_LABELS.estimatedGrossProfitCompany}: Not available
                        </Typography>
                      ) : (
                        <>
                          {statRow(
                            <>
                              {FIN_LABELS.netSalesCompany}{' '}
                              <FinInfoTip title={FIN_TOOLTIPS.estimatedGrossProfitCompany} />
                            </>,
                            pk(profitEstimate.netSalesCompany)
                          )}
                          {statRow(
                            <>
                              {FIN_LABELS.netSalesCustomer}{' '}
                              <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                            </>,
                            pk(profitEstimate.netSalesCustomer)
                          )}
                          {statRow(
                            <>
                              {FIN_LABELS.estimatedGrossProfitCompany}
                              <FinInfoTip title={FIN_TOOLTIPS.estimatedGrossProfitCompany} />
                            </>,
                            <Typography
                              component='span'
                              fontWeight={700}
                              color={profitEstimate.profit != null && profitEstimate.profit < 0 ? 'error.main' : 'text.primary'}
                            >
                              {profitEstimate.profit != null ? pk(profitEstimate.profit) : '—'}
                            </Typography>
                          )}
                          {statRow(
                            `Margin % (${FIN_LABELS.netSalesCompany} basis)`,
                            profitEstimate.marginPct != null ? `${profitEstimate.marginPct}%` : '—'
                          )}
                        </>
                      )}
                    </FinancialLayerSection>
                  ) : null}
                </Stack>
              </Box>
            ) : (
              <Typography className='mbe-4'>
                {FIN_LABELS.grossSalesTp}: {pk(grossTotal)}
              </Typography>
            )}
            <Divider className='mbe-4' />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Pharmacy</Typography><Typography>{order.pharmacyId?.name}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Distributor</Typography><Typography>{order.distributorId?.name}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Doctor</Typography><Typography>{order.doctorId?.name || '-'}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Rep</Typography><Typography>{order.medicalRepId?.name}</Typography></Grid>
            </Grid>
            <Divider className='mbs-4 mbe-4' />
            <Typography variant='h6' className='mbe-2'>Items</Typography>
            {isMobile ? (
              <Stack spacing={2}>
                {order.items.map((item: any, i: number) => (
                  <Paper key={i} variant='outlined' sx={{ p: 2 }}>
                    <Typography fontWeight={600} className='mbe-2'>
                      {item.productName || item.productId?.name}
                    </Typography>
                    <Stack spacing={0.5}>
                      <Typography variant='body2'>
                        Paid / bonus / total: {item.quantity} / {item.bonusQuantity ?? 0} /{' '}
                        {lineTotalQuantity(item.quantity, item.bonusQuantity ?? 0)}
                      </Typography>
                      <Typography variant='body2'>
                        Delivered / returned: {item.deliveredQty} / {item.returnedQty}
                      </Typography>
                      <Typography variant='body2'>
                        TP: ₨ {item.tpAtTime?.toFixed(2)} · {FIN_LABELS.standardCostCatalog}: ₨{' '}
                        {item.castingAtTime?.toFixed(2)}
                      </Typography>
                      {hasOrderFinancialSnap && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant='body2'>
                            {FIN_LABELS.grossSalesTp}: {pk(item.grossAmount)}
                          </Typography>
                          <Typography variant='body2'>{FIN_LABELS.pharmacyDiscount}: {pk(item.pharmacyDiscountAmount)}</Typography>
                          <Typography variant='body2'>
                            {FIN_LABELS.netSalesCustomer}: {pk(item.netAfterPharmacy)}
                          </Typography>
                          <Typography variant='body2'>{FIN_LABELS.distributorCommission}: {pk(item.distributorCommissionAmount)}</Typography>
                          <Typography variant='body2' fontWeight={600}>
                            {FIN_LABELS.netSalesCompany}: {pk(item.finalCompanyAmount)}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
            <Box
              sx={{
                overflowX: 'auto',
                maxWidth: '100%',
                WebkitOverflowScrolling: 'touch',
                mx: { xs: -2, sm: 0 },
                px: { xs: 2, sm: 0 }
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: hasOrderFinancialSnap ? 1180 : 720,
                  borderCollapse: 'collapse',
                  tableLayout: 'auto'
                }}
              >
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Product</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Paid</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Bonus</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Delivered</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Returned</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>TP</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Std. cost (catalog)</th>
                  {hasOrderFinancialSnap && (
                    <>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>{FIN_LABELS.grossSalesTp}</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>{FIN_LABELS.pharmacyDiscount}</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>{FIN_LABELS.netSalesCustomer}</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Dist. comm.</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap', minWidth: 120 }}>{FIN_LABELS.netSalesCompany}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{item.productName || item.productId?.name}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.quantity}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.bonusQuantity ?? 0}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{lineTotalQuantity(item.quantity, item.bonusQuantity ?? 0)}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.deliveredQty}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.returnedQty}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>₨ {item.tpAtTime?.toFixed(2)}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>₨ {item.castingAtTime?.toFixed(2)}</td>
                    {hasOrderFinancialSnap && (
                      <>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.grossAmount)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.pharmacyDiscountAmount)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.netAfterPharmacy)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.distributorCommissionAmount)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap', minWidth: 112 }}>{pk(item.finalCompanyAmount)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        {order.deliveries?.length > 0 && (
          <Card className='mbe-4'>
            <CardHeader title='Delivery History' />
            <CardContent>
              {order.deliveries.map((d: any) => (
                <div key={d._id} className='mbe-3 pbe-3' style={{ borderBottom: '1px solid #eee' }}>
                  <Typography fontWeight={500}>{d.invoiceNumber}</Typography>
                  <Typography variant='body2'>
                    {FIN_LABELS.netSalesCustomer}: {pk(d.pharmacyNetPayable ?? d.totalAmount)} · {FIN_LABELS.netSalesCompany}:{' '}
                    {pk(d.companyShareTotal)}
                    {canSeeOrderProfitLayer
                      ? ` · ${FIN_LABELS.salesMarginCustomerBasis}: ${pk(d.totalProfit)}`
                      : null}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>{new Date(d.deliveredAt).toLocaleString()} by {d.deliveredBy?.name}</Typography>
                  {d.invoiceNumber && (
                    <Button size='small' onClick={() => openDeliveryInvoice(d._id)}>
                      Download PDF
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {order.returns?.length > 0 && (
          <Card>
            <CardHeader title='Return History' />
            <CardContent>
              {order.returns.map((r: any) => (
                <div key={r._id} className='mbe-3 pbe-3' style={{ borderBottom: '1px solid #eee' }}>
                  <Typography variant='body2'>
                    {FIN_LABELS.netSalesCustomer} (return credit): {pk(r.totalAmount)}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>{new Date(r.returnedAt).toLocaleString()} by {r.returnedBy?.name}</Typography>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </Grid>

      <Dialog open={deliverOpen} onClose={() => setDeliverOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Deliver Items</DialogTitle>
        <DialogContent>
          {deliverItems.map((item, i) => (
            <div key={i} className='flex gap-4 items-center mbe-3 pbs-2'>
              <Typography className='flex-1'>{item.productName}</Typography>
              <CustomTextField label={`Max: ${item.maxQty}`} type='number' value={item.quantity}
                onChange={e => setDeliverItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(+e.target.value, it.maxQty) } : it))}
                style={{ width: 120 }} />
            </div>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setDeliverOpen(false)}>Cancel</Button><Button variant='contained' color='success' onClick={handleDeliver} disabled={delivering}>{delivering ? 'Confirming...' : 'Confirm Delivery'}</Button></DialogActions>
      </Dialog>

      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Return Items</DialogTitle>
        <DialogContent>
          {returnItems.map((item, i) => (
            <div key={i} className='flex gap-4 items-center mbe-3 pbs-2'>
              <Typography className='flex-1'>{item.productName}</Typography>
              <CustomTextField label={`Max: ${item.maxQty}`} type='number' value={item.quantity}
                onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(+e.target.value, it.maxQty) } : it))}
                style={{ width: 120 }} />
            </div>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setReturnOpen(false)}>Cancel</Button><Button variant='contained' color='error' onClick={handleReturn} disabled={returning}>{returning ? 'Confirming...' : 'Confirm Return'}</Button></DialogActions>
      </Dialog>
    </Grid>
  )
}

export default OrderDetailPage
