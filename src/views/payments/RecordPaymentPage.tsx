'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { collectionsService } from '@/services/collections.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'

const RecordPaymentPage = () => {
  const router = useRouter()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [distributors, setDistributors] = useState<any[]>([])
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
  const [loadingData, setLoadingData] = useState(true)

  const needsDistributor = form.collectorType === 'DISTRIBUTOR'
  const isFormValid =
    form.pharmacyId !== '' &&
    form.amount > 0 &&
    form.paymentMethod !== '' &&
    (!needsDistributor || form.distributorId !== '')

  useEffect(() => {
    const f = async () => {
      setLoadingData(true)
      try {
        const [pr, dr] = await Promise.all([
          pharmaciesService.list({ limit: 100 }),
          distributorsService.list({ limit: 200, isActive: 'true' })
        ])
        setPharmacies(pr.data.data || [])
        setDistributors(dr.data.data || [])
      } catch (err) {
        showApiError(err, 'Failed to load pharmacies')
      } finally {
        setLoadingData(false)
      }
    }
    f()
  }, [])

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
        {loadingData ? (
          <div className='flex justify-center p-12'>
            <CircularProgress />
          </div>
        ) : (
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
              <CustomTextField
                required
                select
                fullWidth
                label='Pharmacy'
                value={form.pharmacyId}
                onChange={e => setForm(p => ({ ...p, pharmacyId: e.target.value }))}
              >
                {pharmacies.map(p => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            {needsDistributor && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField
                  required
                  select
                  fullWidth
                  label='Distributor who collected'
                  value={form.distributorId}
                  onChange={e => setForm(p => ({ ...p, distributorId: e.target.value }))}
                  helperText='Money is applied FIFO only to this distributor’s receivable from the pharmacy'
                >
                  <MenuItem value='' disabled>
                    Select distributor
                  </MenuItem>
                  {distributors.map(d => (
                    <MenuItem key={d._id} value={d._id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
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
        )}
      </CardContent>
    </Card>
  )
}
export default RecordPaymentPage
