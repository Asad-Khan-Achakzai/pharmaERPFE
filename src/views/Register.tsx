'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/AuthContext'
import {
  COUNTRY_OPTIONS,
  allIanaTimeZones,
  suggestTimeZoneForCountry
} from '@/constants/countryTimeZones'

const STEPS = ['Company', 'Country', 'Business timezone', 'Business settings', 'Review & account']

type FormState = {
  companyName: string
  companyEmail: string
  companyPhone: string
  country: string
  timeZone: string
  currency: string
  name: string
  email: string
  password: string
}

const initialForm: FormState = {
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  country: 'PK',
  timeZone: '',
  currency: 'PKR',
  name: '',
  email: '',
  password: ''
}

const Register = () => {
  const [activeStep, setActiveStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [timezoneConfirmed, setTimezoneConfirmed] = useState(false)
  const [tzTouched, setTzTouched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()

  const ianaOptions = useMemo(() => allIanaTimeZones(), [])

  const suggestedTz = useMemo(() => suggestTimeZoneForCountry(form.country), [form.country])

  useEffect(() => {
    if (activeStep === 2 && !tzTouched && suggestedTz) {
      setForm(prev => (prev.timeZone === suggestedTz ? prev : { ...prev, timeZone: suggestedTz }))
    }
  }, [activeStep, suggestedTz, tzTouched])

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const canAdvance = useCallback((): boolean => {
    switch (activeStep) {
      case 0:
        return form.companyName.trim().length >= 2 && form.companyEmail.trim().length > 0
      case 1:
        return form.country.trim().length === 2
      case 2: {
        const tz = form.timeZone.trim()
        return tz.length > 0 && ianaOptions.includes(tz) && timezoneConfirmed
      }
      case 3:
        return form.currency.trim().length > 0
      default:
        return true
    }
  }, [activeStep, form, ianaOptions, timezoneConfirmed])

  const handleNext = () => {
    setError('')
    if (!canAdvance()) {
      setError('Complete this step before continuing.')
      return
    }
    setActiveStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    setError('')
    setActiveStep(s => Math.max(s - 1, 0))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.timeZone.trim() || !timezoneConfirmed) {
      setError('Business timezone must be confirmed before registering.')
      return
    }
    setLoading(true)
    try {
      await register({
        companyName: form.companyName.trim(),
        companyEmail: form.companyEmail.trim(),
        companyPhone: form.companyPhone.trim(),
        country: form.country.trim().toUpperCase(),
        timeZone: form.timeZone.trim(),
        currency: form.currency.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password
      })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      setError(msg || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const countryLabel = COUNTRY_OPTIONS.find(c => c.code === form.country)?.label ?? form.country

  return (
    <div className='flex items-center justify-center min-bs-dvh p-6'>
      <Card className='is-full sm:is-[640px]'>
        <CardContent className='p-8'>
          <div className='flex justify-center mbe-6'>
            <Logo />
          </div>
          <Typography variant='h4' className='text-center mbe-1'>
            Register your company
          </Typography>
          <Typography className='text-center mbe-6' color='text.secondary'>
            Business timezone is required for accurate reports, attendance, and operations.
          </Typography>

          <Stepper activeStep={activeStep} className='mbe-6'>
            {STEPS.map(label => (
              <Step key={label}>
                <StepLabel>
                  <Typography variant='caption'>{label}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {error ? (
            <Alert severity='error' className='mbe-4'>
              {error}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
            {activeStep === 0 ? (
              <>
                <Typography variant='h6'>Company details</Typography>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12 }}>
                    <CustomTextField
                      fullWidth
                      label='Company name'
                      required
                      value={form.companyName}
                      onChange={handleChange('companyName')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <CustomTextField
                      fullWidth
                      label='Company email'
                      type='email'
                      required
                      value={form.companyEmail}
                      onChange={handleChange('companyEmail')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <CustomTextField
                      fullWidth
                      label='Company phone'
                      value={form.companyPhone}
                      onChange={handleChange('companyPhone')}
                    />
                  </Grid>
                </Grid>
              </>
            ) : null}

            {activeStep === 1 ? (
              <>
                <Typography variant='h6'>Country</Typography>
                <Typography variant='body2' color='text.secondary' className='mbe-2'>
                  Used to suggest a default business timezone. You will confirm or override in the next step.
                </Typography>
                <CustomTextField
                  select
                  fullWidth
                  label='Country / region'
                  value={form.country}
                  onChange={e => {
                    setForm(prev => ({ ...prev, country: e.target.value }))
                    setTimezoneConfirmed(false)
                    setTzTouched(false)
                  }}
                >
                  {COUNTRY_OPTIONS.map(c => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.label} ({c.code})
                    </MenuItem>
                  ))}
                </CustomTextField>
              </>
            ) : null}

            {activeStep === 2 ? (
              <>
                <Typography variant='h6'>Business timezone</Typography>
                <Alert severity='info' className='mbe-2'>
                  Suggested for {countryLabel}: <strong>{suggestedTz || '—'}</strong>. You may choose another IANA
                  timezone if your operations use a different regional calendar.
                </Alert>
                <Autocomplete
                  options={ianaOptions}
                  value={form.timeZone || null}
                  onChange={(_, v) => {
                    setForm(prev => ({ ...prev, timeZone: v || '' }))
                    setTzTouched(true)
                    setTimezoneConfirmed(false)
                  }}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label='IANA timezone'
                      required
                      placeholder='e.g. Asia/Karachi'
                      margin='normal'
                    />
                  )}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={timezoneConfirmed}
                      onChange={e => setTimezoneConfirmed(e.target.checked)}
                      color='primary'
                    />
                  }
                  label='I confirm this timezone is correct for this company’s business calendar (reports, attendance, and daily operations).'
                />
                <Typography variant='caption' color='text.secondary'>
                  Final selection: <strong>{form.timeZone || '—'}</strong>
                </Typography>
              </>
            ) : null}

            {activeStep === 3 ? (
              <>
                <Typography variant='h6'>Business settings</Typography>
                <CustomTextField
                  select
                  fullWidth
                  label='Default currency'
                  value={form.currency}
                  onChange={handleChange('currency')}
                >
                  <MenuItem value='PKR'>PKR</MenuItem>
                  <MenuItem value='AED'>AED</MenuItem>
                  <MenuItem value='GBP'>GBP</MenuItem>
                  <MenuItem value='USD'>USD</MenuItem>
                </CustomTextField>
              </>
            ) : null}

            {activeStep === 4 ? (
              <>
                <Typography variant='h6'>Review & administrator account</Typography>
                <Box className='p-4 border rounded' sx={{ borderColor: 'divider' }}>
                  <Typography variant='subtitle2' gutterBottom>
                    Company
                  </Typography>
                  <Typography variant='body2'>{form.companyName}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {form.companyEmail} · {countryLabel}
                  </Typography>
                  <Typography variant='body2' className='mbs-2'>
                    <strong>Business timezone:</strong> {form.timeZone}
                  </Typography>
                  <Typography variant='body2'>
                    <strong>Currency:</strong> {form.currency}
                  </Typography>
                </Box>
                <Typography variant='subtitle1' className='mts-2'>
                  Admin account
                </Typography>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <CustomTextField
                      fullWidth
                      label='Your name'
                      required
                      value={form.name}
                      onChange={handleChange('name')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <CustomTextField
                      fullWidth
                      label='Email'
                      type='email'
                      required
                      value={form.email}
                      onChange={handleChange('email')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <CustomTextField
                      fullWidth
                      label='Password'
                      type='password'
                      required
                      value={form.password}
                      onChange={handleChange('password')}
                    />
                  </Grid>
                </Grid>
              </>
            ) : null}

            {activeStep < STEPS.length - 1 ? (
              <Box className='flex justify-between gap-2 mbs-2'>
                <Button type='button' onClick={handleBack} disabled={activeStep === 0 || loading}>
                  Back
                </Button>
                <Button type='button' variant='contained' onClick={handleNext} disabled={loading}>
                  Next
                </Button>
              </Box>
            ) : (
              <Box className='flex justify-between gap-2 mbs-2'>
                <Button type='button' onClick={handleBack} disabled={loading}>
                  Back
                </Button>
                <Button
                  type='submit'
                  variant='contained'
                  disabled={
                    loading ||
                    !form.name.trim() ||
                    !form.email.trim() ||
                    !form.password ||
                    form.password.length < 6
                  }
                >
                  {loading ? 'Creating…' : 'Create company'}
                </Button>
              </Box>
            )}

            <div className='flex justify-center items-center gap-2'>
              <Typography>Already have an account?</Typography>
              <Typography component={Link} href='/login' color='primary.main'>
                Sign in
              </Typography>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Register
