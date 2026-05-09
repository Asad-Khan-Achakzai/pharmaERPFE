'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Skeleton from '@mui/material/Skeleton'
import useMediaQuery from '@mui/material/useMediaQuery'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { showApiError } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { reportsService } from '@/services/reports.service'
import { ledgerService } from '@/services/ledger.service'
import { ordersService } from '@/services/orders.service'
import { collectionsService } from '@/services/collections.service'
import api from '@/services/api'
import { labelForReferenceType, lineStatusLabel } from '@/views/reports/pharmacyWorkspace/referenceLabels'

const formatPKR = (v: number | null | undefined) =>
  `₨ ${(Number(v) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const LEDGER_REF_OPTIONS = [
  '',
  'DELIVERY',
  'COLLECTION',
  'RETURN',
  'ORDER',
  'PAYMENT',
  'SETTLEMENT',
  'RETURN_CLEARING_ADJ',
  'ADJUSTMENT',
  'OPENING'
]

type Filters = {
  from: string
  to: string
  referenceType: string
  search: string
  docSearch: string
  minAmount: string
  maxAmount: string
  sortOrder: 'asc' | 'desc'
}

const defaultFilters = (): Filters => ({
  from: '',
  to: '',
  referenceType: '',
  search: '',
  docSearch: '',
  minAmount: '',
  maxAmount: '',
  sortOrder: 'asc'
})

function groupByMonthLabel(rows: any[], zoneHint: string) {
  const map = new Map<string, any[]>()
  for (const r of rows) {
    if (!r.date) continue
    const d = new Date(r.date)
    const key = d.toLocaleString('en-PK', { month: 'long', year: 'numeric', timeZone: zoneHint || undefined })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  const entries = [...map.entries()]
  entries.sort((a, b) => {
    const da = a[1][0]?.date ? new Date(a[1][0].date).getTime() : 0
    const db = b[1][0]?.date ? new Date(b[1][0].date).getTime() : 0
    return da - db
  })
  return entries
}

const PharmacyFinancialWorkspacePage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width:900px)')
  const { hasPermission } = useAuth()
  const canLedger = hasPermission('ledger.view')
  const canReports = hasPermission('reports.view')
  const canCollect = hasPermission('payments.create')

  const [workspace, setWorkspace] = useState<any>(null)
  const [wsLoad, setWsLoad] = useState(true)
  const [wsError, setWsError] = useState(false)

  const [formFilters, setFormFilters] = useState<Filters>(defaultFilters)
  const [applied, setApplied] = useState<Filters>(defaultFilters)
  const [lines, setLines] = useState<any[]>([])
  const [stmtLoading, setStmtLoading] = useState(false)
  const [stmtMeta, setStmtMeta] = useState<{
    openingBalance: number | null
    nextCursor: string | null
    hasMore: boolean
    total: number
  }>({ openingBalance: null, nextCursor: null, hasMore: false, total: 0 })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRow, setDrawerRow] = useState<any>(null)
  const [drawerBody, setDrawerBody] = useState<any>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [csvDownloading, setCsvDownloading] = useState(false)

  const loadWorkspace = useCallback(async () => {
    if (!canReports) return
    setWsLoad(true)
    setWsError(false)
    try {
      const res = await reportsService.pharmacyFinancialWorkspace(params.id)
      setWorkspace(res.data.data ?? null)
    } catch (e) {
      setWsError(true)
      showApiError(e, 'Failed to load workspace')
    } finally {
      setWsLoad(false)
    }
  }, [params.id, canReports])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const buildLedgerParams = useCallback(
    (cursor: string | null, limit: number) => {
      const p: Record<string, string> = {
        limit: String(limit),
        sortBy: 'date',
        sortOrder: applied.sortOrder,
        includeRunning: '1'
      }
      if (applied.from) p.from = applied.from
      if (applied.to) p.to = applied.to
      if (applied.referenceType) p.referenceType = applied.referenceType
      if (applied.search.trim()) p.search = applied.search.trim()
      if (applied.docSearch.trim()) p.docSearch = applied.docSearch.trim()
      if (applied.minAmount.trim()) p.minAmount = applied.minAmount.trim()
      if (applied.maxAmount.trim()) p.maxAmount = applied.maxAmount.trim()
      if (cursor) p.cursor = cursor
      return p
    },
    [applied]
  )

  const fetchBatch = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (!canLedger) return
      setStmtLoading(true)
      try {
        const p = buildLedgerParams(cursor, 40)
        const res = await ledgerService.getByPharmacy(params.id, p)
        const chunk = res.data.data || []
        const meta = res.data.meta || {}
        const pag = res.data.pagination || {}
        setStmtMeta({
          openingBalance: meta.openingBalance ?? null,
          nextCursor: meta.nextCursor || null,
          hasMore: Boolean(meta.hasMore),
          total: pag.total ?? 0
        })
        setLines(prev => (append ? [...prev, ...chunk] : chunk))
      } catch (e) {
        showApiError(e, 'Failed to load statement')
      } finally {
        setStmtLoading(false)
      }
    },
    [params.id, canLedger, buildLedgerParams]
  )

  useEffect(() => {
    if (!canLedger || !workspace) return
    setLines([])
    void fetchBatch(null, false)
  }, [canLedger, workspace, applied, fetchBatch])

  const onApply = () => {
    setApplied({ ...formFilters })
  }

  const onReset = () => {
    const z = defaultFilters()
    setFormFilters(z)
    setApplied(z)
  }

  const buildStatementPdfParams = (): Record<string, string> => {
    const q: Record<string, string> = {}
    if (applied.from) q.from = applied.from
    if (applied.to) q.to = applied.to
    if (applied.referenceType) q.referenceType = applied.referenceType
    if (applied.search) q.search = applied.search
    if (applied.docSearch) q.docSearch = applied.docSearch
    if (applied.minAmount) q.minAmount = applied.minAmount
    if (applied.maxAmount) q.maxAmount = applied.maxAmount
    return q
  }

  const downloadPdf = async () => {
    if (!canLedger || pdfDownloading) return
    setPdfDownloading(true)
    try {
      const res = await api.get(`/reports/financial/pharmacies/${params.id}/statement.pdf`, {
        params: buildStatementPdfParams(),
        responseType: 'blob'
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `pharmacy-statement-${params.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showApiError(e, 'Failed to download PDF')
    } finally {
      setPdfDownloading(false)
    }
  }

  const exportCsv = async () => {
    if (!canLedger || csvDownloading) return
    setCsvDownloading(true)
    try {
      await runExportCsv()
    } finally {
      setCsvDownloading(false)
    }
  }

  const runExportCsv = async () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const row = (cells: (string | number | null | undefined)[]) => cells.map(c => esc(c == null || c === '' ? '' : String(c))).join(',')

    let ws: any = null
    try {
      const wr = await reportsService.pharmacyFinancialWorkspace(params.id)
      ws = wr.data.data
    } catch {
      /* statement lines still export */
    }

    const base: Record<string, string> = {
      limit: '100',
      sortBy: 'date',
      sortOrder: 'asc',
      includeRunning: '1'
    }
    if (applied.from) base.from = applied.from
    if (applied.to) base.to = applied.to
    if (applied.referenceType) base.referenceType = applied.referenceType
    if (applied.search.trim()) base.search = applied.search.trim()
    if (applied.docSearch.trim()) base.docSearch = applied.docSearch.trim()
    if (applied.minAmount.trim()) base.minAmount = applied.minAmount.trim()
    if (applied.maxAmount.trim()) base.maxAmount = applied.maxAmount.trim()

    const all: any[] = []
    let openingBalance: number | null = null
    let page = 1
    try {
      while (page <= 500) {
        const res = await ledgerService.getByPharmacy(params.id, { ...base, page: String(page) })
        const chunk = res.data.data || []
        const meta = res.data.meta || {}
        if (page === 1 && meta.openingBalance != null) openingBalance = meta.openingBalance
        all.push(...chunk)
        if (chunk.length < 100) break
        page += 1
      }
    } catch (e) {
      showApiError(e, 'CSV export failed')
      return
    }

    let sumDr = 0
    let sumCr = 0
    for (const l of all) {
      const amt = Number(l.amount) || 0
      if (l.type === 'DEBIT') sumDr += amt
      else if (l.type === 'CREDIT') sumCr += amt
    }
    const lastBal = all.length && all[all.length - 1]?.runningBalance != null ? all[all.length - 1].runningBalance : ''

    const sections: string[] = []
    sections.push(row(['Pharmacy account statement (CSV)']))
    sections.push(row(['Generated (UTC)', new Date().toISOString()]))
    sections.push('')

    if (ws?.company) {
      sections.push(row(['Section', 'Company & pharmacy']))
      sections.push(row(['Company', ws.company.name || '']))
      const addr = [ws.company.address, ws.company.city, ws.company.state].filter(Boolean).join(', ')
      if (addr) sections.push(row(['Company address', addr]))
      if (ws.company.phone) sections.push(row(['Company phone', ws.company.phone]))
      if (ws.company.email) sections.push(row(['Company email', ws.company.email]))
    }
    if (ws?.pharmacy) {
      sections.push(row(['Pharmacy', ws.pharmacy.name || '']))
      sections.push(row(['Account code', ws.pharmacy.accountCode || '']))
      if (ws.pharmacy.territory?.name) sections.push(row(['Territory', ws.pharmacy.territory.name]))
      if (ws.pharmacy.assignedRep?.name) sections.push(row(['Primary rep', ws.pharmacy.assignedRep.name]))
      const paddr = [ws.pharmacy.address, ws.pharmacy.city].filter(Boolean).join(', ')
      if (paddr) sections.push(row(['Pharmacy address', paddr]))
      if (ws.pharmacy.phone) sections.push(row(['Pharmacy phone', ws.pharmacy.phone]))
    }

    sections.push('')
    sections.push(row(['KPIs (live — not limited by statement filters below)']))
    if (ws?.kpis) {
      const k = ws.kpis
      sections.push(row(['Current balance (receivable)', k.currentBalance]))
      sections.push(row(['Overdue (31+ days)', k.overdueBalance]))
      sections.push(row(['Credit limit', k.creditLimit ?? '']))
      sections.push(row(['Available credit', k.availableCredit ?? '']))
      sections.push(row(['This month sales (deliveries)', k.monthSales]))
      sections.push(row(['This month collections', k.monthCollections]))
      sections.push(row(['Avg payment days', k.averagePaymentDays ?? '']))
      sections.push(row(['Last collection amount', k.lastCollectionAmount ?? '']))
      sections.push(row(['Last activity date', k.lastActivityDate ? new Date(k.lastActivityDate).toISOString() : '']))
    }
    if (ws?.financial) {
      const f = ws.financial
      sections.push(row(['Last collection date', f.lastCollectionDate ? new Date(f.lastCollectionDate).toISOString() : '']))
      sections.push(row(['Last order date', f.lastOrderDate ? new Date(f.lastOrderDate).toISOString() : '']))
      sections.push(row(['Last order number', f.lastOrderNumber ?? '']))
    }
    if (ws?.netOutstanding != null) sections.push(row(['Net ledger (DR−CR)', ws.netOutstanding]))

    sections.push('')
    sections.push(row(['Aging (open delivery balances)']))
    sections.push(row(['Bucket', 'Amount']))
    for (const b of ws?.aging?.display || []) {
      sections.push(row([b.label, b.amount]))
    }

    sections.push('')
    sections.push(row(['Totals by type (global ledger)']))
    sections.push(row(['Type', 'Debit', 'Credit', 'Net']))
    for (const r of ws?.ledgerSummaryByType || []) {
      sections.push(row([labelForReferenceType(r.referenceType), r.debit, r.credit, r.net]))
    }

    sections.push('')
    sections.push(row(['Statement export summary (filters apply to detail lines)']))
    sections.push(row(['Opening balance (batch)', openingBalance ?? '']))
    sections.push(row(['Total debit (exported lines)', sumDr]))
    sections.push(row(['Total credit (exported lines)', sumCr]))
    sections.push(row(['Closing running balance (last line)', lastBal]))
    sections.push(row(['Line count exported', all.length]))

    sections.push('')
    sections.push(row(['Active statement filters']))
    sections.push(row(['From', applied.from || '']))
    sections.push(row(['To', applied.to || '']))
    sections.push(row(['Type', applied.referenceType ? labelForReferenceType(applied.referenceType) : '']))
    sections.push(row(['Description search', applied.search || '']))
    sections.push(row(['Document search', applied.docSearch || '']))
    sections.push(row(['Min amount', applied.minAmount || '']))
    sections.push(row(['Max amount', applied.maxAmount || '']))
    sections.push(row(['Sort', applied.sortOrder]))

    if (ws?.methodologyNote) {
      sections.push('')
      sections.push(row(['Methodology', ws.methodologyNote]))
    }

    sections.push('')
    sections.push(row(['Detail lines']))
    const header = ['Date', 'Type', 'Document', 'Description', 'Debit', 'Credit', 'Balance', 'Status']
    sections.push(header.map(h => esc(h)).join(','))
    for (const l of all) {
      sections.push(
        row([
          l.date ? new Date(l.date).toISOString() : '',
          labelForReferenceType(l.referenceType),
          l.enrich?.invoiceNumber || l.enrich?.collectionRef || l.enrich?.orderNumber || '',
          l.description || l.enrich?.primaryLabel || '',
          l.type === 'DEBIT' ? l.amount : '',
          l.type === 'CREDIT' ? l.amount : '',
          l.runningBalance ?? '',
          lineStatusLabel(l)
        ])
      )
    }

    const csv = '\uFEFF' + sections.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pharmacy-${params.id}-statement.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openDrawer = async (row: any) => {
    setDrawerRow(row)
    setDrawerBody(null)
    setDrawerOpen(true)
    setDrawerLoading(true)
    try {
      if (row.referenceType === 'COLLECTION' && row.referenceId) {
        const r = await collectionsService.getById(String(row.referenceId))
        setDrawerBody({ kind: 'collection', data: r.data.data })
      } else if (row.enrich?.orderId) {
        const r = await ordersService.getById(String(row.enrich.orderId))
        setDrawerBody({ kind: 'order', data: r.data.data })
      } else {
        setDrawerBody({ kind: 'none', data: null })
      }
    } catch {
      setDrawerBody({ kind: 'none', data: null })
    } finally {
      setDrawerLoading(false)
    }
  }

  const monthGroups = useMemo(() => groupByMonthLabel(lines, workspace?.company?.timeZone || ''), [lines, workspace])
  const kpisList = useMemo(() => {
    if (!workspace?.kpis) return []
    const k = workspace.kpis
    const d = (x: string | null | undefined) => (x ? new Date(x).toLocaleDateString('en-PK') : '—')
    return [
      { label: 'Current balance', value: formatPKR(k.currentBalance) },
      { label: 'Overdue balance', value: formatPKR(k.overdueBalance) },
      { label: 'Available credit', value: k.availableCredit != null ? formatPKR(k.availableCredit) : '—' },
      { label: 'This month sales', value: formatPKR(k.monthSales) },
      { label: 'This month collections', value: formatPKR(k.monthCollections) },
      { label: 'Avg. payment days', value: k.averagePaymentDays != null ? String(k.averagePaymentDays) : '—' },
      {
        label: 'Last collection amount',
        value: k.lastCollectionAmount != null ? formatPKR(k.lastCollectionAmount) : '—'
      },
      { label: 'Last activity', value: d(k.lastActivityDate) }
    ]
  }, [workspace])

  const agingTotal = Math.max(
    1,
    workspace?.aging?.display?.reduce((s: number, x: any) => s + (x.amount || 0), 0) || 0
  )

  const mobileFilterSummary = useMemo(() => {
    const bits: string[] = []
    if (applied.from) bits.push(`from ${applied.from}`)
    if (applied.to) bits.push(`to ${applied.to}`)
    if (applied.referenceType) bits.push(labelForReferenceType(applied.referenceType))
    if (applied.search.trim()) bits.push('search')
    if (applied.docSearch.trim()) bits.push('doc')
    if (applied.minAmount || applied.maxAmount) bits.push('amount')
    return bits.length ? bits.slice(0, 4).join(' · ') : 'No filters applied'
  }, [applied])

  const statementFilterInner = (
    <>
      <Stack direction='row' flexWrap='wrap' gap={2} alignItems='flex-end'>
        <CustomTextField
          label='From'
          type='date'
          value={formFilters.from}
          onChange={e => setFormFilters(s => ({ ...s, from: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
          size='small'
        />
        <CustomTextField
          label='To'
          type='date'
          value={formFilters.to}
          onChange={e => setFormFilters(s => ({ ...s, to: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
          size='small'
        />
        <CustomTextField
          select
          label='Type'
          value={formFilters.referenceType}
          onChange={e => setFormFilters(s => ({ ...s, referenceType: e.target.value }))}
          size='small'
          sx={{ minWidth: 160 }}
        >
          <MenuItem value=''>All</MenuItem>
          {LEDGER_REF_OPTIONS.filter(Boolean).map(rt => (
            <MenuItem key={rt} value={rt}>
              {labelForReferenceType(rt)}
            </MenuItem>
          ))}
        </CustomTextField>
        <CustomTextField
          label='Description'
          value={formFilters.search}
          onChange={e => setFormFilters(s => ({ ...s, search: e.target.value }))}
          size='small'
          sx={{ minWidth: 160 }}
        />
        <CustomTextField
          label='Doc #'
          value={formFilters.docSearch}
          onChange={e => setFormFilters(s => ({ ...s, docSearch: e.target.value }))}
          size='small'
          sx={{ minWidth: 120 }}
        />
        <CustomTextField
          label='Min amt'
          value={formFilters.minAmount}
          onChange={e => setFormFilters(s => ({ ...s, minAmount: e.target.value }))}
          size='small'
          sx={{ width: 100 }}
        />
        <CustomTextField
          label='Max amt'
          value={formFilters.maxAmount}
          onChange={e => setFormFilters(s => ({ ...s, maxAmount: e.target.value }))}
          size='small'
          sx={{ width: 100 }}
        />
        <CustomTextField
          select
          label='Sort'
          value={formFilters.sortOrder}
          onChange={e => setFormFilters(s => ({ ...s, sortOrder: e.target.value as 'asc' | 'desc' }))}
          size='small'
          sx={{ minWidth: 120 }}
        >
          <MenuItem value='asc'>Oldest first</MenuItem>
          <MenuItem value='desc'>Newest first</MenuItem>
        </CustomTextField>
        <Button variant='contained' size='small' onClick={onApply}>
          Apply
        </Button>
        <Button variant='text' size='small' onClick={onReset}>
          Reset
        </Button>
      </Stack>
      <Typography variant='caption' color='text.secondary' display='block' className='mt-2'>
        <strong>Filtered statement:</strong> {lines.length} loaded of {stmtMeta.total} matching rows · batch opening
        balance: {stmtMeta.openingBalance != null ? formatPKR(stmtMeta.openingBalance) : '—'}. Global outstanding and aging
        above follow live receivable position (not statement filters).
      </Typography>
    </>
  )

  if (!canReports) {
    return (
      <Container className='p-6'>
        <Typography>You do not have access to this workspace.</Typography>
      </Container>
    )
  }

  return (
    <Box className='min-bs-screen bg-actionHover'>
      <AppBar
        position='sticky'
        color='default'
        elevation={1}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          /** Sit below the layout navbar (fixed/sticky at top of viewport) */
          top: 'calc(var(--header-height) + 1rem)',
          zIndex: theme => theme.zIndex.appBar - 2
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: { xs: 1, md: 1 },
            py: { xs: 1, md: 1 },
            px: { xs: 2, md: 2 },
            minHeight: { xs: 'auto !important', md: 64 }
          }}
        >
          <Stack
            direction='row'
            alignItems='center'
            spacing={1}
            sx={{ width: isMobile ? '100%' : 'auto', flex: isMobile ? undefined : 1, minWidth: 0 }}
          >
            <Button variant='text' size='small' onClick={() => router.push('/reports')} sx={{ flexShrink: 0 }}>
              ← Reports
            </Button>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant='subtitle1' noWrap fontWeight={700}>
                {workspace?.pharmacy?.name || 'Pharmacy'}
              </Typography>
              <Typography variant='caption' color='text.secondary' noWrap display='block'>
                {workspace?.pharmacy?.accountCode}
                {workspace?.pharmacy?.territory?.name ? ` · ${workspace.pharmacy.territory.name}` : ''}
              </Typography>
            </Box>
          </Stack>

          {isMobile ? (
            <Accordion
              expanded={mobileActionsOpen}
              onChange={(_, expanded) => setMobileActionsOpen(expanded)}
              disableGutters
              elevation={0}
              sx={{
                width: '100%',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary
                expandIcon={<i className='tabler-chevron-down text-xl' />}
                sx={{
                  minHeight: 48,
                  px: 1.5,
                  '& .MuiAccordionSummary-content': { my: 1 }
                }}
              >
                <Box sx={{ pr: 1 }}>
                  <Typography variant='subtitle2'>Quick actions</Typography>
                  <Typography variant='caption' color='text.secondary' display='block'>
                    {mobileActionsOpen ? 'Tap to collapse' : 'Collections, orders, PDF, CSV'}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 2 }}>
                <Stack spacing={1}>
                  {canCollect && (
                    <Button
                      fullWidth
                      size='small'
                      variant='contained'
                      href={`/payments/add?pharmacyId=${params.id}`}
                      sx={{ minHeight: 44 }}
                    >
                      Add collection
                    </Button>
                  )}
                  <Button
                    fullWidth
                    size='small'
                    variant='outlined'
                    component={Link}
                    href={`/orders/list?pharmacyId=${params.id}`}
                    sx={{ minHeight: 44 }}
                  >
                    Open orders
                  </Button>
                  <Button
                    fullWidth
                    size='small'
                    variant='outlined'
                    component={Link}
                    href={`/orders/list?pharmacyId=${params.id}&status=RETURNS`}
                    sx={{ minHeight: 44 }}
                  >
                    Returns
                  </Button>
                  <Tooltip title='Download PDF. Open the file and use your viewer’s Print for a hard copy.'>
                    <Box component='span' sx={{ display: 'block', width: '100%' }}>
                      <Button
                        fullWidth
                        size='small'
                        variant='outlined'
                        onClick={() => void downloadPdf()}
                        disabled={!canLedger || pdfDownloading}
                        startIcon={pdfDownloading ? <CircularProgress size={16} color='inherit' /> : undefined}
                        sx={{ minHeight: 44 }}
                      >
                        {pdfDownloading ? 'Preparing PDF…' : 'Statement PDF'}
                      </Button>
                    </Box>
                  </Tooltip>
                  <Button
                    fullWidth
                    size='small'
                    variant='outlined'
                    onClick={() => void exportCsv()}
                    disabled={!canLedger || csvDownloading}
                    startIcon={csvDownloading ? <CircularProgress size={16} color='inherit' /> : undefined}
                    sx={{ minHeight: 44 }}
                  >
                    {csvDownloading ? 'Preparing CSV…' : 'Download CSV'}
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ) : (
            <Stack
              direction='row'
              spacing={1}
              useFlexGap
              flexWrap='wrap'
              sx={{ justifyContent: 'flex-end', alignItems: 'center' }}
            >
              {canCollect && (
                <Button
                  size='small'
                  variant='contained'
                  href={`/payments/add?pharmacyId=${params.id}`}
                  sx={{ minHeight: 40 }}
                >
                  Add collection
                </Button>
              )}
              <Button size='small' variant='outlined' component={Link} href={`/orders/list?pharmacyId=${params.id}`} sx={{ minHeight: 40 }}>
                Open orders
              </Button>
              <Button
                size='small'
                variant='outlined'
                component={Link}
                href={`/orders/list?pharmacyId=${params.id}&status=RETURNS`}
                sx={{ minHeight: 40 }}
              >
                Returns
              </Button>
              <Tooltip title='Download PDF. Open the file and use your viewer’s Print for a hard copy.'>
                <Box component='span' sx={{ display: 'inline-block' }}>
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => void downloadPdf()}
                    disabled={!canLedger || pdfDownloading}
                    startIcon={pdfDownloading ? <CircularProgress size={16} color='inherit' /> : undefined}
                    sx={{ minHeight: 40 }}
                  >
                    {pdfDownloading ? 'Preparing PDF…' : 'Statement PDF'}
                  </Button>
                </Box>
              </Tooltip>
              <Button
                size='small'
                variant='outlined'
                onClick={() => void exportCsv()}
                disabled={!canLedger || csvDownloading}
                startIcon={csvDownloading ? <CircularProgress size={16} color='inherit' /> : undefined}
                sx={{ minHeight: 40 }}
              >
                {csvDownloading ? 'Preparing CSV…' : 'Download CSV'}
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth='xl' className='py-4 flex flex-col gap-4'>
        {wsError ? (
          <Alert severity='error' action={<Button onClick={() => void loadWorkspace()}>Retry</Button>}>
            Could not load workspace.
          </Alert>
        ) : null}

        {wsLoad ? (
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map(i => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                <Skeleton variant='rounded' height={100} />
              </Grid>
            ))}
          </Grid>
        ) : !workspace ? (
          <Alert severity='warning'>No pharmacy found for this account.</Alert>
        ) : (
          <>
            <Alert severity='info' icon={false}>
              {workspace.uiHints?.statementLinesAreFiltered}
            </Alert>

            <Paper variant='outlined' className='p-4'>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Typography variant='overline' color='text.secondary'>
                    Account
                  </Typography>
                  <Typography variant='h6'>{workspace.pharmacy.name}</Typography>
                  <Stack direction='row' flexWrap='wrap' gap={1} className='mt-2'>
                    {workspace.badges?.map((b: any) => (
                      <Chip
                        key={b.key}
                        size='small'
                        label={b.label}
                        color={b.severity === 'error' ? 'error' : b.severity === 'success' ? 'success' : 'default'}
                        variant={b.severity === 'success' ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Stack>
                  <Stack spacing={0.5} className='mt-2'>
                    <Typography variant='body2'>
                      <strong>Outstanding:</strong> {formatPKR(workspace.financial?.currentOutstanding)} ·{' '}
                      <strong>Overdue (31+ days):</strong> {formatPKR(workspace.financial?.overdueAmount)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {(() => {
                        const lim = workspace.financial?.creditLimit ?? workspace.kpis?.creditLimit
                        const avail = workspace.financial?.availableCredit ?? workspace.kpis?.availableCredit
                        const creditBits =
                          lim == null && avail == null
                            ? 'Credit limit / available credit: not configured (—)'
                            : `Credit limit: ${lim != null ? formatPKR(lim) : '—'} · Available: ${avail != null ? formatPKR(avail) : '—'}`
                        return (
                          <>
                            {creditBits}
                            {' · '}
                            Last collection:{' '}
                            {workspace.financial?.lastCollectionDate
                              ? new Date(workspace.financial.lastCollectionDate).toLocaleDateString('en-PK')
                              : '—'}{' '}
                            {workspace.financial?.lastCollectionAmount != null
                              ? `(${formatPKR(workspace.financial.lastCollectionAmount)})`
                              : ''}
                            {' · '}
                            Last order:{' '}
                            {workspace.financial?.lastOrderDate
                              ? new Date(workspace.financial.lastOrderDate).toLocaleDateString('en-PK')
                              : '—'}
                            {workspace.financial?.lastOrderNumber ? ` (${workspace.financial.lastOrderNumber})` : ''}
                          </>
                        )
                      })()}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Rep: {workspace.pharmacy.assignedRep?.name || '—'} · City: {workspace.pharmacy.city || '—'} ·
                      Phone: {workspace.pharmacy.phone || '—'}
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant='overline' color='text.secondary'>
                    Net (ledger)
                  </Typography>
                  <Typography variant='h5' className='text-primary'>
                    {formatPKR(workspace.netOutstanding)}
                  </Typography>
                  <Typography variant='caption' display='block' color='text.secondary' className='mt-1'>
                    Same figure as receivable ledger (DR−CR). Uses live data, independent of statement filters.
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Typography variant='subtitle2' className='text-textSecondary'>
              KPIs — {new Date().toLocaleString('en-PK', { month: 'long', year: 'numeric' })}
            </Typography>
            <Grid container spacing={2}>
              {kpisList.map((x, i) => (
                <Grid key={x.label + i} size={{ xs: 6, sm: 4, md: 3 }}>
                  <Card variant='outlined' className='h-full'>
                    <CardContent className='p-3'>
                      <Typography variant='caption' color='text.secondary' display='block'>
                        {x.label}
                      </Typography>
                      <Typography variant='h6' className='leading-tight'>
                        {x.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Card variant='outlined'>
              <CardContent>
                <Typography variant='subtitle1' gutterBottom>
                  Receivable aging (open balance by days since delivery)
                </Typography>
                <Stack spacing={1} className='mt-2'>
                  {(workspace.aging?.display || []).map((b: any) => (
                    <Box key={b.key}>
                      <Stack direction='row' justifyContent='space-between'>
                        <Typography variant='body2'>{b.label}</Typography>
                        <Typography variant='body2' fontWeight={600}>
                          {formatPKR(b.amount)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant='determinate'
                        value={Math.min(100, ((b.amount || 0) / agingTotal) * 100)}
                        sx={{ height: 8, borderRadius: 1, mt: 0.5 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {workspace.ledgerSummaryByType?.length ? (
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle1' gutterBottom>
                    Totals by category (global)
                  </Typography>
                  <TableContainer>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell align='right'>Debit</TableCell>
                          <TableCell align='right'>Credit</TableCell>
                          <TableCell align='right'>Net</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workspace.ledgerSummaryByType.map((r: any) => (
                          <TableRow key={r.referenceType}>
                            <TableCell>{labelForReferenceType(r.referenceType)}</TableCell>
                            <TableCell align='right'>{formatPKR(r.debit)}</TableCell>
                            <TableCell align='right'>{formatPKR(r.credit)}</TableCell>
                            <TableCell align='right'>{formatPKR(r.net)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}

        {!workspace ? null : canLedger ? (
          <>
            {isMobile ? (
              <Accordion
                expanded={mobileFiltersOpen}
                onChange={(_, expanded) => setMobileFiltersOpen(expanded)}
                disableGutters
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  '&:before': { display: 'none' }
                }}
              >
                <AccordionSummary
                  expandIcon={<i className='tabler-chevron-down text-xl' />}
                  sx={{
                    minHeight: 52,
                    px: 2,
                    '& .MuiAccordionSummary-content': { my: 1, overflow: 'hidden' }
                  }}
                >
                  <Box sx={{ pr: 1, minWidth: 0 }}>
                    <Typography variant='subtitle2'>Statement filters</Typography>
                    <Typography variant='caption' color='text.secondary' display='block' noWrap={!mobileFiltersOpen}>
                      {mobileFiltersOpen ? 'Adjust fields, then Apply' : mobileFilterSummary}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>{statementFilterInner}</AccordionDetails>
              </Accordion>
            ) : (
              <Paper
                variant='outlined'
                className='p-3'
                sx={{
                  position: 'sticky',
                  top: 'calc(var(--header-height) + 1rem + 4.25rem)',
                  zIndex: theme => theme.zIndex.appBar - 3,
                  bgcolor: 'background.paper'
                }}
              >
                <Typography variant='subtitle2' className='mbe-3'>
                  Statement filters
                </Typography>
                {statementFilterInner}
              </Paper>
            )}

            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Account statement
                </Typography>
                {stmtLoading && !lines.length ? (
                  <CircularProgress size={28} />
                ) : lines.length === 0 ? (
                  <Typography color='text.secondary'>No lines for this filter.</Typography>
                ) : (
                  monthGroups.map(([month, group]) => (
                    <Box key={month} className='mbe-4'>
                      <Typography variant='subtitle1' className='mbe-2 font-semibold'>
                        {month}
                      </Typography>
                      <Divider className='mbe-2' />
                      <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <Table size='small'>
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Document</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell align='right'>Debit</TableCell>
                              <TableCell align='right'>Credit</TableCell>
                              <TableCell align='right'>Balance</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {group.map(row => {
                              const debit = row.type === 'DEBIT' ? row.amount : 0
                              const credit = row.type === 'CREDIT' ? row.amount : 0
                              const doc =
                                row.enrich?.invoiceNumber ||
                                row.enrich?.collectionRef ||
                                row.enrich?.orderNumber ||
                                '—'
                              return (
                                <TableRow
                                  key={row._id}
                                  hover
                                  sx={{ cursor: 'pointer' }}
                                  onClick={() => void openDrawer(row)}
                                >
                                  <TableCell>
                                    {row.date
                                      ? new Date(row.date).toLocaleString('en-PK', {
                                          dateStyle: 'medium',
                                          timeStyle: 'short'
                                        })
                                      : '—'}
                                  </TableCell>
                                  <TableCell>{doc}</TableCell>
                                  <TableCell>{labelForReferenceType(row.referenceType)}</TableCell>
                                  <TableCell>
                                    {row.description || row.enrich?.primaryLabel || '—'}
                                  </TableCell>
                                  <TableCell align='right'>{debit ? formatPKR(debit) : '—'}</TableCell>
                                  <TableCell align='right'>{credit ? formatPKR(credit) : '—'}</TableCell>
                                  <TableCell align='right'>
                                    {row.runningBalance != null ? formatPKR(row.runningBalance) : '—'}
                                  </TableCell>
                                  <TableCell>{lineStatusLabel(row)}</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))
                )}
                {stmtMeta.hasMore ? (
                  <Button
                    variant='outlined'
                    className='mt-3'
                    disabled={stmtLoading}
                    onClick={() => void fetchBatch(stmtMeta.nextCursor, true)}
                    startIcon={stmtLoading ? <CircularProgress size={18} /> : undefined}
                  >
                    Load more
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : (
          <Alert severity='warning'>
            You have reports access but not ledger line access. Upgrade to <strong>ledger.view</strong> for the
            statement.
          </Alert>
        )}
      </Container>

      <Drawer anchor='right' open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Stack direction='row' justifyContent='space-between' alignItems='center'>
            <Typography variant='h6'>Transaction</Typography>
            <IconButton size='small' onClick={() => setDrawerOpen(false)}>
              <i className='tabler-x' />
            </IconButton>
          </Stack>
          <Divider className='my-2' />
          {drawerRow ? (
            <Stack spacing={0.5} className='mb-3'>
              <Typography variant='caption' color='text.secondary'>
                {drawerRow.date
                  ? new Date(drawerRow.date).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
                  : ''}{' '}
                · {labelForReferenceType(drawerRow.referenceType)}
              </Typography>
              <Typography variant='body2'>
                {drawerRow.description || drawerRow.enrich?.primaryLabel || '—'}
              </Typography>
              <Typography variant='caption'>
                {drawerRow.type === 'DEBIT' ? `Debit ${formatPKR(drawerRow.amount)}` : `Credit ${formatPKR(drawerRow.amount)}`}
                {drawerRow.runningBalance != null ? ` · Balance ${formatPKR(drawerRow.runningBalance)}` : ''}
              </Typography>
            </Stack>
          ) : null}
          {drawerLoading ? (
            <CircularProgress size={24} />
          ) : drawerBody?.kind === 'order' ? (
            <Stack spacing={1}>
              <Typography variant='subtitle2'>Order {drawerBody.data?.orderNumber}</Typography>
              <Typography variant='body2'>Status: {drawerBody.data?.status}</Typography>
              <Button component={Link} href={`/orders/${drawerBody.data?._id}`} variant='contained' size='small'>
                Open full order
              </Button>
            </Stack>
          ) : drawerBody?.kind === 'collection' ? (
            <Stack spacing={1}>
              <Typography variant='subtitle2'>Collection</Typography>
              <Typography variant='body2'>Amount: {formatPKR(drawerBody.data?.amount)}</Typography>
              <Typography variant='caption'>{drawerBody.data?.referenceNumber}</Typography>
              <Button component={Link} href='/payments/list' variant='outlined' size='small'>
                Go to payments list
              </Button>
            </Stack>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              No linked document for drill-down.
            </Typography>
          )}
        </Box>
      </Drawer>
    </Box>
  )
}

export default PharmacyFinancialWorkspacePage
