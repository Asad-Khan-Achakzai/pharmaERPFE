'use client'
import { useState } from 'react'
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
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { settlementsService } from '@/services/settlements.service'
import { distributorsService } from '@/services/distributors.service'

const RecordSettlementPage = () => {
  const router = useRouter()
  const [selectedDistributor, setSelectedDistributor] = useState<any | null>(null)
  const [form, setForm] = useState({
    distributorId: '',
    direction: 'DISTRIBUTOR_TO_COMPANY' as 'DISTRIBUTOR_TO_COMPANY' | 'COMPANY_TO_DISTRIBUTOR',
    amount: 0,
    paymentMethod: 'CASH',
    referenceNumber: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const isFormValid = form.distributorId !== '' && form.amount > 0 && form.paymentMethod !== ''

  const handleSubmit = async () => {
    if (!form.distributorId || form.amount <= 0) {
      showApiError(null, 'Fill required fields')
      return
    }
    setSaving(true)
    try {
      await settlementsService.create({
        distributorId: form.distributorId,
        direction: form.direction,
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber || undefined,
        notes: form.notes || undefined
      })
      showSuccess('Settlement recorded')
      router.push('/settlements/list')
    } catch (err) {
      showApiError(err, 'Failed to record settlement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Record settlement'
        subheader='Clears distributor clearing balance FIFO (per distributor, not netted across distributors)'
      />
      <CardContent>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12 }}>
            <FormControl>
              <FormLabel>Direction</FormLabel>
              <RadioGroup
                value={form.direction}
                onChange={e =>
                  setForm(p => ({
                    ...p,
                    direction: e.target.value as 'DISTRIBUTOR_TO_COMPANY' | 'COMPANY_TO_DISTRIBUTOR'
                  }))
                }
              >
                <FormControlLabel value='DISTRIBUTOR_TO_COMPANY' control={<Radio />} label='Distributor pays company' />
                <FormControlLabel value='COMPANY_TO_DISTRIBUTOR' control={<Radio />} label='Company pays distributor' />
              </RadioGroup>
            </FormControl>
          </Grid>
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
              label='Distributor'
              placeholder='Type to search'
              helperText='Search by distributor name'
              required
              fetchErrorMessage='Failed to load distributors'
            />
          </Grid>
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
              {saving ? 'Saving...' : 'Record settlement'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
export default RecordSettlementPage
