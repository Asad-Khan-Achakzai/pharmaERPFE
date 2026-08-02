'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import MuiLink from '@mui/material/Link'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { taxService, type TaxRegisterKpis } from '@/services/tax.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import {
  calculationBaseLabel,
  formatDate,
  formatMoney,
  REGISTER_STATUS_COLORS,
  registerStatusLabel,
  taxTypeLabel
} from './taxUiLabels'

const emptyKpis: TaxRegisterKpis = {
  totalTaxCollected: 0,
  outstandingLiability: 0,
  taxDeposited: 0,
  pendingTaxEntries: 0,
  invoicesWithTax: 0,
  currentTaxPeriod: '—',
  reconciliation: {
    glBalance: 0,
    registerBalance: 0,
    difference: 0,
    outOfBalance: false
  }
}

const KpiCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card variant='outlined' sx={{ height: '100%' }}>
    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
      <Typography variant='caption' color='text.secondary' display='block'>
        {label}
      </Typography>
      <Typography variant='h6' fontWeight={700} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant='caption' color='text.secondary'>
          {sub}
        </Typography>
      ) : null}
    </CardContent>
  </Card>
)

const TaxRegisterPage = () => {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [kpis, setKpis] = useState<TaxRegisterKpis>(emptyKpis)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    taxTypeCode: '',
    taxSection: '',
    status: '',
    invoiceNumber: '',
    depositNumber: '',
    search: ''
  })

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {}
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v
    })
    return p
  }, [filters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await taxService.registerReport(queryParams)
      setRows(reg.data.data?.rows || [])
      setKpis(reg.data.data?.kpis || emptyKpis)
    } catch (err) {
      showApiError(err, 'Failed to load tax register')
    } finally {
      setLoading(false)
    }
  }, [queryParams])

  useEffect(() => {
    void load()
  }, [load])

  const recon = kpis.reconciliation

  const exportExcel = async () => {
    try {
      await taxService.exportRegister({ ...queryParams, format: 'xlsx' })
      showSuccess('Excel download started')
    } catch (err) {
      showApiError(err, 'Export failed')
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={2}>
        <Box>
          <Typography variant='h5' fontWeight={700}>
            Tax Register
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Monitor invoice tax, liability, and remittance status for the finance team.
          </Typography>
        </Box>
        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
          <Button size='small' variant='outlined' onClick={() => void exportExcel()}>
            Export Excel
          </Button>
          <Button size='small' component={Link} href='/finance/tax/remittances' variant='contained'>
            Tax Remittances
          </Button>
        </Stack>
      </Stack>

      <Box>
        <Typography variant='subtitle2' sx={{ mb: 1.5 }} color='text.secondary'>
          Tax Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <KpiCard label='Total Tax Collected' value={formatMoney(kpis.totalTaxCollected)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <KpiCard label='Outstanding Liability' value={formatMoney(kpis.outstandingLiability)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <KpiCard label='Tax Remitted' value={formatMoney(kpis.taxDeposited)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <KpiCard label='Pending Tax Entries' value={String(kpis.pendingTaxEntries)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <KpiCard label='Invoices With Tax' value={String(kpis.invoicesWithTax)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <KpiCard label='Current Tax Period' value={kpis.currentTaxPeriod || '—'} />
          </Grid>
        </Grid>
      </Box>

      <Card variant='outlined'>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            justifyContent='space-between'
            alignItems={{ md: 'center' }}
          >
            <Box>
              <Typography variant='caption' color='text.secondary'>
                GL Balance
              </Typography>
              <Typography fontWeight={600}>{formatMoney(recon.glBalance)}</Typography>
            </Box>
            <Box>
              <Typography variant='caption' color='text.secondary'>
                Register Balance
              </Typography>
              <Typography fontWeight={600}>{formatMoney(recon.registerBalance)}</Typography>
            </Box>
            <Box>
              <Typography variant='caption' color='text.secondary'>
                Difference
              </Typography>
              <Typography
                fontWeight={700}
                color={recon.outOfBalance ? 'error.main' : 'success.main'}
              >
                {formatMoney(recon.difference)}
              </Typography>
            </Box>
          </Stack>
          {recon.outOfBalance ? (
            <Alert severity='warning' sx={{ mt: 2 }}>
              Tax Register and GL are out of balance. Review posting and remittances before month-end
              close.
            </Alert>
          ) : (
            <Alert severity='success' sx={{ mt: 2 }}>
              Register and GL are in balance (within rounding tolerance).
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title='Filters' />
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                type='date'
                label='From'
                InputLabelProps={{ shrink: true }}
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                type='date'
                label='To'
                InputLabelProps={{ shrink: true }}
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size='small'
                label='Tax Type'
                value={filters.taxTypeCode}
                onChange={e => setFilters(f => ({ ...f, taxTypeCode: e.target.value }))}
              >
                <MenuItem value=''>All</MenuItem>
                <MenuItem value='ADVANCE_TAX_236H'>Advance Tax (236H)</MenuItem>
                <MenuItem value='GST'>GST</MenuItem>
                <MenuItem value='VAT'>VAT</MenuItem>
                <MenuItem value='WHT'>Withholding Tax</MenuItem>
                <MenuItem value='ENVIRONMENTAL'>Environmental Tax</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size='small'
                label='Status'
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              >
                <MenuItem value=''>All</MenuItem>
                <MenuItem value='OPEN'>Open</MenuItem>
                <MenuItem value='INCLUDED_IN_DEPOSIT'>Included in Deposit</MenuItem>
                <MenuItem value='REMITTED'>Remitted</MenuItem>
                <MenuItem value='Reversed'>Reversed</MenuItem>
                <MenuItem value='ADJUSTED'>Adjusted</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                label='Tax Section'
                value={filters.taxSection}
                onChange={e => setFilters(f => ({ ...f, taxSection: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                label='Invoice Number'
                value={filters.invoiceNumber}
                onChange={e => setFilters(f => ({ ...f, invoiceNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                label='Deposit Number'
                value={filters.depositNumber}
                onChange={e => setFilters(f => ({ ...f, depositNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                label='Search'
                placeholder='Invoice, pharmacy, section…'
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title='Register Entries' subheader={`${rows.length} row(s) loaded`} />
        <CardContent sx={{ overflowX: 'auto' }}>
          {loading ? (
            <CircularProgress size={28} />
          ) : (
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Pharmacy</TableCell>
                  <TableCell>Tax Type</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Rate</TableCell>
                  <TableCell>Base</TableCell>
                  <TableCell align='right'>Taxable</TableCell>
                  <TableCell align='right'>Tax</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Deposit</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r: any) => {
                  const orderId = r.orderId || r.meta?.orderId
                  const pharmacyId = r.pharmacyRefId
                  const pharmacyName = r.pharmacyName
                  const statusKey = r.statusNormalized || r.status
                  const isOpen = expanded === r._id

                  return (
                    <Fragment key={r._id}>
                      <TableRow hover>
                        <TableCell>{formatDate(r.businessDate)}</TableCell>
                        <TableCell>
                          {orderId && r.invoiceNumber ? (
                            <MuiLink
                              component={Link}
                              href={`/orders/${orderId}`}
                              underline='hover'
                              fontWeight={600}
                            >
                              {r.invoiceNumber}
                            </MuiLink>
                          ) : (
                            r.invoiceNumber || '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {pharmacyId && pharmacyName ? (
                            <MuiLink
                              component={Link}
                              href={`/pharmacies/list?view=${pharmacyId}`}
                              underline='hover'
                              fontWeight={600}
                            >
                              {pharmacyName}
                            </MuiLink>
                          ) : (
                            pharmacyName || '—'
                          )}
                        </TableCell>
                        <TableCell>{r.taxTypeLabel || taxTypeLabel(r.taxTypeCode)}</TableCell>
                        <TableCell>{r.taxSection || '—'}</TableCell>
                        <TableCell>
                          {r.ratePercent != null ? `${r.ratePercent}%` : '—'}
                        </TableCell>
                        <TableCell>
                          {r.calculationBaseLabel || calculationBaseLabel(r.calculationBase)}
                        </TableCell>
                        <TableCell align='right'>{formatMoney(r.taxableAmount || 0)}</TableCell>
                        <TableCell align='right'>{formatMoney(r.taxAmount || 0)}</TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={r.statusLabel || registerStatusLabel(statusKey)}
                            color={REGISTER_STATUS_COLORS[statusKey] || 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {r.depositId && r.depositNumber ? (
                            <MuiLink
                              component={Link}
                              href={`/finance/tax/remittances?id=${r.depositId}`}
                              underline='hover'
                              fontWeight={600}
                            >
                              {r.depositNumber}
                            </MuiLink>
                          ) : (
                            r.depositNumber || '—'
                          )}
                        </TableCell>
                        <TableCell>{r.createdByName || 'System'}</TableCell>
                        <TableCell align='right'>
                          <Tooltip title='Details'>
                            <IconButton
                              size='small'
                              onClick={() => setExpanded(isOpen ? null : r._id)}
                            >
                              <i className={isOpen ? 'tabler-chevron-up' : 'tabler-chevron-down'} />
                            </IconButton>
                          </Tooltip>
                          {orderId ? (
                            <Tooltip title='View Invoice'>
                              <IconButton
                                size='small'
                                component={Link}
                                href={`/orders/${orderId}`}
                              >
                                <i className='tabler-file-invoice' />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          {r.depositId ? (
                            <Tooltip title='View Deposit'>
                              <IconButton
                                size='small'
                                component={Link}
                                href={`/finance/tax/remittances?id=${r.depositId}`}
                              >
                                <i className='tabler-building-bank' />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={13} sx={{ py: 0, border: 0 }}>
                          <Collapse in={isOpen}>
                            <Box sx={{ py: 1.5, px: 2, bgcolor: 'action.hover' }}>
                              <Typography variant='body2'>
                                Entry: {r.entryTypeLabel || r.entryType}
                                {r.meta?.narration ? ` · ${r.meta.narration}` : ''}
                              </Typography>
                              {r.depositDate ? (
                                <Typography variant='body2'>
                                  Deposit date: {formatDate(r.depositDate)}
                                </Typography>
                              ) : null}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={13}>
                      <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Typography variant='subtitle1' fontWeight={600}>
                          No tax register entries for this period
                        </Typography>
                        <Typography color='text.secondary' sx={{ mt: 1, mb: 2 }}>
                          Deliveries with taxation enabled will appear here after posting. Configure
                          rules under Tax Configuration, then deliver an order.
                        </Typography>
                        <Button component={Link} href='/finance/tax' variant='outlined' size='small'>
                          Open Tax Configuration
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default TaxRegisterPage
