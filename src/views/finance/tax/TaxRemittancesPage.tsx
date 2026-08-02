'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import MuiLink from '@mui/material/Link'
import { MoneyAccountSelect } from '@/components/finance/MoneyAccountSelect'
import { taxService, type TaxDeposit } from '@/services/tax.service'
import { mediaService } from '@/services/media.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { toast } from 'react-toastify'
import {
  DEPOSIT_STATUS_COLORS,
  depositStatusLabel,
  formatDate,
  formatMoney,
  taxTypeLabel
} from './taxUiLabels'

const RECEIPT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/jpg'
const RECEIPT_MAX = 10 * 1024 * 1024

const TaxRemittancesPage = () => {
  const searchParams = useSearchParams()
  const focusId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<TaxDeposit[]>([])
  const [selected, setSelected] = useState<TaxDeposit | null>(null)
  const [openEntries, setOpenEntries] = useState<any[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [form, setForm] = useState({
    governmentAuthority: 'FBR',
    taxPeriodFrom: '',
    taxPeriodTo: '',
    paymentDate: '',
    paymentReference: '',
    bankReference: '',
    moneyAccountId: '',
    notes: ''
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await taxService.listDeposits()
      setRows(res.data.data?.rows || [])
    } catch (err) {
      showApiError(err, 'Failed to load tax remittances')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await taxService.getDeposit(id)
      setSelected(res.data.data)
      const moneyId =
        typeof res.data.data.moneyAccountId === 'object'
          ? res.data.data.moneyAccountId?._id || ''
          : res.data.data.moneyAccountId || ''
      setForm(f => ({
        ...f,
        governmentAuthority: res.data.data.governmentAuthority || 'FBR',
        paymentReference: res.data.data.paymentReference || '',
        bankReference: res.data.data.bankReference || '',
        notes: res.data.data.notes || '',
        moneyAccountId: moneyId,
        paymentDate: res.data.data.paymentDate
          ? String(res.data.data.paymentDate).slice(0, 10)
          : '',
        taxPeriodFrom: res.data.data.taxPeriodFrom
          ? String(res.data.data.taxPeriodFrom).slice(0, 10)
          : '',
        taxPeriodTo: res.data.data.taxPeriodTo
          ? String(res.data.data.taxPeriodTo).slice(0, 10)
          : ''
      }))
    } catch (err) {
      showApiError(err, 'Failed to load remittance')
    }
  }, [])

  const loadOpenEntries = useCallback(async () => {
    try {
      const res = await taxService.listOpenEntries()
      const list = res.data.data?.rows || []
      setOpenEntries(list)
      // Auto-select all eligible OPEN entries
      setPicked(list.map((e: any) => String(e._id)))
    } catch {
      setOpenEntries([])
      setPicked([])
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (focusId) void loadDetail(focusId)
  }, [focusId, loadDetail])

  const openCreate = async () => {
    setCreateOpen(true)
    await loadOpenEntries()
  }

  const pickedRows = useMemo(
    () => openEntries.filter(e => picked.includes(String(e._id))),
    [openEntries, picked]
  )
  const pickedTotal = useMemo(
    () => pickedRows.reduce((s, e) => s + (Number(e.taxAmount) || 0), 0),
    [pickedRows]
  )
  const invoiceCount = useMemo(() => {
    const set = new Set(
      pickedRows.map(e => e.invoiceNumber || e.deliveryId || e._id).filter(Boolean)
    )
    return set.size
  }, [pickedRows])

  const createRemittance = async () => {
    if (!picked.length || pickedTotal <= 0) {
      toast.error('Select eligible tax entries with a positive total')
      return
    }
    if (!form.moneyAccountId) {
      toast.error('Select the bank/cash account used for government payment')
      return
    }
    setBusy(true)
    try {
      const res = await taxService.createDeposit({
        governmentAuthority: form.governmentAuthority,
        taxPeriodFrom: form.taxPeriodFrom || null,
        taxPeriodTo: form.taxPeriodTo || null,
        paymentDate: form.paymentDate || null,
        paymentReference: form.paymentReference,
        bankReference: form.bankReference,
        moneyAccountId: form.moneyAccountId,
        notes: form.notes,
        registerEntryIds: picked,
        autoSelectAll: false
      })
      // One-step for finance: create draft then immediately submit
      const submitted = await taxService.submitDeposit(res.data.data._id, {
        moneyAccountId: form.moneyAccountId,
        paymentDate: form.paymentDate || undefined,
        paymentReference: form.paymentReference,
        bankReference: form.bankReference,
        governmentAuthority: form.governmentAuthority
      })
      showSuccess(`Remittance ${submitted.data.data.depositNumber} submitted`)
      setCreateOpen(false)
      await loadList()
      await loadDetail(submitted.data.data._id)
    } catch (err) {
      showApiError(err, 'Failed to submit remittance')
      await loadList()
    } finally {
      setBusy(false)
    }
  }

  const saveDraftOnly = async () => {
    if (!picked.length) {
      toast.error('Select at least one entry')
      return
    }
    setBusy(true)
    try {
      const res = await taxService.createDeposit({
        governmentAuthority: form.governmentAuthority,
        taxPeriodFrom: form.taxPeriodFrom || null,
        taxPeriodTo: form.taxPeriodTo || null,
        paymentDate: form.paymentDate || null,
        paymentReference: form.paymentReference,
        bankReference: form.bankReference,
        moneyAccountId: form.moneyAccountId || null,
        notes: form.notes,
        registerEntryIds: picked,
        autoSelectAll: false
      })
      showSuccess(`Draft ${res.data.data.depositNumber} saved`)
      setCreateOpen(false)
      await loadList()
      await loadDetail(res.data.data._id)
    } catch (err) {
      showApiError(err, 'Failed to save draft')
    } finally {
      setBusy(false)
    }
  }

  const submitSelected = async () => {
    if (!selected) return
    if (!form.moneyAccountId) {
      toast.error('Select a bank/cash account')
      return
    }
    setBusy(true)
    try {
      await taxService.submitDeposit(selected._id, {
        moneyAccountId: form.moneyAccountId,
        paymentDate: form.paymentDate || undefined,
        paymentReference: form.paymentReference,
        bankReference: form.bankReference,
        governmentAuthority: form.governmentAuthority
      })
      showSuccess('Remittance submitted — accounting posted')
      await loadList()
      await loadDetail(selected._id)
    } catch (err) {
      showApiError(err, 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const uploadReceipt = async (file: File) => {
    if (!selected) return
    if (file.size > RECEIPT_MAX) {
      toast.error('File too large (max 10 MB)')
      return
    }
    setUploading(true)
    try {
      const { assetId } = await mediaService.upload(file, 'TAX_REMITTANCE_RECEIPT')
      await taxService.attachReceipt(selected._id, {
        mediaAssetId: assetId,
        fileName: file.name,
        mimeType: file.type
      })
      showSuccess('Receipt uploaded')
      await loadDetail(selected._id)
    } catch (err) {
      showApiError(err, 'Receipt upload failed')
    } finally {
      setUploading(false)
    }
  }

  const cancelSelected = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await taxService.cancelDeposit(selected._id, { reason: 'Cancelled by user' })
      showSuccess('Draft cancelled')
      setSelected(null)
      await loadList()
    } catch (err) {
      showApiError(err, 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const reverseSelected = async () => {
    if (!selected || reverseReason.trim().length < 3) {
      toast.error('Enter a reversal reason')
      return
    }
    setBusy(true)
    try {
      await taxService.reverseDeposit(selected._id, { reason: reverseReason.trim() })
      showSuccess('Remittance reversed — register entries reopened')
      setReverseOpen(false)
      setReverseReason('')
      await loadList()
      await loadDetail(selected._id)
    } catch (err) {
      showApiError(err, 'Reverse failed')
    } finally {
      setBusy(false)
    }
  }

  const togglePick = (id: string) => {
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const selectAll = () => setPicked(openEntries.map(e => String(e._id)))
  const clearAll = () => setPicked([])

  const statusLabel = (status: string) => {
    if (status === 'CLOSED') return 'Submitted'
    return depositStatusLabel(status)
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={2}>
        <Box>
          <Typography variant='h5' fontWeight={700}>
            Tax Remittances
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Pay government tax liability from open register entries. Draft → Submit. Receipt upload is
            optional.
          </Typography>
        </Box>
        <Stack direction='row' spacing={1}>
          <Button component={Link} href='/finance/tax/register' size='small' variant='outlined'>
            Tax Register
          </Button>
          <Button size='small' variant='contained' onClick={() => void openCreate()}>
            New Remittance
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: selected ? 5 : 12 }}>
          <Card>
            <CardHeader title='Remittance History' />
            <CardContent sx={{ overflowX: 'auto' }}>
              {loading ? (
                <CircularProgress size={28} />
              ) : (
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Number</TableCell>
                      <TableCell>Authority</TableCell>
                      <TableCell>Payment Date</TableCell>
                      <TableCell align='right'>Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow
                        key={r._id}
                        hover
                        selected={selected?._id === r._id}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => void loadDetail(r._id)}
                      >
                        <TableCell>
                          <Typography fontWeight={600}>{r.depositNumber}</Typography>
                        </TableCell>
                        <TableCell>{r.governmentAuthority || '—'}</TableCell>
                        <TableCell>{formatDate(r.paymentDate)}</TableCell>
                        <TableCell align='right'>{formatMoney(r.amount || 0)}</TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={statusLabel(r.status)}
                            color={
                              r.status === 'CLOSED'
                                ? 'success'
                                : DEPOSIT_STATUS_COLORS[r.status] || 'default'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography fontWeight={600}>No tax remittances yet</Typography>
                            <Typography color='text.secondary' sx={{ mt: 1 }}>
                              Create a remittance — all open tax entries are selected by default.
                              Review the total, choose the bank account, and submit.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        {selected ? (
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader
                title={selected.depositNumber}
                subheader={statusLabel(selected.status)}
                action={
                  <Button size='small' onClick={() => setSelected(null)}>
                    Close panel
                  </Button>
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  {selected.status === 'DRAFT' ? (
                    <Alert severity='info'>
                      Draft remittance — review linked entries, then Submit to post Dr Tax Liability /
                      Cr Bank. Cancel discards the draft.
                    </Alert>
                  ) : null}
                  {selected.status === 'SUBMITTED' || selected.status === 'CLOSED' ? (
                    <Alert severity='success'>
                      Remittance complete. Amounts and invoices are locked. You may upload a
                      government receipt later, or reverse if the payment was made in error.
                    </Alert>
                  ) : null}
                  {selected.status === 'REVERSED' ? (
                    <Alert severity='warning'>
                      Reversed{selected.reverseReason ? `: ${selected.reverseReason}` : ''}. Register
                      entries were reopened for the next remittance.
                    </Alert>
                  ) : null}

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size='small'
                        label='Government Authority'
                        value={form.governmentAuthority}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={e =>
                          setForm(f => ({ ...f, governmentAuthority: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size='small'
                        type='date'
                        label='Payment Date'
                        InputLabelProps={{ shrink: true }}
                        value={form.paymentDate}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size='small'
                        label='Payment Reference'
                        value={form.paymentReference}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={e =>
                          setForm(f => ({ ...f, paymentReference: e.target.value }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size='small'
                        label='Bank Reference'
                        value={form.bankReference}
                        disabled={selected.status !== 'DRAFT'}
                        onChange={e => setForm(f => ({ ...f, bankReference: e.target.value }))}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      {selected.status === 'DRAFT' ? (
                        <MoneyAccountSelect
                          label='Bank / Cash Account'
                          value={form.moneyAccountId}
                          onChange={id => setForm(f => ({ ...f, moneyAccountId: id }))}
                          required
                          showBalance
                        />
                      ) : (
                        <Typography variant='body2'>
                          Amount: <strong>{formatMoney(selected.amount || 0)}</strong>
                        </Typography>
                      )}
                    </Grid>
                  </Grid>

                  <Typography variant='subtitle2'>Linked register entries</Typography>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Invoice</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align='right'>Tax</TableCell>
                        {selected.status === 'DRAFT' ? <TableCell /> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(selected.entries || []).map((e: any) => (
                        <TableRow key={e._id}>
                          <TableCell>{formatDate(e.businessDate)}</TableCell>
                          <TableCell>{e.invoiceNumber || '—'}</TableCell>
                          <TableCell>{taxTypeLabel(e.taxTypeCode)}</TableCell>
                          <TableCell align='right'>{formatMoney(e.taxAmount || 0)}</TableCell>
                          {selected.status === 'DRAFT' ? (
                            <TableCell align='right'>
                              <Button
                                size='small'
                                color='error'
                                onClick={() =>
                                  void taxService
                                    .removeDepositEntry(selected._id, e._id)
                                    .then(() => loadDetail(selected._id))
                                    .catch(err => showApiError(err, 'Remove failed'))
                                }
                              >
                                Remove
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {(selected.status === 'SUBMITTED' ||
                    selected.status === 'CLOSED' ||
                    selected.status === 'DRAFT') && (
                    <Box>
                      <Typography variant='subtitle2' sx={{ mb: 1 }}>
                        Government receipt (optional)
                      </Typography>
                      {selected.receiptAttachment?.url || selected.receiptAttachment?.fileName ? (
                        <Typography variant='body2' sx={{ mb: 1 }}>
                          Attached:{' '}
                          {selected.receiptAttachment.url ? (
                            <MuiLink href={selected.receiptAttachment.url} target='_blank' rel='noreferrer'>
                              {selected.receiptAttachment.fileName || 'View receipt'}
                            </MuiLink>
                          ) : (
                            selected.receiptAttachment.fileName
                          )}
                        </Typography>
                      ) : (
                        <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                          Upload PDF or image, or take a photo on mobile. No URL paste.
                        </Typography>
                      )}
                      <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                        >
                          {uploading ? 'Uploading…' : 'Upload PDF / Image'}
                        </Button>
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={uploading}
                          onClick={() => cameraRef.current?.click()}
                        >
                          Take Photo
                        </Button>
                      </Stack>
                      <input
                        ref={fileRef}
                        type='file'
                        accept={RECEIPT_ACCEPT}
                        hidden
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) void uploadReceipt(f)
                          e.target.value = ''
                        }}
                      />
                      <input
                        ref={cameraRef}
                        type='file'
                        accept='image/jpeg,image/png'
                        capture='environment'
                        hidden
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) void uploadReceipt(f)
                          e.target.value = ''
                        }}
                      />
                    </Box>
                  )}

                  <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                    {selected.status === 'DRAFT' ? (
                      <>
                        <Button
                          variant='contained'
                          disabled={busy}
                          onClick={() => void submitSelected()}
                        >
                          Submit Remittance
                        </Button>
                        <Button color='inherit' disabled={busy} onClick={() => void cancelSelected()}>
                          Cancel Draft
                        </Button>
                      </>
                    ) : null}
                    {selected.status === 'SUBMITTED' || selected.status === 'CLOSED' ? (
                      <Button
                        color='warning'
                        variant='outlined'
                        disabled={busy}
                        onClick={() => setReverseOpen(true)}
                      >
                        Reverse Remittance
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ) : null}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth='md'>
        <DialogTitle>New Tax Remittance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity='info'>
              All eligible open tax register entries are selected. Deselect any you want to exclude,
              then submit payment.
            </Alert>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size='small'
                  label='Government Authority'
                  value={form.governmentAuthority}
                  onChange={e => setForm(f => ({ ...f, governmentAuthority: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <MoneyAccountSelect
                  label='Bank / Cash Account'
                  value={form.moneyAccountId}
                  onChange={id => setForm(f => ({ ...f, moneyAccountId: id }))}
                  required
                  showBalance
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  size='small'
                  type='date'
                  label='Period From'
                  InputLabelProps={{ shrink: true }}
                  value={form.taxPeriodFrom}
                  onChange={e => setForm(f => ({ ...f, taxPeriodFrom: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  size='small'
                  type='date'
                  label='Period To'
                  InputLabelProps={{ shrink: true }}
                  value={form.taxPeriodTo}
                  onChange={e => setForm(f => ({ ...f, taxPeriodTo: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size='small'
                  type='date'
                  label='Payment Date'
                  InputLabelProps={{ shrink: true }}
                  value={form.paymentDate}
                  onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size='small'
                  label='Payment Reference (challan / CPR)'
                  value={form.paymentReference}
                  onChange={e => setForm(f => ({ ...f, paymentReference: e.target.value }))}
                />
              </Grid>
            </Grid>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent='space-between'
              alignItems={{ sm: 'center' }}
              spacing={1}
            >
              <Box>
                <Typography variant='subtitle2'>
                  {invoiceCount} invoice(s) · {picked.length} line(s) selected
                </Typography>
                <Typography variant='h6' fontWeight={700}>
                  Total tax: {formatMoney(pickedTotal)}
                </Typography>
              </Box>
              <Stack direction='row' spacing={1}>
                <Button size='small' onClick={selectAll}>
                  Select All
                </Button>
                <Button size='small' onClick={clearAll}>
                  Clear All
                </Button>
              </Stack>
            </Stack>

            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox' />
                  <TableCell>Date</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Pharmacy</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align='right'>Tax</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {openEntries.map(e => {
                  const id = String(e._id)
                  return (
                    <TableRow key={id} hover onClick={() => togglePick(id)}>
                      <TableCell padding='checkbox'>
                        <Checkbox checked={picked.includes(id)} />
                      </TableCell>
                      <TableCell>{formatDate(e.businessDate)}</TableCell>
                      <TableCell>{e.invoiceNumber || '—'}</TableCell>
                      <TableCell>
                        {typeof e.pharmacyId === 'object' ? e.pharmacyId?.name : '—'}
                      </TableCell>
                      <TableCell>{taxTypeLabel(e.taxTypeCode)}</TableCell>
                      <TableCell align='right'>{formatMoney(e.taxAmount || 0)}</TableCell>
                    </TableRow>
                  )
                })}
                {!openEntries.length && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color='text.secondary'>
                        No open tax entries available for remittance.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button disabled={busy || !picked.length} onClick={() => void saveDraftOnly()}>
            Save Draft
          </Button>
          <Button
            variant='contained'
            disabled={busy || !picked.length || pickedTotal <= 0 || !form.moneyAccountId}
            onClick={() => void createRemittance()}
          >
            Submit Remittance
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reverseOpen} onClose={() => setReverseOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Reverse Remittance</DialogTitle>
        <DialogContent>
          <Alert severity='warning' sx={{ mb: 2, mt: 1 }}>
            This posts reversing GL entries (Dr Bank / Cr Tax Liability), reopens the linked tax
            register lines, and locks this remittance as Reversed. The original document is kept for
            audit.
          </Alert>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label='Reversal reason'
            required
            value={reverseReason}
            onChange={e => setReverseReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReverseOpen(false)}>Cancel</Button>
          <Button
            color='warning'
            variant='contained'
            disabled={busy || reverseReason.trim().length < 3}
            onClick={() => void reverseSelected()}
          >
            Confirm Reverse
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default TaxRemittancesPage
