'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { MoneyAccountSelect } from '@/components/finance/MoneyAccountSelect'
import { remittancesService } from '@/services/remittances.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'

const formatPKR = (v: number) =>
  `PKR ${Number(v || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

const todayIso = () => new Date().toISOString().slice(0, 10)

type Line = {
  key: string
  source: 'new' | 'existing'
  pharmacyId: string
  pharmacyName: string
  outstanding?: number
  amount: number
  collectionId?: string
  remittanceOpen?: number
  sliceCompany?: number
  sliceDist?: number
}

const RecordRemittancePage = () => {
  const router = useRouter()
  const [distributor, setDistributor] = useState<any | null>(null)
  const [addPharmacy, setAddPharmacy] = useState<any | null>(null)
  const [addAmount, setAddAmount] = useState(0)
  const [addOutstanding, setAddOutstanding] = useState<any | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [unremitted, setUnremitted] = useState<any[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [receivedAmount, setReceivedAmount] = useState(0)
  const [receivedTouched, setReceivedTouched] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [moneyAccountId, setMoneyAccountId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [differenceReason, setDifferenceReason] = useState('')
  const [date, setDate] = useState(todayIso)
  const [preview, setPreview] = useState<any | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const distributorId = distributor ? String(distributor._id) : ''

  const loadLists = useCallback(async (id: string) => {
    setLoadingLists(true)
    try {
      const [outRes, unRes] = await Promise.all([
        remittancesService.pharmacyOutstanding(id, { limit: 50 }),
        remittancesService.unremittedCollections(id, { limit: 50 })
      ])
      setUnremitted(unRes.data.data || [])
      return outRes.data.data || []
    } catch (err) {
      showApiError(err, 'Failed to load distributor collections')
      return []
    } finally {
      setLoadingLists(false)
    }
  }, [])

  useEffect(() => {
    if (!distributorId) {
      setUnremitted([])
      setLines([])
      setPreview(null)
      return
    }
    void loadLists(distributorId)
  }, [distributorId, loadLists])

  const buildPayload = useCallback(
    (received?: number) => {
      const newCollections = lines
        .filter(l => l.source === 'new')
        .map(l => ({ pharmacyId: l.pharmacyId, amount: l.amount }))
      const collectionIds = lines.filter(l => l.source === 'existing' && l.collectionId).map(l => l.collectionId as string)
      return {
        distributorId,
        newCollections,
        collectionIds,
        receivedAmount: received ?? receivedAmount,
        paymentMethod,
        moneyAccountId,
        referenceNumber: referenceNumber || undefined,
        date: date || undefined,
        notes: notes || undefined,
        differenceReason: differenceReason || undefined
      }
    },
    [lines, distributorId, receivedAmount, paymentMethod, moneyAccountId, referenceNumber, date, notes, differenceReason]
  )

  useEffect(() => {
    if (!distributorId || lines.length === 0) {
      setPreview(null)
      return
    }
    let cancel = false
    const t = setTimeout(() => {
      setPreviewing(true)
      remittancesService
        .preview({
          distributorId,
          newCollections: lines.filter(l => l.source === 'new').map(l => ({ pharmacyId: l.pharmacyId, amount: l.amount })),
          collectionIds: lines.filter(l => l.source === 'existing').map(l => l.collectionId),
          receivedAmount: receivedTouched ? receivedAmount : undefined
        })
        .then(r => {
          if (cancel) return
          const data = r.data.data
          setPreview(data)
          if (!receivedTouched) setReceivedAmount(Number(data.expectedAmount) || 0)
        })
        .catch(() => {
          if (!cancel) setPreview(null)
        })
        .finally(() => {
          if (!cancel) setPreviewing(false)
        })
    }, 300)
    return () => {
      cancel = true
      clearTimeout(t)
    }
  }, [distributorId, lines, receivedAmount, receivedTouched])

  const expected = Number(preview?.expectedAmount) || 0
  const collected = Number(preview?.collectedAmount) || 0
  const distShare = Number(preview?.distributorShare) || 0
  const received = Number(receivedAmount) || 0
  const difference = Math.round((received - expected) * 100) / 100
  const isShort = difference < -0.001
  const isExcess = difference > 0.001
  const isBalanced = !isShort && !isExcess && expected > 0

  const canSubmit =
    distributorId !== '' &&
    lines.length > 0 &&
    received > 0 &&
    moneyAccountId !== '' &&
    paymentMethod !== '' &&
    !isExcess &&
    !saving

  const addNewLine = async () => {
    if (!addPharmacy || addAmount <= 0) {
      showApiError(null, 'Select a pharmacy and enter the collected amount')
      return
    }
    let outstanding = addOutstanding
    if (!outstanding && distributorId) {
      try {
        const r = await remittancesService.preview({
          distributorId,
          newCollections: [{ pharmacyId: String(addPharmacy._id), amount: addAmount }]
        })
        outstanding = r.data.data?.newCollectionPreviews?.[0] || null
      } catch (err) {
        showApiError(err, 'Cannot add this pharmacy')
        return
      }
    }
    setLines(p => [
      ...p,
      {
        key: `new-${addPharmacy._id}-${Date.now()}`,
        source: 'new',
        pharmacyId: String(addPharmacy._id),
        pharmacyName: addPharmacy.name,
        outstanding: outstanding?.outstanding,
        amount: addAmount,
        sliceCompany: outstanding?.sliceCompany,
        sliceDist: outstanding?.sliceDist
      }
    ])
    setAddPharmacy(null)
    setAddAmount(0)
    setAddOutstanding(null)
  }

  const toggleExisting = (row: any, checked: boolean) => {
    const id = String(row._id)
    if (checked) {
      setLines(p => [
        ...p.filter(l => l.collectionId !== id),
        {
          key: `ex-${id}`,
          source: 'existing',
          pharmacyId: String(row.pharmacyId?._id || row.pharmacyId),
          pharmacyName: row.pharmacyId?.name || 'Pharmacy',
          amount: Number(row.amount) || 0,
          collectionId: id,
          remittanceOpen: Number(row.remittanceOpen) || 0,
          sliceCompany: Number(row.remittanceOpen) || 0,
          sliceDist: Math.max(0, (Number(row.amount) || 0) - (Number(row.remittanceOpen) || 0))
        }
      ])
    } else {
      setLines(p => p.filter(l => l.collectionId !== id))
    }
  }

  const handleSubmit = async () => {
    if (isExcess) {
      showApiError(
        null,
        `Amount received cannot exceed expected remittance of ${formatPKR(expected)} (company share, not total collected).`
      )
      return
    }
    setSaving(true)
    try {
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
      await remittancesService.create(buildPayload(received), uuid)
      showSuccess('Remittance recorded')
      router.push('/settlements/remittances')
    } catch (err) {
      showApiError(err, 'Failed to record remittance')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const statusAlert = useMemo(() => {
    if (!preview || lines.length === 0) return null
    if (isExcess) {
      return (
        <Alert severity='error'>
          Excess remittance — received {formatPKR(received)} vs expected company share {formatPKR(expected)}. Extra cash
          cannot be posted. Reduce the amount received.
        </Alert>
      )
    }
    if (isShort) {
      return (
        <Alert severity='warning'>
          Short remittance — distributor still owes {formatPKR(Math.abs(difference))} (company share remaining).
        </Alert>
      )
    }
    if (isBalanced) {
      return <Alert severity='success'>Balanced — amount received matches expected remittance (company share).</Alert>
    }
    return null
  }, [preview, lines.length, isExcess, isShort, isBalanced, received, expected, difference])

  return (
    <Card>
      <CardHeader
        title='Receive distributor remittance'
        subheader='A distributor is handing the company’s share to the company. They keep their own commission. Totals are calculated for you.'
      />
      <CardContent>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <LookupAutocomplete
              value={distributor}
              onChange={v => {
                setDistributor(v)
                setLines([])
                setReceivedTouched(false)
              }}
              fetchOptions={search =>
                distributorsService
                  .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                  .then(r => r.data.data || [])
              }
              label='Distributor'
              placeholder='Type to search'
              required
              fetchErrorMessage='Failed to load distributors'
            />
          </Grid>

          {distributorId && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='subtitle2' className='mbe-2'>
                Collections being handed over
              </Typography>
              <Grid container spacing={2} className='mbe-3'>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <LookupAutocomplete
                    value={addPharmacy}
                    onChange={v => {
                      setAddPharmacy(v)
                      setAddOutstanding(null)
                    }}
                    fetchOptions={search =>
                      pharmaciesService.lookup({ limit: 25, ...(search ? { search } : {}) }).then(r => r.data.data || [])
                    }
                    label='Add pharmacy'
                    placeholder='Search pharmacy'
                    fetchErrorMessage='Failed to load pharmacies'
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <CustomTextField
                    fullWidth
                    label='Collected from pharmacy (PKR)'
                    type='number'
                    value={addAmount || ''}
                    onChange={e => setAddAmount(+e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }} className='flex items-end'>
                  <Button variant='outlined' onClick={() => void addNewLine()}>
                    Add
                  </Button>
                </Grid>
              </Grid>

              {loadingLists ? (
                <CircularProgress size={22} />
              ) : (
                unremitted.length > 0 && (
                  <Paper variant='outlined' className='p-3 mbe-3'>
                    <Typography variant='body2' className='mbe-1'>
                      Already recorded (still holding company share)
                    </Typography>
                    {unremitted.map((row: any) => (
                      <FormControlLabel
                        key={row._id}
                        control={
                          <Checkbox
                            checked={lines.some(l => l.collectionId === String(row._id))}
                            onChange={e => toggleExisting(row, e.target.checked)}
                          />
                        }
                        label={`${row.pharmacyId?.name || 'Pharmacy'} — collected ${formatPKR(row.amount)} · still to remit ${formatPKR(row.remittanceOpen || 0)}`}
                      />
                    ))}
                  </Paper>
                )
              )}

              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Pharmacy</TableCell>
                    <TableCell align='right'>Collected</TableCell>
                    <TableCell align='right'>Company share</TableCell>
                    <TableCell align='right'>Distributor share</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map(l => (
                    <TableRow key={l.key}>
                      <TableCell>
                        {l.pharmacyName}
                        {l.source === 'existing' ? ' (already recorded)' : ''}
                      </TableCell>
                      <TableCell align='right'>{formatPKR(l.amount)}</TableCell>
                      <TableCell align='right'>
                        {l.sliceCompany != null ? formatPKR(l.sliceCompany) : '—'}
                      </TableCell>
                      <TableCell align='right'>{l.sliceDist != null ? formatPKR(l.sliceDist) : '—'}</TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' onClick={() => setLines(p => p.filter(x => x.key !== l.key))}>
                          <i className='tabler-x' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant='body2' color='text.secondary'>
                          Add pharmacies or select already-recorded collections.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <Paper variant='outlined' className='p-4'>
              <Typography variant='subtitle2' className='mbe-2'>
                Totals {previewing ? '(updating…)' : ''}
              </Typography>
              <Typography>Total collected {formatPKR(collected)}</Typography>
              <Typography>Distributor share (retained) {formatPKR(distShare)}</Typography>
              <Typography fontWeight={600}>Company share / expected remittance {formatPKR(expected)}</Typography>
              <Typography>Amount received {formatPKR(received)}</Typography>
              <Typography>Difference {formatPKR(difference)}</Typography>
              <div className='mbs-3'>{statusAlert}</div>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              type='date'
              label='Date'
              slotProps={{ inputLabel: { shrink: true } }}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              required
              fullWidth
              label='Amount received (PKR)'
              type='number'
              value={receivedAmount || ''}
              onChange={e => {
                setReceivedTouched(true)
                setReceivedAmount(+e.target.value)
              }}
              helperText='Defaults to expected company share. Reduce this for a short remittance.'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <MoneyAccountSelect
              required
              label='Deposit to (Cash/Bank account)'
              helperText='Company account that received this remittance'
              value={moneyAccountId}
              onChange={id => setMoneyAccountId(id)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              required
              select
              fullWidth
              label='Payment method'
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
            >
              <MenuItem value='CASH'>Cash</MenuItem>
              <MenuItem value='CHEQUE'>Cheque</MenuItem>
              <MenuItem value='BANK_TRANSFER'>Bank transfer</MenuItem>
              <MenuItem value='UPI'>UPI</MenuItem>
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              label='Reference number'
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
            />
          </Grid>
          {isShort && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                fullWidth
                label='Reason for shortage (optional)'
                value={differenceReason}
                onChange={e => setDifferenceReason(e.target.value)}
              >
                <MenuItem value=''>None</MenuItem>
                <MenuItem value='COLLECTION_DISCREPANCY'>Collection discrepancy</MenuItem>
                <MenuItem value='AMOUNT_RETAINED'>Amount retained</MenuItem>
                <MenuItem value='COUNTING_SHORT'>Counting short</MenuItem>
                <MenuItem value='OTHER'>Other</MenuItem>
              </CustomTextField>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <CustomTextField
              fullWidth
              label='Notes'
              multiline
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button variant='contained' disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
              Review and post
            </Button>
          </Grid>
        </Grid>
      </CardContent>

      <Dialog open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Confirm remittance</DialogTitle>
        <DialogContent>
          <Typography className='mbe-2'>
            Receive {formatPKR(received)} from {distributor?.name} against company share of {formatPKR(expected)} (
            {lines.length} collection{lines.length === 1 ? '' : 's'}).
          </Typography>
          {isShort && (
            <Alert severity='warning' className='mbe-2'>
              Shortage {formatPKR(Math.abs(difference))} will remain as remittance due.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={() => void handleSubmit()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Posting…' : 'Post remittance'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default RecordRemittancePage
