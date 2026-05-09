'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { collectionsService } from '@/services/collections.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'

const RecordPaymentPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedPharmacy, setSelectedPharmacy] = useState<any | null>(null)
  const [selectedDistributor, setSelectedDistributor] = useState<any | null>(null)
  const [form, setForm] = useState({
    pharmacyId: '',
    distributorId: '',
    collectorType: 'COMPANY' as 'COMPANY' | 'DISTRIBUTOR',
    amount: 0,
    paymentMethod: 'CASH',
    referenceNumber: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const pid = searchParams.get('pharmacyId')
    if (!pid || !/^[a-f0-9]{24}$/i.test(pid)) return
    let cancel = false
    void (async () => {
      try {
        const r = await pharmaciesService.getById(pid)
        const row = r.data.data
        if (!cancel && row) {
          setSelectedPharmacy(row)
          setForm(p => ({ ...p, pharmacyId: String(row._id) }))
        }
      } catch {
        /* keep manual selection */
      }
    })()
    return () => {
      cancel = true
    }
  }, [searchParams])

  const needsDistributor = form.collectorType === 'DISTRIBUTOR'
  const isFormValid =
    form.pharmacyId !== '' &&
    form.amount > 0 &&
    form.paymentMethod !== '' &&
    (!needsDistributor || form.distributorId !== '')

  const handleSubmit = async () => {
    if (!form.pharmacyId || form.amount <= 0) {
      showApiError(null, 'Fill required fields')
      return
    }
    setSaving(true)
    try {
      await collectionsService.create({
        pharmacyId: form.pharmacyId,
        collectorType: form.collectorType,
        ...(form.collectorType === 'DISTRIBUTOR' ? { distributorId: form.distributorId } : {}),
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber || undefined,
        notes: form.notes || undefined
      })
      showSuccess('Collection recorded')
      router.push('/payments/list')
    } catch (err) {
      showApiError(err, 'Failed to record collection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Record collection'
        subheader='Money received from pharmacy. Company collector: FIFO across all distributors for this pharmacy. Distributor collector: choose which distributor collected — allocation runs only against that distributor’s deliveries.'
      />
      <CardContent>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12 }}>
            <FormControl>
              <FormLabel>Collected by</FormLabel>
              <RadioGroup
                row
                value={form.collectorType}
                onChange={e =>
                  setForm(p => ({
                    ...p,
                    collectorType: e.target.value as 'COMPANY' | 'DISTRIBUTOR',
                    distributorId: e.target.value === 'COMPANY' ? '' : p.distributorId
                  }))
                }
              >
                <FormControlLabel value='COMPANY' control={<Radio />} label='Company' />
                <FormControlLabel value='DISTRIBUTOR' control={<Radio />} label='Distributor' />
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <LookupAutocomplete
              value={selectedPharmacy}
              onChange={v => {
                setSelectedPharmacy(v)
                setForm(p => ({ ...p, pharmacyId: v ? String(v._id) : '' }))
              }}
              fetchOptions={search =>
                pharmaciesService.lookup({ limit: 25, ...(search ? { search } : {}) }).then(r => r.data.data || [])
              }
              label='Pharmacy'
              placeholder='Type to search'
              helperText='Search by pharmacy name'
              required
              fetchErrorMessage='Failed to load pharmacies'
            />
          </Grid>
          {needsDistributor && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <LookupAutocomplete
                value={selectedDistributor}
                onChange={v => {
                  setSelectedDistributor(v)
                  setForm(p => ({ ...p, distributorId: v ? String(v._id) : '' }))
                }}
                fetchOptions={search =>
                  distributorsService
                    .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                    .then(r => r.data.data || [])
                }
                label='Distributor who collected'
                placeholder='Type to search'
                helperText='Money is applied FIFO only to this distributor’s receivable from the pharmacy'
                required
                fetchErrorMessage='Failed to load distributors'
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              required
              fullWidth
              label='Amount (PKR)'
              type='number'
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              required
              select
              fullWidth
              label='Payment method'
              value={form.paymentMethod}
              onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}
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
              value={form.referenceNumber}
              onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <CustomTextField
              fullWidth
              label='Notes'
              multiline
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button
              variant='contained'
              onClick={handleSubmit}
              disabled={saving || !isFormValid}
              startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
            >
              {saving ? 'Saving...' : 'Record collection'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
export default RecordPaymentPage
