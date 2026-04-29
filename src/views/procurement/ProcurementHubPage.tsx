'use client'

import type { FC, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import TableContainer from '@mui/material/TableContainer'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import GlobalStyles from '@mui/material/GlobalStyles'
import Tooltip from '@mui/material/Tooltip'

import { showSuccess } from '@/utils/apiErrors'
import { procurementShowError } from './friendlyProcurementErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { normalizeDocs } from '@/utils/apiList'
import { procurementService } from '@/services/procurement.service'
import { supplierService } from '@/services/supplier.service'
import { productsService } from '@/services/products.service'
import { distributorsService } from '@/services/distributors.service'

import { apiPayload, formatDate, formatPKR } from './utils'

type PoRow = {
  _id: string
  orderNumber: string
  status: string
  expectedTotalAmount?: number
  supplierId?: { name?: string }
  createdAt?: string
}

type GrnRow = {
  _id: string
  receiptNumber: string
  status: string
  receivedAt?: string
  /** Populated from list/get; _id needed for “receive more” on same order */
  purchaseOrderId?: { _id?: string; orderNumber?: string; status?: string }
  supplierId?: { name?: string }
}

type InvRow = {
  _id: string
  invoiceNumber: string
  status: string
  totalAmount: number
  supplierId?: { name?: string }
  grnIds?: unknown[]
  createdAt?: string
}

/** Browser print / Save as PDF — supplier order or received goods slip */
type HubPrintDoc =
  | {
      kind: 'supplierOrder'
      orderNumber: string
      supplierName: string
      lines: { name: string; qty: number; unitPrice: number }[]
    }
  | {
      kind: 'goodsReceipt'
      receiptNumber: string
      supplierName: string
      supplierOrderNumber: string
      receivedDate: string
      lines: { name: string; qty: number; unitCost: number }[]
    }

const statusChipSx = (status: string) => {
  const s = status?.toUpperCase?.() || ''
  if (s === 'DRAFT') return { color: 'default' as const }
  if (s === 'APPROVED') return { color: 'info' as const }
  if (s === 'POSTED') return { color: 'success' as const }
  if (s === 'CLOSED') return { color: 'secondary' as const }
  if (s === 'CANCELLED') return { color: 'warning' as const }
  if (s === 'PARTIALLY_RECEIVED') return { color: 'warning' as const }
  return { color: 'primary' as const }
}

function poProgress(metrics: { ordered: number; received: number } | undefined) {
  if (!metrics || metrics.ordered <= 0) return 0
  return Math.min(100, Math.round((metrics.received / metrics.ordered) * 100))
}

/** Remaining qty still to receive on a PO line — posted only (draft GRNs do not change PO lines). */
function purchaseOrderLineRemaining(pl: { orderedQty?: number; receivedQty?: number }): number {
  const o = Number(pl.orderedQty) || 0
  const r = Number(pl.receivedQty) || 0
  return Math.max(0, o - r)
}

function poLinePostedQty(pl: { receivedQty?: number }): number {
  return Number(pl.receivedQty) || 0
}

/**
 * Qty you may still put on **this** receipt: ordered − posted − qty held on **other** draft GRNs
 * (so a second draft does not pre-fill the full order).
 */
function poLineOpenReceiveQty(
  pl: { _id?: unknown; orderedQty?: number; receivedQty?: number },
  otherDraftQtyByPolId: Record<string, number>
): number {
  const o = Number(pl.orderedQty) || 0
  const posted = poLinePostedQty(pl)
  const id = pl._id != null ? String(pl._id) : ''
  const inOtherDrafts = id ? Number(otherDraftQtyByPolId[id]) || 0 : 0
  return Math.max(0, o - posted - inOtherDrafts)
}

/** Truncate long labels in tables — full text on hover. */
function TruncWithTip({ text }: { text: string }) {
  if (!text.trim()) return <Typography variant='body2'>—</Typography>
  return (
    <Tooltip title={text}>
      <Typography variant='body2' noWrap sx={{ maxWidth: 220, display: 'block' }}>
        {text}
      </Typography>
    </Tooltip>
  )
}

const ProcurementBusyButton: FC<
  ButtonProps & {
    loading?: boolean
    loadingLabel: string
    children?: ReactNode
  }
> = ({ loading, loadingLabel, children, disabled, startIcon, ...rest }) => (
  <Button
    {...rest}
    disabled={Boolean(loading) || disabled}
    startIcon={loading ? <CircularProgress size={18} thickness={5} color='inherit' aria-hidden /> : startIcon}
  >
    {loading ? loadingLabel : children}
  </Button>
)

const ProcurementHubPage = () => {
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canView = hasPermission('procurement.view')
  const canCreate = hasPermission('procurement.create')
  const canApprovePo = hasPermission('procurement.approve')
  const canReceive = hasPermission('procurement.receive')
  const canPostInvoice = hasPermission('procurement.invoicePost')

  const [tab, setTab] = useState(0)
  const [hubLoading, setHubLoading] = useState(true)
  const [pos, setPos] = useState<PoRow[]>([])
  const [grns, setGrns] = useState<GrnRow[]>([])
  const [invoices, setInvoices] = useState<InvRow[]>([])
  const [poExtras, setPoExtras] = useState<
    Record<string, { ordered: number; received: number } | undefined>
  >({})

  const [supplierFilter, setSupplierFilter] = useState('')
  const [poStatusFilter, setPoStatusFilter] = useState('')
  const [grnStatusFilter, setGrnStatusFilter] = useState('')
  const [invStatusFilter, setInvStatusFilter] = useState('')

  const refreshHub = useCallback(async () => {
    if (!canView) return
    setHubLoading(true)
    try {
      const [poRes, grnRes, invRes] = await Promise.all([
        procurementService.listPurchaseOrders({ limit: 100 }),
        procurementService.listGoodsReceiptNotes({ limit: 100 }),
        procurementService.listSupplierInvoices({ limit: 100 })
      ])
      setPos(normalizeDocs<PoRow>(poRes))
      setGrns(normalizeDocs<GrnRow>(grnRes))
      setInvoices(normalizeDocs<InvRow>(invRes))
    } catch (e) {
      procurementShowError(e, 'Failed to load procurement data')
    } finally {
      setHubLoading(false)
    }
  }, [canView])

  useEffect(() => {
    void refreshHub()
  }, [refreshHub])

  useEffect(() => {
    if (!pos.length || hubLoading) {
      setPoExtras({})
      return
    }
    let cancelled = false
    ;(async () => {
      const next: Record<string, { ordered: number; received: number }> = {}
      await Promise.all(
        pos.slice(0, 100).map(async p => {
          try {
            const r = await procurementService.getPurchaseOrder(p._id)
            const d = apiPayload<{ lines?: { orderedQty?: number; receivedQty?: number }[] }>(r)
            const lines = d?.lines || []
            let ordered = 0
            let received = 0
            lines.forEach(l => {
              ordered += Number(l.orderedQty) || 0
              received += Number(l.receivedQty) || 0
            })
            next[p._id] = { ordered, received }
          } catch {
            /* leave undefined */
          }
        })
      )
      if (!cancelled) setPoExtras(next)
    })()
    return () => {
      cancelled = true
    }
  }, [pos, hubLoading])

  const suppliersForFilter = useMemo(() => {
    const m = new Map<string, string>()
    ;[...pos, ...grns, ...invoices].forEach(row => {
      const sid =
        typeof (row as any).supplierId === 'object'
          ? (row as any).supplierId?._id
          : (row as any).supplierId
      const name =
        typeof (row as any).supplierId === 'object'
          ? (row as any).supplierId?.name
          : null
      if (sid && name) m.set(String(sid), String(name))
    })
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }))
  }, [pos, grns, invoices])

  const filteredPos = useMemo(() => {
    return pos.filter(p => {
      if (supplierFilter) {
        const sid = typeof p.supplierId === 'object' ? (p.supplierId as any)?._id : p.supplierId
        if (String(sid) !== supplierFilter) return false
      }
      if (poStatusFilter && p.status !== poStatusFilter) return false
      return true
    })
  }, [pos, supplierFilter, poStatusFilter])

  const filteredGrns = useMemo(() => {
    return grns.filter(g => {
      if (supplierFilter) {
        const sid = typeof g.supplierId === 'object' ? (g.supplierId as any)?._id : g.supplierId
        if (String(sid) !== supplierFilter) return false
      }
      if (grnStatusFilter && g.status !== grnStatusFilter) return false
      return true
    })
  }, [grns, supplierFilter, grnStatusFilter])

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (supplierFilter) {
        const sid = typeof inv.supplierId === 'object' ? (inv.supplierId as any)?._id : inv.supplierId
        if (String(sid) !== supplierFilter) return false
      }
      if (invStatusFilter && inv.status !== invStatusFilter) return false
      return true
    })
  }, [invoices, supplierFilter, invStatusFilter])

  const [poOpen, setPoOpen] = useState(false)
  /** When set, save updates an existing draft PO instead of creating. */
  const [poEditingId, setPoEditingId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [poLines, setPoLines] = useState([
    { productId: '', orderedQty: 1 as number | '', unitPrice: 0 as number | '' }
  ])
  const [poSupplierId, setPoSupplierId] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poSaving, setPoSaving] = useState(false)

  const [grnOpen, setGrnOpen] = useState(false)
  const [distributors, setDistributors] = useState<any[]>([])
  const [poDetail, setPoDetail] = useState<any | null>(null)
  const [grnPurchaseOrderId, setGrnPurchaseOrderId] = useState('')
  const [grnLines, setGrnLines] = useState([
    {
      productId: '',
      purchaseOrderLineId: '' as string,
      qtyReceived: 1 as number | '',
      unitCost: 0 as number | '',
      distributorId: ''
    }
  ])
  const [grnSaving, setGrnSaving] = useState(false)
  /** Lump shipping for this receipt; folded into unit cost sent to API (same field as today). */
  const [grnShippingTotal, setGrnShippingTotal] = useState(0)
  /** When set, hydrating lines from PO is skipped — draft loaded from GRN. */
  const [grnEditingId, setGrnEditingId] = useState<string | null>(null)
  const [approvingPoId, setApprovingPoId] = useState<string | null>(null)
  const [postingInvoiceId, setPostingInvoiceId] = useState<string | null>(null)
  const [postingGrnInFlight, setPostingGrnInFlight] = useState(false)
  const [loadingEditPoId, setLoadingEditPoId] = useState<string | null>(null)
  const [loadingEditGrnId, setLoadingEditGrnId] = useState<string | null>(null)
  const [grnFormHighlight, setGrnFormHighlight] = useState<{ missingDistributor?: Record<number, boolean> } | null>(
    null
  )
  /** Quick print from supplier order list row (fetch then print dialog). */
  const [printingPoId, setPrintingPoId] = useState<string | null>(null)
  const [printingGrnId, setPrintingGrnId] = useState<string | null>(null)
  const [postConfirmGrnId, setPostConfirmGrnId] = useState<string | null>(null)
  /** Print-friendly snapshot (opens browser print / Save as PDF). */
  const [hubPrintDoc, setHubPrintDoc] = useState<HubPrintDoc | null>(null)
  /** Per PO line: qty on other draft GRNs for the same supplier order (excludes GRN being edited). */
  const [grnOtherDraftQtyByPolId, setGrnOtherDraftQtyByPolId] = useState<Record<string, number>>({})
  const [grnSiblingReceiptsLoading, setGrnSiblingReceiptsLoading] = useState(false)

  const [invOpen, setInvOpen] = useState(false)
  const [invSupplierId, setInvSupplierId] = useState('')
  const [invGrnOptions, setInvGrnOptions] = useState<GrnRow[]>([])
  const [invSelectedGrns, setInvSelectedGrns] = useState<Record<string, boolean>>({})
  const [invSub, setInvSub] = useState(0)
  const [invTax, setInvTax] = useState(0)
  const [invFreight, setInvFreight] = useState(0)
  const [invDisc, setInvDisc] = useState(0)
  const [invSaving, setInvSaving] = useState(false)
  const [expectedFromSelectedGrns, setExpectedFromSelectedGrns] = useState<number | null>(null)

  const [viewPo, setViewPo] = useState<PoRow | null>(null)
  const [viewPoDetail, setViewPoDetail] = useState<any | null>(null)
  const [viewGrn, setViewGrn] = useState<GrnRow | null>(null)
  const [viewGrnDetail, setViewGrnDetail] = useState<any | null>(null)
  const [viewInv, setViewInv] = useState<InvRow | null>(null)
  const [viewInvDetail, setViewInvDetail] = useState<any | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!poOpen && !grnOpen && !invOpen) return
      try {
        const [s, p] = await Promise.all([
          supplierService.lookup({ limit: '100', isActive: 'true' }),
          productsService.lookup({ limit: 300 })
        ])
        setSuppliers(normalizeDocs(s))
        setProducts(normalizeDocs(p))
      } catch (_) {
        /* noop */
      }
    })()
  }, [poOpen, grnOpen, invOpen])

  useEffect(() => {
    if (!grnOpen) return
    ;(async () => {
      try {
        const d = await distributorsService.lookup({ limit: 100 })
        setDistributors(normalizeDocs(d))
      } catch (_) {
        /* noop */
      }
    })()
  }, [grnOpen])

  const receivablePos = useMemo(
    () => pos.filter(p => ['APPROVED', 'PARTIALLY_RECEIVED'].includes(p.status)),
    [pos]
  )

  const isPoOrderFormValid = useMemo(
    () =>
      Boolean(poSupplierId.trim()) &&
      poLines.length > 0 &&
      poLines.every(l => String(l.productId).trim() && Number(l.orderedQty) > 0),
    [poSupplierId, poLines]
  )

  useEffect(() => {
    ;(async () => {
      if (!grnPurchaseOrderId) {
        setPoDetail(null)
        return
      }
      if (grnEditingId) return
      if (!grnOpen) return
      setPoDetail(null)
      try {
        const r = await procurementService.getPurchaseOrder(grnPurchaseOrderId)
        setPoDetail(apiPayload(r))
      } catch (e) {
        procurementShowError(e, 'Failed to load supplier order')
      }
    })()
  }, [grnOpen, grnPurchaseOrderId, grnEditingId])

  /** Load qty held on other draft receipts for this PO so we don't double-allocate before post. */
  useEffect(() => {
    if (!grnOpen || !grnPurchaseOrderId || !poDetail?.lines?.length) {
      setGrnOtherDraftQtyByPolId({})
      setGrnSiblingReceiptsLoading(false)
      return
    }
    if (String((poDetail as { _id?: string })._id) !== String(grnPurchaseOrderId)) {
      setGrnOtherDraftQtyByPolId({})
      setGrnSiblingReceiptsLoading(false)
      return
    }
    let cancelled = false
    setGrnSiblingReceiptsLoading(true)
    ;(async () => {
      try {
        const res = await procurementService.listGoodsReceiptNotes({
          purchaseOrderId: grnPurchaseOrderId,
          limit: 100
        })
        const docs = normalizeDocs<any>(apiPayload(res))
        const excludeId = grnEditingId ? String(grnEditingId) : ''
        const drafts = docs.filter((g: any) => g.status === 'DRAFT' && String(g._id) !== excludeId)
        const sums: Record<string, number> = {}
        await Promise.all(
          drafts.map(async (g: any) => {
            try {
              const r = await procurementService.getGoodsReceiptNote(g._id)
              const d = apiPayload<{ lines?: any[] }>(r)
              for (const ln of d?.lines || []) {
                const polRaw = ln.purchaseOrderLineId
                const polId =
                  polRaw && typeof polRaw === 'object' && polRaw != null && '_id' in polRaw
                    ? String((polRaw as { _id: string })._id)
                    : polRaw
                      ? String(polRaw)
                      : ''
                if (!polId) continue
                sums[polId] = (sums[polId] || 0) + (Number(ln.qtyReceived) || 0)
              }
            } catch {
              /* skip */
            }
          })
        )
        if (!cancelled) setGrnOtherDraftQtyByPolId(sums)
      } catch {
        if (!cancelled) setGrnOtherDraftQtyByPolId({})
      } finally {
        if (!cancelled) setGrnSiblingReceiptsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [grnOpen, grnPurchaseOrderId, poDetail, grnEditingId])

  /** Prefill receipt lines when a supplier order is selected — only lines with remaining quantity. */
  useEffect(() => {
    if (!grnOpen || grnEditingId) return
    if (!grnPurchaseOrderId || !poDetail?.lines?.length) {
      setGrnLines([])
      return
    }
    if (String((poDetail as { _id?: string })._id) !== String(grnPurchaseOrderId)) {
      setGrnLines([])
      return
    }

    const mapped = (poDetail.lines as { _id?: string; orderedQty?: number; receivedQty?: number; unitPrice?: number; productId?: { _id?: string } | string }[]).flatMap(pl => {
      const rem = poLineOpenReceiveQty(pl, grnOtherDraftQtyByPolId)
      if (rem <= 0) return []
      const pid = String((typeof pl.productId === 'object' && pl.productId?._id) || pl.productId || '')
      return [
        {
          productId: pid,
          purchaseOrderLineId: pl._id ? String(pl._id) : '',
          qtyReceived: rem,
          unitCost: Number(pl.unitPrice) || 0,
          distributorId: ''
        }
      ]
    })
    setGrnLines(mapped)
  }, [grnOpen, grnPurchaseOrderId, poDetail, grnEditingId, grnOtherDraftQtyByPolId])

  /** Edit draft: only keep lines that still have remaining qty on the PO (same as new receipt UX). */
  useEffect(() => {
    if (!grnOpen || !grnEditingId) return
    if (!poDetail?.lines?.length) return
    if (String((poDetail as { _id?: string })._id) !== String(grnPurchaseOrderId)) return
    setGrnLines(prev =>
      prev.filter(line => {
        if (!line.purchaseOrderLineId) return false
        const pl = (poDetail.lines as { _id?: string }[]).find(x => String(x._id) === String(line.purchaseOrderLineId))
        return pl != null && purchaseOrderLineRemaining(pl as { orderedQty?: number; receivedQty?: number }) > 0
      })
    )
  }, [grnOpen, grnEditingId, poDetail, grnPurchaseOrderId])

  useEffect(() => {
    ;(async () => {
      if (!invSupplierId) {
        setInvGrnOptions([])
        setInvSelectedGrns({})
        return
      }
      try {
        const r = await procurementService.listGoodsReceiptNotes({
          supplierId: invSupplierId,
          status: 'POSTED',
          limit: 200
        })
        setInvGrnOptions(normalizeDocs<GrnRow>(r))
      } catch (e) {
        procurementShowError(e, 'Failed to load received goods for supplier')
      }
    })()
  }, [invSupplierId])

  useEffect(() => {
    const ids = Object.keys(invSelectedGrns).filter(id => invSelectedGrns[id])
    if (!ids.length) {
      setExpectedFromSelectedGrns(null)
      return
    }
    let cancelled = false
    ;(async () => {
      let sum = 0
      await Promise.all(
        ids.map(async id => {
          try {
            const r = await procurementService.getGoodsReceiptNote(id)
            const d = apiPayload<{ lines?: { qtyReceived?: number; unitCost?: number }[] }>(r)
            ;(d?.lines || []).forEach(line => {
              sum += (Number(line.qtyReceived) || 0) * (Number(line.unitCost) || 0)
            })
          } catch {
            /* skip */
          }
        })
      )
      if (!cancelled) setExpectedFromSelectedGrns(Math.round(sum * 100) / 100)
    })()
    return () => {
      cancelled = true
    }
  }, [invSelectedGrns])

  const computedInvTotal = useMemo(
    () => Math.max(0, invSub + invTax + invFreight - invDisc),
    [invSub, invTax, invFreight, invDisc]
  )

  const grnReceiptQtyTotal = useMemo(
    () => grnLines.reduce((s, l) => s + (Number(l.qtyReceived) || 0), 0),
    [grnLines]
  )
  const grnShippingNum = Number(grnShippingTotal) || 0
  const grnPerUnitShipping = grnReceiptQtyTotal > 0 ? grnShippingNum / grnReceiptQtyTotal : 0
  /** Sum of qty × factory unit (supplier payable). Form `unitCost` field is factory before shipping. */
  const grnFactorySubtotal = useMemo(
    () =>
      Math.round(
        grnLines.reduce((s, l) => {
          const q = Number(l.qtyReceived) || 0
          if (q <= 0) return s
          return s + q * (Number(l.unitCost) || 0)
        }, 0) * 100
      ) / 100,
    [grnLines]
  )
  /** Landed inventory value for this receipt (factory + allocated shipping). */
  const grnLandedInventoryTotal = useMemo(() => {
    const per = grnReceiptQtyTotal > 0 ? grnShippingNum / grnReceiptQtyTotal : 0
    return (
      Math.round(
        grnLines.reduce((s, l) => {
          const q = Number(l.qtyReceived) || 0
          if (q <= 0) return s
          return s + q * ((Number(l.unitCost) || 0) + per)
        }, 0) * 100
      ) / 100
    )
  }, [grnLines, grnReceiptQtyTotal, grnShippingNum])

  const remainingByPolId = useMemo(() => {
    const m = new Map<string, number>()
    for (const pl of (poDetail?.lines as any[]) || []) {
      if (pl?._id != null) m.set(String(pl._id), poLineOpenReceiveQty(pl, grnOtherDraftQtyByPolId))
    }
    return m
  }, [poDetail, grnOtherDraftQtyByPolId])

  const grnPendingPoLines = useMemo(
    () =>
      ((poDetail?.lines as any[]) || []).filter(
        (pl: any) => poLineOpenReceiveQty(pl, grnOtherDraftQtyByPolId) > 0
      ),
    [poDetail, grnOtherDraftQtyByPolId]
  )

  const isGrnFullyPostedOnOrder = useMemo(() => {
    const lines = (poDetail?.lines as any[]) || []
    if (!lines.length) return false
    return lines.every((pl: any) => poLinePostedQty(pl) + 1e-9 >= (Number(pl.orderedQty) || 0))
  }, [poDetail])

  /** No line can accept more qty on a new receipt (posted + other drafts cover the order). */
  const isGrnNoReceiveCapacityLeft = useMemo(() => {
    const lines = (poDetail?.lines as any[]) || []
    if (!lines.length) return false
    return lines.every((pl: any) => poLineOpenReceiveQty(pl, grnOtherDraftQtyByPolId) <= 1e-9)
  }, [poDetail, grnOtherDraftQtyByPolId])

  const hasGrnQtyInOtherDrafts = useMemo(
    () => Object.values(grnOtherDraftQtyByPolId).some(q => (Number(q) || 0) > 0),
    [grnOtherDraftQtyByPolId]
  )

  const lineReceiveCap = useCallback(
    (line: { purchaseOrderLineId?: string }) => {
      if (!line.purchaseOrderLineId) return Number.MAX_SAFE_INTEGER
      const id = String(line.purchaseOrderLineId)
      if (!poDetail?.lines?.length) return Number.MAX_SAFE_INTEGER
      if (remainingByPolId.has(id)) return remainingByPolId.get(id)!
      return 0
    },
    [poDetail?.lines, remainingByPolId]
  )

  const fillReceiveAllRemaining = useCallback(() => {
    setGrnLines(prev => prev.map(l => ({ ...l, qtyReceived: lineReceiveCap(l) })))
  }, [lineReceiveCap])

  const isGrnSaveEnabled = useMemo(() => {
    if (!grnPurchaseOrderId || grnSaving) return false
    if (!grnEditingId && isGrnNoReceiveCapacityLeft) return false
    if (!grnLines.length) return false
    let anyQty = false
    for (const l of grnLines) {
      const q = Number(l.qtyReceived) || 0
      if (q <= 0) continue
      anyQty = true
      if (!String(l.distributorId).trim()) return false
      if (q > lineReceiveCap(l) + 1e-9) return false
    }
    return anyQty
  }, [
    grnPurchaseOrderId,
    grnSaving,
    grnEditingId,
    isGrnNoReceiveCapacityLeft,
    grnLines,
    lineReceiveCap
  ])

  useEffect(() => {
    if (!hubPrintDoc) return
    const onAfterPrint = () => setHubPrintDoc(null)
    window.addEventListener('afterprint', onAfterPrint)
    requestAnimationFrame(() => window.print())
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [hubPrintDoc])

  const openPoDialog = () => {
    setPoEditingId(null)
    setPoSupplierId('')
    setPoNotes('')
    setPoLines([{ productId: '', orderedQty: 1, unitPrice: 0 }])
    setPoOpen(true)
  }

  const openEditPurchaseOrder = async (p: PoRow) => {
    if (!canCreate || p.status !== 'DRAFT') return
    setLoadingEditPoId(p._id)
    setPoEditingId(p._id)
    setPoOpen(true)
    try {
      const r = await procurementService.getPurchaseOrder(p._id)
      const d = apiPayload<{
        supplierId?: string | { _id?: string }
        notes?: string
        lines?: { productId?: { _id?: string } | string; orderedQty?: number; unitPrice?: number }[]
      }>(r)
      const sid =
        typeof d?.supplierId === 'object' && d?.supplierId != null && '_id' in d.supplierId
          ? String((d.supplierId as { _id: string })._id)
          : String(d?.supplierId ?? '')
      setPoSupplierId(sid)
      setPoNotes(typeof d?.notes === 'string' ? d.notes : '')
      const mapped = (d?.lines ?? []).map(pl => ({
        productId: String(pl.productId && typeof pl.productId === 'object' ? pl.productId?._id : pl.productId ?? ''),
        orderedQty: Number(pl.orderedQty) || 0,
        unitPrice: Number(pl.unitPrice) ?? 0
      }))
      setPoLines(mapped.length ? mapped : [{ productId: '', orderedQty: 1, unitPrice: 0 }])
    } catch (e) {
      procurementShowError(e, 'Could not load supplier order')
      setPoEditingId(null)
      setPoOpen(false)
    } finally {
      setLoadingEditPoId(null)
    }
  }

  const submitPo = async () => {
    if (!isPoOrderFormValid) return

    setPoSaving(true)
    try {
      const payload = {
        supplierId: poSupplierId,
        ...(poNotes.trim() ? { notes: poNotes.trim() } : {}),
        lines: poLines.map(l => ({
          productId: l.productId,
          orderedQty: Number(l.orderedQty) || 0,
          unitPrice: Number(l.unitPrice) || 0
        }))
      }
      if (poEditingId) {
        await procurementService.updatePurchaseOrder(poEditingId, payload)
        showSuccess('Supplier order updated')
      } else {
        await procurementService.createPurchaseOrder(payload)
        showSuccess('Supplier order created')
      }
      setPoEditingId(null)
      setPoOpen(false)
      void refreshHub()
      setTab(0)
    } catch (e) {
      procurementShowError(e, poEditingId ? 'Could not update supplier order' : 'Could not create supplier order')
    } finally {
      setPoSaving(false)
    }
  }

  const openGrnDialog = () => {
    setGrnEditingId(null)
    setGrnFormHighlight(null)
    setGrnPurchaseOrderId('')
    setPoDetail(null)
    setGrnLines([])
    setGrnShippingTotal(0)
    setGrnOpen(true)
  }

  /** Open receive goods for a supplier order id (order must still allow receiving). */
  const openReceiveGoodsForPurchaseOrderId = (purchaseOrderId: string, poStatus: string) => {
    if (!canReceive) {
      procurementShowError(null, 'You do not have permission to receive goods.')
      return
    }
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(poStatus)) {
      procurementShowError(
        null,
        poStatus === 'DRAFT'
          ? 'Approve the supplier order before receiving goods.'
          : 'This supplier order no longer accepts new receipts.'
      )
      return
    }
    setGrnEditingId(null)
    setTab(1)
    setGrnShippingTotal(0)
    setGrnPurchaseOrderId(purchaseOrderId)
    setGrnOpen(true)
  }

  const openEditGoodsReceipt = async (g: GrnRow) => {
    if (!canCreate || g.status !== 'DRAFT') return
    setLoadingEditGrnId(g._id)
    setGrnFormHighlight(null)
    setGrnEditingId(g._id)
    setTab(1)
    setGrnOpen(true)
    setGrnShippingTotal(0)
    try {
      const r = await procurementService.getGoodsReceiptNote(g._id)
      const d = apiPayload<{
        purchaseOrderId?: string | { _id?: string }
        totalShippingCost?: number
        lines?: {
          productId?: string | { _id?: string }
          purchaseOrderLineId?: string | { _id?: string }
          qtyReceived?: number
          unitCost?: number
          factoryUnitCost?: number
          distributorId?: string | { _id?: string }
        }[]
      }>(r)
      const pid =
        typeof d?.purchaseOrderId === 'object' && d?.purchaseOrderId && '_id' in d.purchaseOrderId
          ? String((d.purchaseOrderId as { _id: string })._id)
          : String(d?.purchaseOrderId ?? '')
      if (!pid) {
        procurementShowError(null, 'Missing supplier order on this receipt.')
        setGrnOpen(false)
        setGrnEditingId(null)
        return
      }
      const poR = await procurementService.getPurchaseOrder(pid)
      setGrnPurchaseOrderId(pid)
      setPoDetail(apiPayload(poR))
      setGrnShippingTotal(Number(d?.totalShippingCost) || 0)
      const lines = (d?.lines ?? []).map(l => ({
        productId: String((typeof l.productId === 'object' ? l.productId?._id : l.productId) ?? ''),
        purchaseOrderLineId: l.purchaseOrderLineId
          ? String(
              typeof l.purchaseOrderLineId === 'object' && l.purchaseOrderLineId &&
              '_id' in l.purchaseOrderLineId
                ? (l.purchaseOrderLineId as { _id: string })._id
                : l.purchaseOrderLineId
            )
          : '',
        qtyReceived: Number(l.qtyReceived) || 0,
        unitCost:
          l.factoryUnitCost != null && l.factoryUnitCost !== undefined
            ? Number(l.factoryUnitCost)
            : Number(l.unitCost) || 0,
        distributorId: String(
          (typeof l.distributorId === 'object' && l.distributorId && '_id' in l.distributorId
            ? (l.distributorId as { _id: string })._id
            : l.distributorId) ?? ''
        )
      }))
      setGrnLines(
        lines.length
          ? lines
          : [{ productId: '', purchaseOrderLineId: '', qtyReceived: 1, unitCost: 0, distributorId: '' }]
      )
    } catch (e) {
      procurementShowError(e, 'Could not load receipt')
      setGrnOpen(false)
      setGrnEditingId(null)
    } finally {
      setLoadingEditGrnId(null)
    }
  }

  const openReceiveGoodsForOrder = (p: PoRow) => openReceiveGoodsForPurchaseOrderId(p._id, p.status)

  const linkedPoFromGrn = (
    g: GrnRow
  ): { id: string; status: string } | null => {
    const po = g.purchaseOrderId
    if (po && typeof po === 'object' && po._id) return { id: String(po._id), status: String(po.status ?? '') }
    return null
  }

  /** New receipt against the same supplier order as this row (when PO still receivable). */
  const openReceiveGoodsFromGrnRow = (g: GrnRow) => {
    const po = linkedPoFromGrn(g)
    if (!po) {
      procurementShowError(null, 'Could not find the linked supplier order.')
      return
    }
    openReceiveGoodsForPurchaseOrderId(po.id, po.status)
  }

  const quickPrintSupplierOrder = async (p: PoRow) => {
    setPrintingPoId(p._id)
    try {
      const r = await procurementService.getPurchaseOrder(p._id)
      const d = apiPayload<{ supplierId?: { name?: string }; lines?: { productId?: { name?: string }; orderedQty?: number; unitPrice?: number }[] }>(
        r
      )
      if (!d?.lines?.length) {
        procurementShowError(null, 'This order has no lines to print.')
        return
      }
      setHubPrintDoc({
        kind: 'supplierOrder',
        orderNumber: p.orderNumber,
        supplierName: d.supplierId?.name ?? '—',
        lines: (d.lines || []).map(pl => ({
          name: pl.productId?.name ?? 'Product',
          qty: Number(pl.orderedQty) || 0,
          unitPrice: Number(pl.unitPrice) || 0
        }))
      })
    } catch (e) {
      procurementShowError(e, 'Could not load order for print')
    } finally {
      setPrintingPoId(null)
    }
  }

  const quickPrintGoodsReceipt = async (g: GrnRow) => {
    setPrintingGrnId(g._id)
    try {
      const r = await procurementService.getGoodsReceiptNote(g._id)
      const d = apiPayload<{
        receiptNumber?: string
        receivedAt?: string
        supplierId?: { name?: string }
        purchaseOrderId?: { orderNumber?: string }
        lines?: { productId?: { name?: string }; qtyReceived?: number; unitCost?: number; factoryUnitCost?: number }[]
      }>(r)
      if (!d?.lines?.length) {
        procurementShowError(null, 'This receipt has no lines to print.')
        return
      }
      setHubPrintDoc({
        kind: 'goodsReceipt',
        receiptNumber: d.receiptNumber || g.receiptNumber,
        supplierName: d.supplierId?.name ?? '—',
        supplierOrderNumber:
          typeof d.purchaseOrderId === 'object' ? (d.purchaseOrderId?.orderNumber as string) ?? '—' : '—',
        receivedDate: formatDate(d.receivedAt),
        lines: (d.lines || []).map(line => ({
          name: line.productId?.name ?? 'Product',
          qty: Number(line.qtyReceived) || 0,
          unitCost: Number(line.unitCost) || 0
        }))
      })
    } catch (e) {
      procurementShowError(e, 'Could not load receipt for print')
    } finally {
      setPrintingGrnId(null)
    }
  }

  const submitGrn = async () => {
    setGrnFormHighlight(null)
    for (const l of grnLines) {
      const q = Number(l.qtyReceived) || 0
      if (q <= 0) continue
      if (q > lineReceiveCap(l) + 1e-9) {
        procurementShowError(null, 'Cannot receive more than remaining quantity.')
        return
      }
    }
    const shipNum = Number(grnShippingTotal) || 0
    const eligible = grnLines.filter(l => (Number(l.qtyReceived) || 0) > 0 && String(l.productId))
    const totalQty = eligible.reduce((s, l) => s + (Number(l.qtyReceived) || 0), 0)
    if (!eligible.length) {
      procurementShowError(null, 'Enter at least one line with quantity and product.')
      return
    }
    const missingDist: Record<number, boolean> = {}
    grnLines.forEach((l, idx) => {
      if ((Number(l.qtyReceived) || 0) > 0 && String(l.productId) && !String(l.distributorId).trim()) {
        missingDist[idx] = true
      }
    })
    if (Object.keys(missingDist).length) {
      setGrnFormHighlight({ missingDistributor: missingDist })
      procurementShowError(null, 'Choose a distributor for each line that has quantity.')
      return
    }
    if (shipNum > 0 && totalQty <= 0) {
      procurementShowError(null, 'Shipping requires a positive total quantity on the lines.')
      return
    }
    const perUnitShip = totalQty > 0 ? shipNum / totalQty : 0
    setGrnSaving(true)
    try {
      const linePayload = eligible.map(l => {
        const qty = Number(l.qtyReceived) || 0
        const base = Number(l.unitCost) || 0
        const merged = base + perUnitShip
        const line: Record<string, unknown> = {
          productId: l.productId,
          qtyReceived: qty,
          unitCost: Math.round(merged * 1e6) / 1e6,
          factoryUnitCost: Math.round(base * 1e6) / 1e6,
          distributorId: l.distributorId
        }
        if (l.purchaseOrderLineId) line.purchaseOrderLineId = l.purchaseOrderLineId
        return line
      })
      if (grnEditingId) {
        await procurementService.updateGoodsReceiptNote(grnEditingId, {
          totalShippingCost: shipNum,
          lines: linePayload
        })
        showSuccess('Receive goods draft updated')
      } else {
        await procurementService.createGoodsReceiptNote({
          purchaseOrderId: grnPurchaseOrderId,
          totalShippingCost: shipNum,
          lines: linePayload
        })
        showSuccess('Receive goods saved as draft — post when ready')
      }
      setGrnEditingId(null)
      setGrnFormHighlight(null)
      setGrnOpen(false)
      void refreshHub()
      setTab(1)
    } catch (e) {
      procurementShowError(e, 'Could not save receive goods')
    } finally {
      setGrnSaving(false)
    }
  }

  const openInvDialog = () => {
    setInvSupplierId('')
    setInvSelectedGrns({})
    setInvSub(0)
    setInvTax(0)
    setInvFreight(0)
    setInvDisc(0)
    setInvOpen(true)
  }

  /** New supplier invoice draft: optional flow, anchored to one posted receipt. */
  const openSupplierInvoiceForGrn = (g: GrnRow) => {
    if (!canPostInvoice) {
      procurementShowError(null, 'You do not have permission to create supplier invoices.')
      return
    }
    if (g.status !== 'POSTED') {
      procurementShowError(null, 'Post this receipt first. Supplier invoices can only link posted receipts.')
      return
    }
    const sid =
      typeof g.supplierId === 'object' && g.supplierId && '_id' in g.supplierId
        ? String((g.supplierId as { _id: string })._id)
        : String(g.supplierId ?? '')
    if (!sid) {
      procurementShowError(null, 'Missing supplier on this receipt.')
      return
    }
    setInvSub(0)
    setInvTax(0)
    setInvFreight(0)
    setInvDisc(0)
    setInvSupplierId(sid)
    setInvSelectedGrns({ [g._id]: true })
    setTab(2)
    setInvOpen(true)
  }

  const toggleGrnSel = (id: string) => {
    setInvSelectedGrns(s => ({ ...s, [id]: !s[id] }))
  }

  const submitInv = async () => {
    if (!invSupplierId.trim()) {
      procurementShowError(null, 'Please select a supplier.')
      return
    }
    const ids = Object.keys(invSelectedGrns).filter(k => invSelectedGrns[k])
    if (!ids.length) {
      procurementShowError(null, 'Select at least one posted receipt.')
      return
    }
    setInvSaving(true)
    try {
      await procurementService.createSupplierInvoice({
        supplierId: invSupplierId,
        grnIds: ids,
        subTotalAmount: invSub,
        taxAmount: invTax,
        freightAmount: invFreight,
        discountAmount: invDisc,
        totalAmount: computedInvTotal
      })
      showSuccess('Supplier invoice draft saved')
      setInvOpen(false)
      void refreshHub()
      setTab(2)
    } catch (e) {
      procurementShowError(e, 'Create invoice failed')
    } finally {
      setInvSaving(false)
    }
  }

  const openViewPo = async (row: PoRow) => {
    setViewPo(row)
    setViewPoDetail(null)
    try {
      const r = await procurementService.getPurchaseOrder(row._id)
      setViewPoDetail(apiPayload(r))
    } catch (e) {
      procurementShowError(e, 'Could not load supplier order')
    }
  }

  const openViewGrn = async (row: GrnRow) => {
    setViewGrn(row)
    setViewGrnDetail(null)
    try {
      const r = await procurementService.getGoodsReceiptNote(row._id)
      setViewGrnDetail(apiPayload(r))
    } catch (e) {
      procurementShowError(e, 'Could not load receive goods')
    }
  }

  const openViewInv = async (row: InvRow) => {
    setViewInv(row)
    setViewInvDetail(null)
    try {
      const r = await procurementService.getSupplierInvoice(row._id)
      setViewInvDetail(apiPayload(r))
    } catch (e) {
      procurementShowError(e, 'Could not load invoice')
    }
  }

  const diffPreview =
    expectedFromSelectedGrns != null ? Math.round((computedInvTotal - expectedFromSelectedGrns) * 100) / 100 : null

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Typography>You do not have permission to view procurement.</Typography>
        </CardContent>
      </Card>
    )
  }

  const printViewedSupplierOrder = () => {
    const d = viewPoDetail as { supplierId?: { name?: string }; lines?: { productId?: { name?: string }; orderedQty?: number; unitPrice?: number }[] } | null
    if (!viewPo || !d?.lines?.length) return
    setHubPrintDoc({
      kind: 'supplierOrder',
      orderNumber: viewPo.orderNumber,
      supplierName: d.supplierId?.name ?? '—',
      lines: (d.lines || []).map(pl => ({
        name: pl.productId?.name ?? 'Product',
        qty: Number(pl.orderedQty) || 0,
        unitPrice: Number(pl.unitPrice) || 0
      }))
    })
  }

  return (
    <>
      {hubPrintDoc ? (
        <GlobalStyles
          styles={theme => ({
            '@media screen': {
              '#procurement-hub-print-root': { display: 'none !important' }
            },
            '@media print': {
              body: { visibility: 'hidden' },
              '#procurement-hub-print-root, #procurement-hub-print-root *': { visibility: 'visible' },
              '#procurement-hub-print-root': {
                display: 'block !important',
                visibility: 'visible',
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                bgcolor: theme.palette.background.paper,
                padding: theme.spacing(3)
              }
            }
          })}
        />
      ) : null}
      <Card sx={{ borderRadius: 4, boxShadow: theme => theme.shadows[isMdUp ? 2 : 0] }}>
        <CardHeader
          title='Procurement'
          action={
            <Button variant='outlined' size='small' onClick={() => router.push('/suppliers/list')} startIcon={<i className='tabler-cash' />}>
              Go to suppliers — payments
            </Button>
          }
        />
        <CardContent className='flex flex-col gap-4'>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant='scrollable' allowScrollButtonsMobile>
              <Tab label='Supplier orders' />
              <Tab label='Receive goods' />
              <Tab label='Supplier invoice (optional)' />
            </Tabs>
          </Box>

          {tab === 0 && (
            <TabToolbar
              title='Supplier orders'
              primary={
                canCreate && (
                  <Button variant='contained' onClick={openPoDialog}>
                    Create supplier order
                  </Button>
                )
              }
            >
              <FilterRow>
                <CustomTextField
                  select
                  size='small'
                  label='Supplier'
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value=''>All suppliers</MenuItem>
                  {suppliersForFilter.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  size='small'
                  label='Status'
                  value={poStatusFilter}
                  onChange={e => setPoStatusFilter(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value=''>All</MenuItem>
                  <MenuItem value='DRAFT'>Draft</MenuItem>
                  <MenuItem value='APPROVED'>Approved</MenuItem>
                  <MenuItem value='PARTIALLY_RECEIVED'>Partially received</MenuItem>
                  <MenuItem value='CLOSED'>Closed</MenuItem>
                </CustomTextField>
              </FilterRow>
            </TabToolbar>
          )}

          {tab === 1 && (
            <TabToolbar
              title='Receive goods'
              primary={
                canCreate && (
                  <Button variant='contained' onClick={openGrnDialog}>
                    Receive goods
                  </Button>
                )
              }
            >
              <FilterRow>
                <CustomTextField
                  select
                  size='small'
                  label='Supplier'
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value=''>All suppliers</MenuItem>
                  {suppliersForFilter.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  size='small'
                  label='Status'
                  value={grnStatusFilter}
                  onChange={e => setGrnStatusFilter(e.target.value)}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value=''>All</MenuItem>
                  <MenuItem value='DRAFT'>Draft</MenuItem>
                  <MenuItem value='POSTED'>Posted</MenuItem>
                </CustomTextField>
              </FilterRow>
            </TabToolbar>
          )}

          {tab === 2 && (
            <TabToolbar
              title='Supplier invoice (optional)'
              primary={
                canCreate && (
                  <Button variant='outlined' onClick={openInvDialog}>
                    New supplier invoice
                  </Button>
                )
              }
            >
              <FilterRow>
                <CustomTextField
                  select
                  size='small'
                  label='Supplier'
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value=''>All suppliers</MenuItem>
                  {suppliersForFilter.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  size='small'
                  label='Status'
                  value={invStatusFilter}
                  onChange={e => setInvStatusFilter(e.target.value)}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value=''>All</MenuItem>
                  <MenuItem value='DRAFT'>Draft</MenuItem>
                  <MenuItem value='POSTED'>Posted</MenuItem>
                </CustomTextField>
              </FilterRow>
            </TabToolbar>
          )}

          {tab === 2 && (
            <Alert severity='info' sx={{ borderRadius: 3, mb: 2 }}>
              Optional — use only if your supplier invoice amount or lines differ from what you received into stock.
            </Alert>
          )}

          {hubLoading ? (
            <Box className='space-y-3'>
              <Skeleton variant='rounded' height={56} sx={{ borderRadius: 3 }} />
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} variant='rounded' height={44} sx={{ borderRadius: 2 }} />
              ))}
            </Box>
          ) : (
            <>
              {tab === 0 && (
                <>
                  {pos.length > 0 && filteredPos.length === 0 ? (
                    <Alert severity='info' sx={{ borderRadius: 3 }}>
                      No supplier orders match your filters. Adjust or clear filters above.
                    </Alert>
                  ) : !filteredPos.length ? (
                    <EmptyState icon='tabler-clipboard-off' title='No supplier orders yet' subtitle='Create a supplier order to start buying.' />
                  ) : isMdUp ? (
                    <TableContainer component={Paper} variant='outlined' sx={{ borderRadius: 3 }}>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Order #</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align='center'>Receipt progress</TableCell>
                            <TableCell align='right'>Ordered</TableCell>
                            <TableCell align='right'>Received</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align='right'>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredPos.map(p => {
                            const m = poExtras[p._id]
                            const pct = poProgress(m)
                            const extrasPending = m === undefined
                            return (
                              <TableRow key={p._id} hover>
                                <TableCell>
                                  <Typography variant='body2' fontWeight={700}>
                                    {p.orderNumber}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <TruncWithTip
                                    text={typeof p.supplierId === 'object' ? String((p.supplierId as any)?.name ?? '') : '—'}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip size='small' label={p.status.replace(/_/g, ' ')} variant='filled' sx={{ textTransform: 'capitalize' }} {...statusChipSx(p.status)} />
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ minWidth: 100 }}>
                                    {extrasPending ? (
                                      <>
                                        <Skeleton variant='text' width={48} sx={{ mb: 0.5 }} />
                                        <Skeleton variant='rounded' sx={{ height: 8, borderRadius: 999 }} />
                                      </>
                                    ) : (
                                      <>
                                        <Typography variant='caption' color='text.secondary'>
                                          {pct}%
                                        </Typography>
                                        <LinearProgress variant='determinate' value={pct} sx={{ mt: 0.5, height: 8, borderRadius: 999 }} />
                                      </>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align='right'>
                                  {extrasPending ? (
                                    <Skeleton variant='text' width={56} sx={{ ml: 'auto', display: 'inline-block' }} />
                                  ) : (
                                    (m?.ordered ?? 0).toLocaleString('en-PK')
                                  )}
                                </TableCell>
                                <TableCell align='right'>
                                  {extrasPending ? (
                                    <Skeleton variant='text' width={56} sx={{ ml: 'auto', display: 'inline-block' }} />
                                  ) : (
                                    (m?.received ?? 0).toLocaleString('en-PK')
                                  )}
                                </TableCell>
                                <TableCell>{formatDate(p.createdAt)}</TableCell>
                                <TableCell align='right'>
                                  <Tooltip title='Print supplier order'>
                                    <span>
                                      <IconButton
                                        size='small'
                                        onClick={() => void quickPrintSupplierOrder(p)}
                                        aria-label='Print supplier order'
                                        disabled={printingPoId === p._id}
                                      >
                                        {printingPoId === p._id ? (
                                          <CircularProgress size={18} thickness={5} />
                                        ) : (
                                          <i className='tabler-printer' />
                                        )}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  {canReceive &&
                                    ['APPROVED', 'PARTIALLY_RECEIVED'].includes(p.status) && (
                                      <Tooltip title='Receive goods'>
                                        <IconButton size='small' onClick={() => openReceiveGoodsForOrder(p)} aria-label='Receive goods'>
                                          <i className='tabler-package-import' />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  <Tooltip title='View'>
                                    <IconButton size='small' onClick={() => void openViewPo(p)} aria-label='View'>
                                      <i className='tabler-eye' />
                                    </IconButton>
                                  </Tooltip>
                                  {canCreate && p.status === 'DRAFT' && (
                                    <Tooltip title='Edit supplier order'>
                                      <span>
                                        <IconButton
                                          size='small'
                                          onClick={() => void openEditPurchaseOrder(p)}
                                          aria-label='Edit supplier order'
                                          disabled={loadingEditPoId === p._id}
                                        >
                                          {loadingEditPoId === p._id ? (
                                            <CircularProgress size={18} thickness={5} />
                                          ) : (
                                            <i className='tabler-edit' />
                                          )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )}
                                  {canApprovePo && p.status === 'DRAFT' && (
                                    <ProcurementBusyButton
                                      size='small'
                                      variant='tonal'
                                      loadingLabel='Approving…'
                                      loading={approvingPoId === p._id}
                                      disabled={Boolean(loadingEditPoId)}
                                      onClick={async () => {
                                        setApprovingPoId(p._id)
                                        try {
                                          await procurementService.approvePurchaseOrder(p._id)
                                          showSuccess('Supplier order approved')
                                          void refreshHub()
                                        } catch (e) {
                                          procurementShowError(e, 'Could not approve this order')
                                        } finally {
                                          setApprovingPoId(null)
                                        }
                                      }}
                                    >
                                      Approve
                                    </ProcurementBusyButton>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <StackedCards>
                      {filteredPos.map(p => (
                        <MobilePoCard
                          key={p._id}
                          po={p}
                          metrics={poExtras[p._id]}
                          printLoading={printingPoId === p._id}
                          onPrint={() => void quickPrintSupplierOrder(p)}
                          onReceiveGoods={() => openReceiveGoodsForOrder(p)}
                          showReceiveGoods={canReceive && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(p.status)}
                          onEditDraft={canCreate && p.status === 'DRAFT' ? () => void openEditPurchaseOrder(p) : undefined}
                          editDraftLoading={loadingEditPoId === p._id}
                          onView={() => void openViewPo(p)}
                        />
                      ))}
                    </StackedCards>
                  )}
                </>
              )}

              {tab === 1 && (
                <>
                  {grns.length > 0 && filteredGrns.length === 0 ? (
                    <Alert severity='info' sx={{ borderRadius: 3 }}>
                      No receipts match your filters. Adjust or clear filters above.
                    </Alert>
                  ) : !filteredGrns.length ? (
                    <EmptyState icon='tabler-package' title='Nothing received yet' subtitle='Receive goods when stock arrives.' />
                  ) : isMdUp ? (
                    <TableContainer component={Paper} variant='outlined' sx={{ borderRadius: 3 }}>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Receipt #</TableCell>
                            <TableCell>Supplier order</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell>Receipt</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align='right'>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredGrns.map(g => {
                            const poSt = typeof g.purchaseOrderId === 'object' ? (g.purchaseOrderId as any)?.status : ''
                            const receiptLabel =
                              poSt === 'CLOSED' ? 'Final' : poSt?.includes?.('PARTIAL') || poSt === 'PARTIALLY_RECEIVED' ? 'Partial' : g.status === 'POSTED' ? 'Posted' : 'Pending receipt'
                            const poLink = linkedPoFromGrn(g)
                            const showReceiveMore =
                              !!poLink &&
                              canReceive &&
                              ['APPROVED', 'PARTIALLY_RECEIVED'].includes(poLink.status)
                            return (
                              <TableRow key={g._id} hover>
                                <TableCell>
                                  <Typography variant='body2' fontWeight={700}>
                                    {g.receiptNumber}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <TruncWithTip
                                    text={
                                      typeof g.purchaseOrderId === 'object'
                                        ? String((g.purchaseOrderId as any)?.orderNumber ?? '—')
                                        : '—'
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <TruncWithTip
                                    text={
                                      typeof g.supplierId === 'object'
                                        ? String((g.supplierId as any)?.name ?? '')
                                        : '—'
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip size='small' label={receiptLabel} variant='outlined' />
                                </TableCell>
                                <TableCell>
                                  <Chip size='small' label={g.status} {...statusChipSx(g.status)} />
                                </TableCell>
                                <TableCell>{formatDate(g.receivedAt)}</TableCell>
                                <TableCell align='right'>
                                  <Tooltip title='Print receipt'>
                                    <span>
                                      <IconButton
                                        size='small'
                                        onClick={() => void quickPrintGoodsReceipt(g)}
                                        aria-label='Print received goods slip'
                                        disabled={printingGrnId === g._id}
                                      >
                                        {printingGrnId === g._id ? (
                                          <CircularProgress size={18} thickness={5} />
                                        ) : (
                                          <i className='tabler-printer' />
                                        )}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  {showReceiveMore && (
                                    <Tooltip title='Receive more goods (same supplier order)'>
                                      <IconButton
                                        size='small'
                                        onClick={() => openReceiveGoodsFromGrnRow(g)}
                                        aria-label='Receive more goods'
                                      >
                                        <i className='tabler-package-import' />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {canPostInvoice && (
                                    <Tooltip
                                      title={
                                        g.status !== 'POSTED'
                                          ? 'Post this receipt first — supplier invoice links posted receipts only'
                                          : 'Supplier invoice (optional)'
                                      }
                                    >
                                      <span>
                                        <IconButton
                                          size='small'
                                          onClick={() => openSupplierInvoiceForGrn(g)}
                                          aria-label='Supplier invoice for this receipt'
                                          disabled={g.status !== 'POSTED'}
                                        >
                                          <i className='tabler-file-invoice' />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )}
                                  <Tooltip title='View'>
                                    <IconButton size='small' onClick={() => void openViewGrn(g)} aria-label='View'>
                                      <i className='tabler-eye' />
                                    </IconButton>
                                  </Tooltip>
                                  {canCreate && g.status === 'DRAFT' && (
                                    <Tooltip title='Edit receive goods'>
                                      <span>
                                        <IconButton
                                          size='small'
                                          onClick={() => void openEditGoodsReceipt(g)}
                                          aria-label='Edit receive goods'
                                          disabled={loadingEditGrnId === g._id}
                                        >
                                          {loadingEditGrnId === g._id ? (
                                            <CircularProgress size={18} thickness={5} />
                                          ) : (
                                            <i className='tabler-edit' />
                                          )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )}
                                  {canReceive && g.status === 'DRAFT' && (
                                    <Button size='small' variant='contained' onClick={() => setPostConfirmGrnId(g._id)}>
                                      Post receive
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <StackedCards>
                      {filteredGrns.map(g => {
                        const poLink = linkedPoFromGrn(g)
                        const showRecvMore =
                          !!poLink &&
                          canReceive &&
                          ['APPROVED', 'PARTIALLY_RECEIVED'].includes(poLink.status)
                        return (
                          <MobileGrnCard
                            key={g._id}
                            grn={g}
                            printLoading={printingGrnId === g._id}
                            showReceiveMore={showRecvMore}
                            canPostInvoice={canPostInvoice}
                            onPrint={() => void quickPrintGoodsReceipt(g)}
                            onReceiveMore={() => openReceiveGoodsFromGrnRow(g)}
                            onSupplierInvoice={() => openSupplierInvoiceForGrn(g)}
                            onView={() => void openViewGrn(g)}
                            onEditDraft={
                              canCreate && g.status === 'DRAFT' ? () => void openEditGoodsReceipt(g) : undefined
                            }
                            editDraftLoading={loadingEditGrnId === g._id}
                            onPost={() => setPostConfirmGrnId(g._id)}
                            canPost={!!canReceive}
                          />
                        )
                      })}
                    </StackedCards>
                  )}
                </>
              )}

              {tab === 2 && (
                <>
                  {invoices.length > 0 && filteredInvoices.length === 0 ? (
                    <Alert severity='info' sx={{ borderRadius: 3 }}>
                      No supplier invoices match your filters. Adjust or clear filters above.
                    </Alert>
                  ) : !filteredInvoices.length ? (
                    <EmptyState icon='tabler-file-invoice' title='No supplier invoices yet' subtitle='Optional — add one if the supplier bill differs from received goods.' />
                  ) : isMdUp ? (
                    <TableContainer component={Paper} variant='outlined' sx={{ borderRadius: 3 }}>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Invoice #</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell>Linked receipts</TableCell>
                            <TableCell>Match preview</TableCell>
                            <TableCell align='right'>Amount</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align='right'>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredInvoices.map(inv => (
                              <TableRow key={inv._id} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{inv.invoiceNumber}</TableCell>
                              <TableCell>
                                <TruncWithTip
                                  text={
                                    typeof inv.supplierId === 'object'
                                      ? String((inv.supplierId as any)?.name ?? '')
                                      : '—'
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                {Array.isArray(inv.grnIds) ? inv.grnIds.length : 0}{' '}
                                {Array.isArray(inv.grnIds) && inv.grnIds.length ? 'receipt(s)' : ''}
                              </TableCell>
                              <TableCell>
                                {inv.status === 'DRAFT' && (
                                  <Typography variant='caption' color='text.secondary'>
                                    Post to reconcile vs receipts
                                  </Typography>
                                )}
                                {inv.status === 'POSTED' && (
                                  <Chip size='small' color='success' label='Recorded' variant='outlined' />
                                )}
                              </TableCell>
                              <TableCell align='right'>{formatPKR(inv.totalAmount ?? 0)}</TableCell>
                              <TableCell>
                                <Chip size='small' label={inv.status} {...statusChipSx(inv.status)} />
                              </TableCell>
                              <TableCell align='right'>
                                <IconButton size='small' onClick={() => void openViewInv(inv)}>
                                  <i className='tabler-eye' />
                                </IconButton>
                                {canPostInvoice && inv.status === 'DRAFT' && (
                                  <ProcurementBusyButton
                                    size='small'
                                    variant='contained'
                                    loadingLabel='Posting…'
                                    loading={postingInvoiceId === inv._id}
                                    onClick={async () => {
                                      setPostingInvoiceId(inv._id)
                                      try {
                                        await procurementService.postSupplierInvoice(inv._id)
                                        showSuccess('Invoice posted — ledger adjusted if needed')
                                        void refreshHub()
                                      } catch (e) {
                                        procurementShowError(e, 'Could not post this invoice')
                                      } finally {
                                        setPostingInvoiceId(null)
                                      }
                                    }}
                                  >
                                    Post
                                  </ProcurementBusyButton>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <StackedCards>
                      {filteredInvoices.map(inv => (
                        <MobileInvCard key={inv._id} inv={inv} onView={() => void openViewInv(inv)} />
                      ))}
                    </StackedCards>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* PO create — single-page layout (aligned with Create Order form) */}
      <Dialog
        open={poOpen}
        onClose={() => {
          setPoOpen(false)
          setPoEditingId(null)
        }}
        maxWidth='lg'
        fullWidth
        scroll='body'
      >
        <DialogTitle>{poEditingId ? 'Edit supplier order' : 'New supplier order'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <CustomTextField
                required
                select
                fullWidth
                label='Supplier'
                value={poSupplierId}
                onChange={e => setPoSupplierId(e.target.value)}
              >
                {suppliers.map((s: any) => (
                  <MenuItem key={s._id} value={s._id}>
                    {s.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='body2' color='text.secondary'>
                Unit price defaults from product <strong>casting</strong> when you choose a product; you can override per line. Totals exclude freight.
              </Typography>
            </Grid>
            {poLines.map((line, idx) => (
              <Grid container spacing={3} key={idx} size={{ xs: 12 }}>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <CustomTextField
                    required
                    select
                    fullWidth
                    label='Product'
                    value={line.productId}
                    onChange={e => {
                      const pid = e.target.value
                      const pr = products.find((p: any) => String(p._id) === String(pid))
                      const cast =
                        pr != null && pr.casting != null && pr.casting !== ''
                          ? Number(pr.casting)
                          : null
                      setPoLines(prev =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                productId: pid,
                                unitPrice:
                                  cast != null && !Number.isNaN(cast) ? cast : x.unitPrice
                              }
                            : x
                        )
                      )
                    }}
                  >
                    {products.map((p: any) => (
                      <MenuItem key={p._id} value={p._id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </CustomTextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <CustomTextField
                    required
                    fullWidth
                    type='number'
                    label='Qty'
                    value={line.orderedQty}
                    onChange={e =>
                      setPoLines(prev =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, orderedQty: Number(e.target.value) } : x
                        )
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Unit price'
                    value={line.unitPrice}
                    onChange={e =>
                      setPoLines(prev =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, unitPrice: Number(e.target.value) } : x
                        )
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }} className='flex items-center'>
                  {poLines.length > 1 && (
                    <IconButton
                      aria-label='Remove line'
                      onClick={() => setPoLines(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <i className='tabler-trash text-error' />
                    </IconButton>
                  )}
                </Grid>
              </Grid>
            ))}
            <Grid size={{ xs: 12 }}>
              <Button
                variant='outlined'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setPoLines(p => [...p, { productId: '', orderedQty: 1, unitPrice: 0 }])}
              >
                Add line
              </Button>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='body2' color='text.secondary'>
                Expected total (excl. freight):{' '}
                <strong>
                  {formatPKR(
                    poLines.reduce((s, l) => s + (Number(l.orderedQty) || 0) * (Number(l.unitPrice) || 0), 0)
                  )}
                </strong>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes (optional)'
                multiline
                rows={2}
                value={poNotes}
                onChange={e => setPoNotes(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            gap: 1,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            '& .MuiButton-root': { xs: { width: '100%' }, sm: { width: 'auto' } }
          }}
        >
          <Button
            onClick={() => {
              setPoOpen(false)
              setPoEditingId(null)
            }}
          >
            Cancel
          </Button>
          <ProcurementBusyButton
            variant='contained'
            disabled={!isPoOrderFormValid}
            loading={poSaving}
            loadingLabel={poEditingId ? 'Saving…' : 'Creating…'}
            onClick={submitPo}
          >
            {poEditingId ? 'Save changes' : 'Create supplier order'}
          </ProcurementBusyButton>
        </DialogActions>
      </Dialog>

      {/* GRN create — pending lines only; table layout aligned with supplier order */}
      <Dialog
        open={grnOpen}
        onClose={() => {
          setGrnOpen(false)
          setGrnEditingId(null)
          setGrnFormHighlight(null)
        }}
        maxWidth='lg'
        fullWidth
        scroll='body'
      >
        <DialogTitle>{grnEditingId ? 'Edit receive goods draft' : 'Receive goods'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 0.5 }}>
            <Typography variant='body2' color='text.secondary'>
              Choose an approved supplier order. <strong>Enter quantity received for each item</strong> you can still
              allocate on this receipt. Add <strong>total shipping</strong> for this delivery if needed — it is spread
              per unit and included in inventory cost when you <strong>post</strong> the receipt.
              <br />
              <strong>Already received</strong> is stock recorded on this order after you <strong>post</strong> a receipt.
              Quantities still only on a <strong>draft</strong> receipt show under <strong>Other drafts</strong> and
              reduce what you can enter here until that draft is posted or changed.
              {grnEditingId ? ' Supplier order is fixed while editing this draft.' : null}
            </Typography>
            <CustomTextField
              select
              fullWidth
              label='Supplier order'
              disabled={Boolean(grnEditingId)}
              value={grnPurchaseOrderId}
              SelectProps={{
                displayEmpty: true,
                renderValue: (v: unknown) => {
                  const sv = v == null ? '' : String(v)
                  if (!sv) return '—'
                  const row = receivablePos.find(p => String(p._id) === sv)
                  if (row) return `${row.orderNumber} · ${String((row.supplierId as any)?.name ?? '')}`
                  if (poDetail?.orderNumber) return String(poDetail.orderNumber)
                  return sv
                }
              }}
              onChange={e => setGrnPurchaseOrderId(e.target.value)}
            >
              {receivablePos.map(p => (
                <MenuItem key={p._id} value={p._id}>
                  {p.orderNumber} · {(p.supplierId as any)?.name}
                </MenuItem>
              ))}
            </CustomTextField>
            {Boolean(grnPurchaseOrderId) && !grnEditingId && !poDetail ? (
              <Box sx={{ py: 1 }}>
                <LinearProgress />
                <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
                  Loading supplier order…
                </Typography>
              </Box>
            ) : null}
            {grnPurchaseOrderId && poDetail && grnSiblingReceiptsLoading ? (
              <LinearProgress sx={{ borderRadius: 1 }} />
            ) : null}
            {!grnEditingId && isGrnFullyPostedOnOrder ? (
              <Alert severity='info' sx={{ borderRadius: 3 }}>
                All items in this Supplier Order have already been received.
              </Alert>
            ) : null}
            {!grnEditingId && !isGrnFullyPostedOnOrder && isGrnNoReceiveCapacityLeft ? (
              <Alert severity='info' sx={{ borderRadius: 3 }}>
                All quantities on this order are already on posted receipts or other draft receipts. Post or edit those
                drafts before receiving again.
              </Alert>
            ) : null}
            {!grnEditingId && hasGrnQtyInOtherDrafts && !isGrnNoReceiveCapacityLeft ? (
              <Alert severity='warning' variant='outlined' sx={{ borderRadius: 3 }}>
                Another draft receipt reserves part of this order. Totals below account for it so you do not over-receive
                across drafts.
              </Alert>
            ) : null}
            {!grnEditingId && grnPurchaseOrderId && grnPendingPoLines.length > 0 && grnLines.length > 0 ? (
              <Box>
                <Button
                  size='small'
                  variant='outlined'
                  startIcon={<i className='tabler-package-import' />}
                  onClick={fillReceiveAllRemaining}
                >
                  Receive all remaining
                </Button>
              </Box>
            ) : null}
            {isMdUp ? (
              <TableContainer component={Paper} variant='outlined' sx={{ borderRadius: 3 }}>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align='right'>Ordered</TableCell>
                      <TableCell align='right'>Posted</TableCell>
                      <TableCell align='right'>Other drafts</TableCell>
                      <TableCell align='right'>Remaining</TableCell>
                      <TableCell align='right' sx={{ minWidth: 120 }}>
                        Receive now
                      </TableCell>
                      <TableCell align='right' sx={{ minWidth: 100 }}>
                        Factory / unit
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>Distributor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grnLines.length === 0 &&
                    !isGrnFullyPostedOnOrder &&
                    (grnEditingId || !isGrnNoReceiveCapacityLeft) ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography variant='body2' color='text.secondary' sx={{ py: 2 }}>
                            {grnPurchaseOrderId && poDetail
                              ? 'No pending lines for this supplier order.'
                              : 'Select a supplier order to load pending items.'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {grnLines.map((line, idx) => {
                      const pol = (poDetail?.lines as any[] | undefined)?.find(
                        (x: any) => String(x._id) === String(line.purchaseOrderLineId)
                      )
                      const polIdStr = pol?._id != null ? String(pol._id) : String(line.purchaseOrderLineId || '')
                      const ordered = Number(pol?.orderedQty) || 0
                      const alreadyPosted = poLinePostedQty(pol || {})
                      const inOtherDrafts = Number(grnOtherDraftQtyByPolId[polIdStr]) || 0
                      const remaining = poLineOpenReceiveQty(pol || {}, grnOtherDraftQtyByPolId)
                      const cap = lineReceiveCap(line)
                      const qtyNow = Number(line.qtyReceived) || 0
                      const overCap = qtyNow > cap + 1e-9
                      const productLabel =
                        pol?.productId?.name ||
                        (typeof line.productId === 'string'
                          ? products.find((p: any) => String(p._id) === line.productId)?.name
                          : '') ||
                        'Product'
                      return (
                        <TableRow key={`${line.purchaseOrderLineId}-${idx}`} hover>
                          <TableCell>
                            <TruncWithTip text={String(productLabel)} />
                          </TableCell>
                          <TableCell align='right'>{ordered}</TableCell>
                          <TableCell align='right'>{alreadyPosted}</TableCell>
                          <TableCell align='right'>{inOtherDrafts > 0 ? inOtherDrafts : '—'}</TableCell>
                          <TableCell align='right'>
                            <Typography component='span' fontWeight={700} color='primary.main'>
                              {remaining}
                            </Typography>
                          </TableCell>
                          <TableCell align='right' sx={{ verticalAlign: 'top' }}>
                            <CustomTextField
                              type='number'
                              size='small'
                              label=''
                              placeholder='Qty'
                              value={line.qtyReceived}
                              error={overCap}
                              helperText={overCap ? 'Cannot receive more than remaining quantity.' : ' '}
                              onChange={e => {
                                setGrnFormHighlight(null)
                                setGrnLines(prev =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, qtyReceived: Number(e.target.value) } : x
                                  )
                                )
                              }}
                              inputProps={{ min: 0, step: 1 }}
                              sx={{ width: 112 }}
                            />
                          </TableCell>
                          <TableCell align='right' sx={{ verticalAlign: 'top' }}>
                            <CustomTextField
                              type='number'
                              size='small'
                              label=''
                              placeholder='PKR'
                              value={line.unitCost}
                              onChange={e => {
                                setGrnFormHighlight(null)
                                setGrnLines(prev =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, unitCost: Number(e.target.value) } : x
                                  )
                                )
                              }}
                              inputProps={{ min: 0, step: 'any' }}
                              sx={{ width: 104 }}
                            />
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <CustomTextField
                              select
                              fullWidth
                              size='small'
                              label=''
                              SelectProps={{ displayEmpty: true }}
                              value={line.distributorId}
                              error={Boolean(grnFormHighlight?.missingDistributor?.[idx])}
                              helperText={
                                grnFormHighlight?.missingDistributor?.[idx] ? 'Choose a distributor' : ' '
                              }
                              onChange={e => {
                                setGrnFormHighlight(null)
                                setGrnLines(prev =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, distributorId: e.target.value } : x
                                  )
                                )
                              }}
                            >
                              <MenuItem value=''>
                                <em>Select…</em>
                              </MenuItem>
                              {distributors.map((d: any) => (
                                <MenuItem key={d._id} value={d._id}>
                                  {d.name}
                                </MenuItem>
                              ))}
                            </CustomTextField>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <>
                {grnLines.length === 0 &&
                !isGrnFullyPostedOnOrder &&
                (grnEditingId || !isGrnNoReceiveCapacityLeft) ? (
                  <Typography variant='body2' color='text.secondary' sx={{ py: 1 }}>
                    {grnPurchaseOrderId && poDetail
                      ? 'No pending lines for this supplier order.'
                      : 'Select a supplier order to load pending items.'}
                  </Typography>
                ) : null}
                <Stack spacing={2}>
                {grnLines.map((line, idx) => {
                  const pol = (poDetail?.lines as any[] | undefined)?.find(
                    (x: any) => String(x._id) === String(line.purchaseOrderLineId)
                  )
                  const polIdStr = pol?._id != null ? String(pol._id) : String(line.purchaseOrderLineId || '')
                  const ordered = Number(pol?.orderedQty) || 0
                  const alreadyPosted = poLinePostedQty(pol || {})
                  const inOtherDrafts = Number(grnOtherDraftQtyByPolId[polIdStr]) || 0
                  const remaining = poLineOpenReceiveQty(pol || {}, grnOtherDraftQtyByPolId)
                  const cap = lineReceiveCap(line)
                  const qtyNow = Number(line.qtyReceived) || 0
                  const overCap = qtyNow > cap + 1e-9
                  const productLabel =
                    pol?.productId?.name ||
                    (typeof line.productId === 'string'
                      ? products.find((p: any) => String(p._id) === line.productId)?.name
                      : '') ||
                    'Product'
                  return (
                    <Paper key={`${line.purchaseOrderLineId}-${idx}`} variant='outlined' sx={{ borderRadius: 3, p: 2 }}>
                      <Typography variant='subtitle2' className='mbe-2' sx={{ fontWeight: 700 }}>
                        {productLabel}
                      </Typography>
                      <Stack direction='row' spacing={2} flexWrap='wrap' useFlexGap className='mbe-3'>
                        <Typography variant='body2' color='text.secondary'>
                          Ordered: <strong>{ordered}</strong>
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          Posted: <strong>{alreadyPosted}</strong>
                        </Typography>
                        {inOtherDrafts > 0 ? (
                          <Typography variant='body2' color='warning.main'>
                            Other drafts: <strong>{inOtherDrafts}</strong>
                          </Typography>
                        ) : null}
                        <Typography variant='body2' color='primary.main'>
                          Remaining: <strong>{remaining}</strong>
                        </Typography>
                      </Stack>
                      <Stack spacing={2}>
                        <CustomTextField
                          fullWidth
                          type='number'
                          label='Receive now'
                          value={line.qtyReceived}
                          error={overCap}
                          helperText={overCap ? 'Cannot receive more than remaining quantity.' : undefined}
                          onChange={e => {
                            setGrnFormHighlight(null)
                            setGrnLines(prev =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, qtyReceived: Number(e.target.value) } : x
                              )
                            )
                          }}
                          inputProps={{ min: 0, step: 1 }}
                        />
                        <CustomTextField
                          fullWidth
                          type='number'
                          label='Factory / unit (PKR)'
                          value={line.unitCost}
                          onChange={e => {
                            setGrnFormHighlight(null)
                            setGrnLines(prev =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, unitCost: Number(e.target.value) } : x
                              )
                            )
                          }}
                          inputProps={{ min: 0, step: 'any' }}
                        />
                        <CustomTextField
                          select
                          fullWidth
                          label='Put stock into (distributor)'
                          value={line.distributorId}
                          error={Boolean(grnFormHighlight?.missingDistributor?.[idx])}
                          helperText={
                            grnFormHighlight?.missingDistributor?.[idx] ? 'Choose a distributor' : undefined
                          }
                          onChange={e => {
                            setGrnFormHighlight(null)
                            setGrnLines(prev =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, distributorId: e.target.value } : x
                              )
                            )
                          }}
                        >
                          <MenuItem value=''>
                            <em>Select distributor</em>
                          </MenuItem>
                          {distributors.map((d: any) => (
                            <MenuItem key={d._id} value={d._id}>
                              {d.name}
                            </MenuItem>
                          ))}
                        </CustomTextField>
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
              </>
            )}
            <CustomTextField
              fullWidth
              type='number'
              label='Total shipping cost for this receipt (PKR)'
              value={grnShippingTotal}
              onChange={e => setGrnShippingTotal(Number(e.target.value) || 0)}
              inputProps={{ min: 0, step: 'any' }}
              helperText={
                grnReceiptQtyTotal > 0
                  ? `≈ ${formatPKR(grnPerUnitShipping)} added to each unit for inventory only; supplier payable uses factory cost only.`
                  : 'Enter quantities above so shipping can be divided per unit.'
              }
              sx={{ maxWidth: { xs: '100%', sm: 400 } }}
            />
            {(grnShippingNum > 0 || grnReceiptQtyTotal > 0) && (
              <Paper variant='outlined' sx={{ borderRadius: 3, p: 2 }}>
                <Typography variant='subtitle2' className='mbe-1'>
                  Cost breakdown
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Units in this receipt: <strong>{grnReceiptQtyTotal}</strong>
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Shipping: <strong>{formatPKR(grnShippingNum)}</strong>
                  {grnReceiptQtyTotal > 0 ? ` (${formatPKR(grnPerUnitShipping)} / unit)` : ''}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                  Supplier (factory) total: <strong>{formatPKR(grnFactorySubtotal)}</strong>
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Inventory value (landed): <strong>{formatPKR(grnLandedInventoryTotal)}</strong>
                </Typography>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            px: 3,
            pb: 2,
            gap: 1,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            '& .MuiButton-root': { xs: { width: '100%' }, sm: { width: 'auto' } }
          }}
        >
          <Button
            onClick={() => {
              setGrnOpen(false)
              setGrnEditingId(null)
              setGrnFormHighlight(null)
            }}
          >
            Cancel
          </Button>
          <ProcurementBusyButton
            variant='contained'
            disabled={!isGrnSaveEnabled}
            loading={grnSaving}
            loadingLabel={grnEditingId ? 'Updating…' : 'Saving…'}
            onClick={submitGrn}
          >
            {grnEditingId ? 'Update draft' : 'Save draft'}
          </ProcurementBusyButton>
        </DialogActions>
      </Dialog>

      {/* Invoice create */}
      <Dialog open={invOpen} onClose={() => !invSaving && setInvOpen(false)} maxWidth='sm' fullWidth scroll='body'>
        <DialogTitle>Supplier invoice (optional)</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mbe-4'>
            Optional — link posted receipts (receive goods), then compare to your supplier invoice. Skip this if totals already match receipts.
          </Typography>
          <Stack spacing={2}>
            <CustomTextField select fullWidth label='Supplier' value={invSupplierId} onChange={e => setInvSupplierId(e.target.value)}>
              {suppliers.map((s: any) => (
                <MenuItem key={s._id} value={s._id}>
                  {s.name}
                </MenuItem>
              ))}
            </CustomTextField>
            <Box>
              <Typography variant='subtitle2' className='mbe-2'>
                Posted receipts to include
              </Typography>
              {invGrnOptions.map(g => (
                <div key={g._id} className='flex items-center gap-2'>
                  <Checkbox checked={!!invSelectedGrns[g._id]} onChange={() => toggleGrnSel(g._id)} />
                  <ListItemText primary={g.receiptNumber} secondary={formatDate(g.receivedAt)} />
                </div>
              ))}
              {invSupplierId && invGrnOptions.length === 0 && (
                <Typography variant='caption' color='text.secondary'>
                  No posted receive-goods slips for this supplier yet.
                </Typography>
              )}
            </Box>
            <Divider className='mbe-2' />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap flexWrap='wrap'>
              <CustomTextField fullWidth type='number' label='Subtotal' value={invSub} onChange={e => setInvSub(Number(e.target.value) || 0)} sx={{ flex: '1 1 140px' }} />
              <CustomTextField fullWidth type='number' label='Tax' value={invTax} onChange={e => setInvTax(Number(e.target.value) || 0)} sx={{ flex: '1 1 140px' }} />
              <CustomTextField fullWidth type='number' label='Freight' value={invFreight} onChange={e => setInvFreight(Number(e.target.value) || 0)} sx={{ flex: '1 1 140px' }} />
              <CustomTextField fullWidth type='number' label='Discount' value={invDisc} onChange={e => setInvDisc(Number(e.target.value) || 0)} sx={{ flex: '1 1 140px' }} />
            </Stack>
            <Box>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: theme => alpha(theme.palette.info.main, 0.06) }}>
                <Typography variant='subtitle2'>
                  Estimate from selected receipts (Σ qty × unit cost):{' '}
                  <strong>{expectedFromSelectedGrns != null ? formatPKR(expectedFromSelectedGrns) : '—'}</strong>
                </Typography>
                <Typography variant='subtitle2' className='mbs-1'>
                  Your invoice total: <strong>{formatPKR(computedInvTotal)}</strong>
                </Typography>
                {diffPreview != null && (
                  <Typography
                    variant='body2'
                    sx={{
                      mt: 1,
                      fontWeight: 700,
                      color: diffPreview > 0 ? 'warning.main' : diffPreview < 0 ? 'success.main' : 'text.secondary'
                    }}
                  >
                    Difference: {diffPreview > 0 ? '+' : ''}
                    {formatPKR(diffPreview)} — adjustments apply when posting
                  </Typography>
                )}
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            gap: 1,
            px: 3,
            pb: 2,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            '& .MuiButton-root': { xs: { width: '100%' }, sm: { width: 'auto' } }
          }}
        >
          <Button disabled={invSaving} onClick={() => setInvOpen(false)}>
            Cancel
          </Button>
          <ProcurementBusyButton variant='contained' disabled={!invSupplierId} loading={invSaving} loadingLabel='Saving…' onClick={submitInv}>
            Save invoice draft
          </ProcurementBusyButton>
        </DialogActions>
      </Dialog>

      {/* Confirm post GRN */}
      <Dialog
        open={Boolean(postConfirmGrnId)}
        onClose={() => {
          if (!postingGrnInFlight) setPostConfirmGrnId(null)
        }}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Post received goods?</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            This will <strong>increase distributor stock</strong> using the costs you entered (including any shipping you split per unit) and <strong>raise supplier payable</strong> for this shipment. This step cannot be undone from this screen — only via finance adjustments.
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            gap: 1,
            px: 3,
            pb: 2,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            '& .MuiButton-root': { xs: { width: '100%' }, sm: { width: 'auto' } }
          }}
        >
          <Button disabled={postingGrnInFlight} onClick={() => setPostConfirmGrnId(null)}>
            Cancel
          </Button>
          <ProcurementBusyButton
            variant='contained'
            loading={postingGrnInFlight}
            loadingLabel='Posting…'
            onClick={async () => {
              if (!postConfirmGrnId) return
              setPostingGrnInFlight(true)
              try {
                await procurementService.postGoodsReceiptNote(postConfirmGrnId)
                showSuccess('Received goods posted — stock and payable updated')
                setPostConfirmGrnId(null)
                void refreshHub()
              } catch (e) {
                procurementShowError(e, 'Could not post this receipt')
              } finally {
                setPostingGrnInFlight(false)
              }
            }}
          >
            Post receive
          </ProcurementBusyButton>
        </DialogActions>
      </Dialog>

      {/* View PO */}
      <Dialog open={Boolean(viewPo)} onClose={() => setViewPo(null)} maxWidth='md' fullWidth>
        <DialogTitle>Supplier order {viewPo?.orderNumber}</DialogTitle>
        <DialogContent>
          {!viewPoDetail ? (
            <Box className='flex justify-center py-10'>
              <CircularProgress aria-label='Loading supplier order' />
            </Box>
          ) : (
            <Box className='space-y-2'>
              <Typography variant='body2'>Supplier: {(viewPoDetail as any).supplierId?.name ?? '—'}</Typography>
              <Typography variant='body2'>Status: {(viewPoDetail as any).status}</Typography>
              <Divider className='mbe-4' />
              {(viewPoDetail as any).lines?.map((line: any) => (
                <Typography key={line._id} variant='body2'>
                  {line.productId?.name} — ordered {line.orderedQty} · received {line.receivedQty}
                </Typography>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setViewPo(null)}>Close</Button>
          <Button
            variant='outlined'
            startIcon={<i className='tabler-printer' />}
            onClick={printViewedSupplierOrder}
            disabled={!viewPoDetail?.lines?.length}
          >
            Print order
          </Button>
        </DialogActions>
      </Dialog>

      {/* View GRN */}
      <Dialog open={Boolean(viewGrn)} onClose={() => setViewGrn(null)} maxWidth='md' fullWidth>
        <DialogTitle>Received goods · {viewGrn?.receiptNumber}</DialogTitle>
        <DialogContent>
          {!viewGrnDetail ? (
            <Box className='flex justify-center py-10'>
              <CircularProgress aria-label='Loading receipt' />
            </Box>
          ) : (
            <>
              <Typography variant='body2' className='mbe-2'>
                Supplier order: {(viewGrnDetail as any).purchaseOrderId?.orderNumber ?? '—'}
              </Typography>
              {Number((viewGrnDetail as any).totalShippingCost) > 0 ? (
                <Typography variant='body2' color='text.secondary' className='mbe-2'>
                  Receipt shipping: {formatPKR(Number((viewGrnDetail as any).totalShippingCost) || 0)}
                </Typography>
              ) : null}
              {(viewGrnDetail as any).lines?.map((line: any) => {
                const qty = Number(line.qtyReceived) || 0
                const landed = Number(line.unitCost) || 0
                const fac =
                  line.factoryUnitCost != null && line.factoryUnitCost !== undefined
                    ? Number(line.factoryUnitCost)
                    : landed
                const factoryLine = Math.round(fac * qty * 100) / 100
                const landedLine = Math.round(landed * qty * 100) / 100
                const showSplit =
                  line.factoryUnitCost != null &&
                  line.factoryUnitCost !== undefined &&
                  Math.abs(landed - fac) > 1e-6
                return (
                  <Typography key={line._id} variant='body2' className='mbe-1'>
                    {line.productId?.name} — qty {qty} @ {formatPKR(landed)} landed
                    {showSplit
                      ? ` (${formatPKR(factoryLine)} supplier · ${formatPKR(landedLine)} inventory)`
                      : ''}
                    {' → '}
                    {(viewGrnDetail as any).distributor?.name || line.distributorId?.name}
                  </Typography>
                )
              })}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewGrn(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* View Invoice */}
      <Dialog open={Boolean(viewInv)} onClose={() => { setViewInv(null); setViewInvDetail(null) }} maxWidth='sm' fullWidth>
        <DialogTitle>Invoice {viewInvDetail?.invoiceNumber ?? viewInv?.invoiceNumber}</DialogTitle>
        <DialogContent>
          {!viewInvDetail ? (
            <Box className='flex justify-center py-10'>
              <CircularProgress size={28} aria-label='Loading invoice' />
            </Box>
          ) : (
            <Box className='space-y-2'>
              <Typography variant='body2'>
                Supplier: {viewInvDetail.supplierId?.name ?? (viewInv?.supplierId as any)?.name ?? '—'}
              </Typography>
              <Typography variant='body2'>Total: {formatPKR(viewInvDetail.totalAmount ?? 0)}</Typography>
              <Typography variant='body2'>Status: {viewInvDetail.status}</Typography>
              <Typography variant='body2' color='text.secondary'>
                Linked receipts:{' '}
                {Array.isArray(viewInvDetail.grnIds) ? `${viewInvDetail.grnIds.length} selected` : '—'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewInv(null); setViewInvDetail(null) }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Print — hidden on screen unless printing */}
      {hubPrintDoc ? (
        <Box id='procurement-hub-print-root' component='article'>
          {hubPrintDoc.kind === 'supplierOrder' ? (
            <>
              <Typography variant='h6' gutterBottom sx={{ fontWeight: 700 }}>
                Supplier order
              </Typography>
              <Typography variant='body2' color='text.secondary' gutterBottom>
                {hubPrintDoc.orderNumber}
              </Typography>
              <Typography variant='body1' className='mbe-4'>
                Supplier: <strong>{hubPrintDoc.supplierName}</strong>
              </Typography>
              <Table size='small' sx={{ minWidth: 400 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align='right'>Qty</TableCell>
                    <TableCell align='right'>Unit price</TableCell>
                    <TableCell align='right'>Line total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hubPrintDoc.lines.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align='right'>{row.qty}</TableCell>
                      <TableCell align='right'>{formatPKR(row.unitPrice)}</TableCell>
                      <TableCell align='right'>{formatPKR(row.qty * row.unitPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant='body2' className='mbs-4'>
                Expected total:{' '}
                <strong>
                  {formatPKR(hubPrintDoc.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0))}
                </strong>
              </Typography>
            </>
          ) : (
            <>
              <Typography variant='h6' gutterBottom sx={{ fontWeight: 700 }}>
                Received goods
              </Typography>
              <Typography variant='body2' color='text.secondary' gutterBottom>
                {hubPrintDoc.receiptNumber}
              </Typography>
              <Typography variant='body2' className='mbe-1'>
                Supplier order: <strong>{hubPrintDoc.supplierOrderNumber}</strong>
              </Typography>
              <Typography variant='body1' className='mbe-2'>
                Supplier: <strong>{hubPrintDoc.supplierName}</strong>
              </Typography>
              <Typography variant='body2' color='text.secondary' className='mbe-4'>
                Received: {hubPrintDoc.receivedDate}
              </Typography>
              <Table size='small' sx={{ minWidth: 400 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align='right'>Qty</TableCell>
                    <TableCell align='right'>Unit cost (landed)</TableCell>
                    <TableCell align='right'>Line total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hubPrintDoc.lines.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align='right'>{row.qty}</TableCell>
                      <TableCell align='right'>{formatPKR(row.unitCost)}</TableCell>
                      <TableCell align='right'>{formatPKR(row.qty * row.unitCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant='body2' className='mbs-4'>
                Total:{' '}
                <strong>
                  {formatPKR(hubPrintDoc.lines.reduce((s, l) => s + l.qty * l.unitCost, 0))}
                </strong>
              </Typography>
            </>
          )}
          <Typography variant='caption' color='text.secondary'>
            Generated from {new Date().toLocaleDateString('en-GB')}
          </Typography>
        </Box>
      ) : null}
    </>
  )
}

function TabToolbar({ title, primary, children }: { title: string; primary?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Box className='mbe-4'>
      <Box className='flex flex-col md:flex-row md:items-start md:justify-between gap-3 mbe-2'>
        <div>
          <Typography variant='subtitle1' fontWeight={700}>
            {title}
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Filters only affect how you browse this screen — refreshing reloads server data.
          </Typography>
        </div>
        {primary ? <Box className='flex w-full md:w-auto shrink-0'>{primary}</Box> : null}
      </Box>
      {children ? <Box className='flex flex-wrap gap-3 items-center pt-2'>{children}</Box> : null}
    </Box>
  )
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <Box className='flex flex-wrap gap-3 items-center justify-end'>{children}</Box>
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <Paper variant='outlined' sx={{ py: 6, px: 3, borderRadius: 4, textAlign: 'center' }}>
      <i className={`${icon} text-4xl text-textSecondary mb-4`} aria-hidden />
      <Typography variant='h6' className='mbe-2'>
        {title}
      </Typography>
      <Typography variant='body2' color='text.secondary'>
        {subtitle}
      </Typography>
    </Paper>
  )
}

function StackedCards({ children }: { children: React.ReactNode }) {
  return (
    <Box className='flex flex-col gap-3'>
      {children}
    </Box>
  )
}

function MobilePoCard({
  po,
  metrics,
  onView,
  onPrint,
  onReceiveGoods,
  onEditDraft,
  editDraftLoading,
  showReceiveGoods,
  printLoading
}: {
  po: PoRow
  metrics?: { ordered: number; received: number }
  onView: () => void
  onPrint: () => void
  onReceiveGoods: () => void
  onEditDraft?: () => void
  editDraftLoading?: boolean
  showReceiveGoods: boolean
  printLoading?: boolean
}) {
  const pct = poProgress(metrics)
  return (
    <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
      <Box className='flex justify-between items-start'>
        <div>
          <Typography variant='subtitle2' fontWeight={700}>
            {po.orderNumber}
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            {(po.supplierId as any)?.name}
          </Typography>
        </div>
        <Chip size='small' label={po.status} {...statusChipSx(po.status)} />
      </Box>
      <LinearProgress variant='determinate' value={pct} sx={{ my: 1.5, height: 10, borderRadius: 999 }} />
      <Typography variant='caption' color='text.secondary'>
        Receipt {pct}% · Ordered {metrics?.ordered ?? '—'} / Received {metrics?.received ?? '—'}
      </Typography>
      <Box className='flex justify-between flex-wrap items-center gap-2 mt-4'>
        <Typography variant='caption'>{formatDate(po.createdAt)}</Typography>
        <Box className='flex items-center gap-0.5'>
          <Tooltip title='Print'>
            <span>
              <IconButton size='small' onClick={onPrint} aria-label='Print supplier order' disabled={printLoading}>
                {printLoading ? <CircularProgress size={18} thickness={5} /> : <i className='tabler-printer' />}
              </IconButton>
            </span>
          </Tooltip>
          {onEditDraft && (
            <Tooltip title='Edit draft'>
              <span>
                <IconButton size='small' onClick={onEditDraft} aria-label='Edit supplier order' disabled={editDraftLoading}>
                  {editDraftLoading ? <CircularProgress size={18} thickness={5} /> : <i className='tabler-edit' />}
                </IconButton>
              </span>
            </Tooltip>
          )}
          {showReceiveGoods && (
            <Tooltip title='Receive goods'>
              <IconButton size='small' onClick={onReceiveGoods} aria-label='Receive goods'>
                <i className='tabler-package-import' />
              </IconButton>
            </Tooltip>
          )}
          <Button size='small' onClick={onView}>
            View
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}

function MobileGrnCard({
  grn,
  onView,
  onPost,
  onPrint,
  onReceiveMore,
  onEditDraft,
  editDraftLoading,
  onSupplierInvoice,
  printLoading,
  showReceiveMore,
  canPostInvoice,
  canPost
}: {
  grn: GrnRow
  onView: () => void
  onPost: () => void
  onPrint: () => void
  onReceiveMore: () => void
  onEditDraft?: () => void
  editDraftLoading?: boolean
  onSupplierInvoice: () => void
  printLoading?: boolean
  showReceiveMore: boolean
  canPostInvoice: boolean
  canPost: boolean
}) {
  return (
    <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
      <Typography variant='subtitle2' fontWeight={700}>
        {grn.receiptNumber}
      </Typography>
      <Typography variant='caption' display='block' color='text.secondary'>
        Supplier order {(grn.purchaseOrderId as any)?.orderNumber || '—'}
      </Typography>
      <Chip size='small' className='mt-3' label={grn.status} {...statusChipSx(grn.status)} />
      <Box className='flex flex-wrap gap-2 items-center justify-end mt-3'>
        <Tooltip title='Print receipt'>
          <span>
            <IconButton size='small' onClick={onPrint} aria-label='Print receipt' disabled={printLoading}>
              {printLoading ? <CircularProgress size={18} thickness={5} /> : <i className='tabler-printer' />}
            </IconButton>
          </span>
        </Tooltip>
        {showReceiveMore && (
          <Tooltip title='Receive more (same order)'>
            <IconButton size='small' onClick={onReceiveMore} aria-label='Receive more goods'>
              <i className='tabler-package-import' />
            </IconButton>
          </Tooltip>
        )}
        {canPostInvoice && (
          <Tooltip
            title={
              grn.status !== 'POSTED'
                ? 'Post receipt first — invoice links posted receipts only'
                : 'Supplier invoice (optional)'
            }
          >
            <span>
              <IconButton
                size='small'
                onClick={onSupplierInvoice}
                aria-label='Supplier invoice for this receipt'
                disabled={grn.status !== 'POSTED'}
              >
                <i className='tabler-file-invoice' />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Button size='small' onClick={onView}>
          View
        </Button>
        {onEditDraft && grn.status === 'DRAFT' && (
          <Button size='small' variant='tonal' onClick={onEditDraft} disabled={editDraftLoading}>
            {editDraftLoading ? 'Opening…' : 'Edit draft'}
          </Button>
        )}
        {canPost && grn.status === 'DRAFT' && (
          <Button size='small' variant='contained' onClick={onPost}>
            Post receive
          </Button>
        )}
      </Box>
    </Paper>
  )
}

function MobileInvCard({ inv, onView }: { inv: InvRow; onView: () => void }) {
  return (
    <Paper variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
      <div className='flex justify-between'>
        <div>
          <Typography variant='subtitle2' fontWeight={700}>
            {inv.invoiceNumber}
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            {(inv.supplierId as any)?.name}
          </Typography>
        </div>
        <Chip label={inv.status} size='small' {...statusChipSx(inv.status)} />
      </div>
      <Typography variant='body2' className='mt-4'>
        {formatPKR(inv.totalAmount)}
      </Typography>
      <Button size='small' className='mt-5' fullWidth variant='tonal' onClick={onView}>
        View detail
      </Button>
    </Paper>
  )
}

export default ProcurementHubPage
